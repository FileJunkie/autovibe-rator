import express, { Request, Response } from 'express'
import { verifySignature } from './verify'
import { handleEvent } from './handler'
import { getInstallationOctokit, getInstallationToken, getScopedInstallationToken } from '../../utils/github-auth'
import { invokeVibe } from '../vibe/invoke'
import { postComment } from '../github/post-comment'
import { postReview } from '../github/post-review'
import { createLogger } from '../../utils/logger'

const log = createLogger('webhook')
const serverLog = createLogger('server')

export interface ServerConfig {
  webhookSecret: string
  botHandle: string
  port: number
  appId: number
  privateKey: string
  dockerCmd?: string
  allowedOwners?: string[]
  allowedAssociations?: string[]
}

interface WebhookRequest extends Request {
  rawBody?: string
}

export function createServer(config: ServerConfig): express.Express {
  const app = express()

  app.use(
    express.json({
      // Webhook payloads (large PR bodies, diffs, comments) can exceed the
      // express default of 100kb, which would 413 before verification.
      limit: '5mb',
      verify: (req, _res, buf) => {
        ;(req as WebhookRequest).rawBody = buf.toString('utf8')
      },
    }),
  )

  app.post('/webhook', async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    const eventType = req.headers['x-github-event'] as string

    if (!verifySignature((req as WebhookRequest).rawBody, signature, config.webhookSecret)) {
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    if (!eventType) {
      res.status(400).json({ error: 'Missing event type' })
      return
    }

    res.status(200).json({ received: true })

    try {
      const installationId = req.body.installation?.id
      if (!installationId) {
        log.error(`${eventType}: no installation ID in payload`)
        return
      }

      const octokit = await getInstallationOctokit(
        config.appId,
        installationId,
        config.privateKey,
      )

      let githubToken: string | undefined
      try {
        githubToken = await getInstallationToken(config.appId, installationId, config.privateKey)
        log.info(`${eventType}: acquired GitHub installation token (harness-side)`)
      } catch (e) {
        log.error(`${eventType}: could not get GitHub token`, e)
      }

      // Read-only token for the sandboxed agent. It may read the repo,
      // issues, and PRs, but can never push. Falls back to contents-only,
      // then to no token at all - never to the full harness token.
      let agentToken: string | undefined
      try {
        agentToken = await getScopedInstallationToken(config.appId, installationId, config.privateKey, {
          contents: 'read',
          issues: 'read',
          pull_requests: 'read',
        })
      } catch (e) {
        try {
          agentToken = await getScopedInstallationToken(config.appId, installationId, config.privateKey, {
            contents: 'read',
          })
          log.warn(`${eventType}: scoped agent token fell back to contents:read only`, e)
        } catch (e2) {
          log.error(`${eventType}: could not mint a read-only agent token; the agent will run without GitHub API access`, e2)
        }
      }

      const result = await handleEvent(
        eventType,
        req.body,
        { botHandle: config.botHandle, allowedOwners: config.allowedOwners, allowedAssociations: config.allowedAssociations },
        {
          invokeVibe: (ctx) => invokeVibe(ctx, { dockerCmd: config.dockerCmd, githubToken, agentToken }),
          postComment: (params) => postComment(octokit, params),
          postReview: (params) => postReview(octokit, params),
          fetchPull: async ({ owner, repo, pullNumber }) => {
            const { data } = await octokit.rest.pulls.get({
              owner,
              repo,
              pull_number: pullNumber,
            })
            return { headRef: data.head.ref, headRepoUrl: data.head.repo?.clone_url }
          },
          getPermission: async ({ owner, repo, username }) => {
            const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
              owner,
              repo,
              username,
            })
            return data.permission as 'admin' | 'write' | 'read' | 'none'
          },
        },
      )

      log.info(`${eventType}: ${result.reason}`)
    } catch (err) {
      log.error(`failed to process ${eventType}`, err)
    }
  })

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' })
  })

  return app
}

export function startServer(config: ServerConfig): void {
  const app = createServer(config)

  app.listen(config.port, () => {
    serverLog.info(`autovibe-rator listening on port ${config.port}`)
  })
}
