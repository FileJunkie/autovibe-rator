import { stage1Filter } from '../filter/stage1'
import { stage2Filter } from '../filter/stage2'
import { isGitHubRepoUrl, isValidGitBranch } from '../../utils/git-branch'

export type VibeMode = 'issue' | 'pr'

export interface HandlerConfig {
  botHandle: string
  allowedOwners?: string[]
  allowedAssociations?: string[]
}

export interface VibeContext {
  repoUrl: string
  repoFullName: string
  eventType: string
  mode: VibeMode
  branch: string
  issueNumber?: number
  pullNumber?: number
  commentBody: string
  title?: string
}

export interface CommentParams {
  owner: string
  repo: string
  issueNumber: number
  body: string
}

export interface ReviewParams {
  owner: string
  repo: string
  pullNumber: number
  body: string
}

export interface FetchPullParams {
  owner: string
  repo: string
  pullNumber: number
}

export interface PullInfo {
  headRef: string
  headRepoUrl?: string
}

export interface GetPermissionParams {
  owner: string
  repo: string
  username: string
}

export type RepoPermission = 'admin' | 'write' | 'read' | 'none'

export interface HandlerDeps {
  invokeVibe: (context: VibeContext) => Promise<string>
  postComment: (params: CommentParams) => Promise<void>
  postReview: (params: ReviewParams) => Promise<void>
  fetchPull?: (params: FetchPullParams) => Promise<PullInfo>
  getPermission?: (params: GetPermissionParams) => Promise<RepoPermission>
}

export interface HandlerResult {
  processed: boolean
  reason: string
  vibeOutput?: string
}

interface WebhookUser {
  login?: string
  author_association?: string
}

/** Minimal shape of the GitHub webhook payloads the harness consumes. */
export interface WebhookPayload {
  action?: string
  issue?: {
    number: number
    title?: string
    body?: string
    user?: WebhookUser
    pull_request?: unknown
  }
  comment?: {
    body?: string
    user?: WebhookUser
  }
  pull_request?: {
    number: number
    title?: string
    body?: string
    head?: { ref?: string; repo?: { clone_url?: string } }
    user?: WebhookUser
  }
  repository?: {
    full_name?: string
    name?: string
    clone_url?: string
    owner?: { login?: string }
  }
}

export async function handleEvent(
  eventType: string,
  payload: WebhookPayload,
  config: HandlerConfig,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const action = payload.action || ''
  const repoFullName = payload.repository?.full_name || ''
  const owner = payload.repository?.owner?.login || ''
  const repo = payload.repository?.name || ''

  // GitHub stamps author_association on some payloads - but webhook
  // deliveries frequently omit it. When the gate is active and the
  // association is missing, resolve the author's actual repo permission
  // via the API instead of failing every event.
  const author =
    eventType === 'issue_comment'
      ? payload.comment?.user
      : eventType === 'pull_request'
        ? payload.pull_request?.user
        : payload.issue?.user
  const authorLogin = author?.login || ''
  let effectiveAssociation: string | undefined = author?.author_association

  if (config.allowedAssociations?.length && !effectiveAssociation && authorLogin) {
    if (!deps.getPermission) {
      return { processed: false, reason: 'Author gate active but no getPermission dependency is configured' }
    }
    try {
      const permission = await deps.getPermission({ owner, repo, username: authorLogin })
      effectiveAssociation = permission === 'admin' ? 'OWNER' : permission === 'write' ? 'MEMBER' : undefined
    } catch (e) {
      return { processed: false, reason: `Could not determine author permission: ${e}` }
    }
  }

  const stage2 = stage2Filter({
    eventType,
    action,
    repoFullName,
    repoOwner: owner,
    allowedOwners: config.allowedOwners,
    authorAssociation: effectiveAssociation,
    allowedAssociations: config.allowedAssociations,
  })
  if (!stage2.passed) {
    return { processed: false, reason: stage2.reason }
  }

  let commentBody: string
  let title: string | undefined
  let issueNumber: number | undefined
  let pullNumber: number | undefined
  let mode: VibeMode = 'issue'

  if (eventType === 'issues') {
    commentBody = payload.issue?.body || ''
    title = payload.issue?.title
    issueNumber = payload.issue?.number
  } else if (eventType === 'issue_comment') {
    commentBody = payload.comment?.body || ''
    title = payload.issue?.title
    issueNumber = payload.issue?.number
    // A comment on a pull request is PR work, not issue work.
    if (payload.issue?.pull_request) {
      mode = 'pr'
    }
  } else if (eventType === 'pull_request') {
    commentBody = payload.pull_request?.body || ''
    title = payload.pull_request?.title
    pullNumber = payload.pull_request?.number
    mode = 'pr'
  } else {
    return { processed: false, reason: `Unsupported event type: ${eventType}` }
  }

  const stage1 = stage1Filter({ body: commentBody, title, authorLogin, botHandle: config.botHandle })
  if (!stage1.passed) {
    return { processed: false, reason: stage1.reason }
  }

  const baseRepoUrl = payload.repository?.clone_url || ''
  let repoUrl = baseRepoUrl
  let branch: string | undefined

  if (mode === 'pr') {
    if (eventType === 'pull_request') {
      branch = payload.pull_request?.head?.ref
      repoUrl = payload.pull_request?.head?.repo?.clone_url || baseRepoUrl
    } else {
      // issue_comment on a PR: resolve the PR head via the API.
      if (!deps.fetchPull) {
        return { processed: false, reason: 'Comment is on a PR but no fetchPull dependency is configured' }
      }
      if (issueNumber === undefined) {
        return { processed: false, reason: 'Comment is on a PR but the payload carries no PR number' }
      }
      try {
        const pr = await deps.fetchPull({ owner, repo, pullNumber: issueNumber })
        branch = pr.headRef
        repoUrl = pr.headRepoUrl || baseRepoUrl
      } catch (e) {
        return { processed: false, reason: `Could not resolve PR branch for comment: ${e}` }
      }
    }
  } else {
    branch = `autovibe-rator/issue-${issueNumber}`
  }

  // The branch name reaches git hooks and command arguments, and the repo URL
  // reaches git clone: both are attacker-influenceable surface (PR head refs,
  // fork URLs), so anything outside the strict whitelist is dropped.
  if (!isValidGitBranch(branch)) {
    return { processed: false, reason: 'Target branch failed validation; refusing to process' }
  }
  if (!isGitHubRepoUrl(repoUrl)) {
    return { processed: false, reason: 'Repository URL failed validation; refusing to process' }
  }

  if (!branch) {
    return { processed: false, reason: 'Could not determine the target branch for this event' }
  }

  const vibeContext: VibeContext = {
    repoUrl,
    repoFullName,
    eventType,
    mode,
    branch,
    commentBody,
  }
  if (title !== undefined) {
    vibeContext.title = title
  }
  if (issueNumber !== undefined) {
    vibeContext.issueNumber = issueNumber
  }
  if (pullNumber !== undefined) {
    vibeContext.pullNumber = pullNumber
  }

  const vibeOutput = await deps.invokeVibe(vibeContext)

  if (pullNumber !== undefined) {
    await deps.postReview({ owner, repo, pullNumber, body: vibeOutput })
  } else if (issueNumber !== undefined) {
    await deps.postComment({ owner, repo, issueNumber, body: vibeOutput })
  }

  return { processed: true, reason: 'Event processed successfully', vibeOutput }
}
