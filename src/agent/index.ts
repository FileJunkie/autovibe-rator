import { readFileSync } from 'fs'
import { config as loadEnv } from 'dotenv'
import { startServer, ServerConfig } from './webhook/server'
import { createLogger } from '../utils/logger'

const log = createLogger('startup')

function loadConfig(): ServerConfig {
  loadEnv()

  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || './github-app-private-key.pem'
  let privateKey = ''
  try {
    privateKey = readFileSync(privateKeyPath, 'utf8')
  } catch {
    log.error(`Could not read private key from ${privateKeyPath}`)
    log.error('Make sure you have generated the GitHub App private key and saved it.')
    process.exit(1)
  }

  const appId = Number(process.env.GITHUB_APP_ID)
  if (!appId) {
    log.error('GITHUB_APP_ID must be set in .env')
    process.exit(1)
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
  if (!webhookSecret) {
    log.error('GITHUB_WEBHOOK_SECRET must be set in .env')
    process.exit(1)
  }

  const allowedOwners = process.env.ALLOWED_OWNERS
    ? process.env.ALLOWED_OWNERS.split(',').map((o) => o.trim()).filter(Boolean)
    : []

  // Fail closed: without an explicit owner allowlist the harness would run
  // the agent for ANY GitHub account that installs the App.
  if (allowedOwners.length === 0) {
    log.error('ALLOWED_OWNERS must list at least one GitHub user or org login. The harness refuses to start open to all installations.')
    process.exit(1)
  }

  // Which author associations may trigger a run. ALL disables the gate.
  const associationsRaw = (process.env.ALLOWED_ASSOCIATIONS || 'OWNER,MEMBER,COLLABORATOR').trim()
  const allowedAssociations = associationsRaw.toUpperCase() === 'ALL'
    ? undefined
    : associationsRaw.split(',').map((a) => a.trim().toUpperCase()).filter(Boolean)

  return {
    webhookSecret,
    botHandle: process.env.BOT_HANDLE || 'autovibe-rator',
    port: Number(process.env.PORT) || 3000,
    appId,
    privateKey,
    dockerCmd: process.env.DOCKER_CMD,
    allowedOwners,
    allowedAssociations,
  }
}

const config = loadConfig()
startServer(config)
