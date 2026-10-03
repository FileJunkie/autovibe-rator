import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { createLogger } from '../../utils/logger'
import { isGitHubRepoUrl, isValidGitBranch } from '../../utils/git-branch'

const execFileAsync = promisify(execFile)

const log = createLogger('vibe')
const dockerLog = createLogger('docker')

export type VibeMode = 'issue' | 'pr'

export interface PersonaInfo {
  name: string
  title: string
  summary?: string
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

export interface InvokeVibeOptions {
  dockerCmd?: string
  imageTag?: string
  personasPath?: string
  useDocker?: boolean
  /** Harness-side token: used for cloning and the final push. Never enters the sandbox. */
  githubToken?: string
  /** Read-only token handed to the sandboxed agent for GitHub API reads. */
  agentToken?: string
}

export interface Workspace {
  workdir: string
  baseSha: string
}

export interface PushOutcome {
  pushed: boolean
  reason: string
}

export interface PullInfo {
  headRef: string
  headRepoUrl?: string
}

const DEFAULT_IMAGE_TAG = 'autovibe-agent'
const DEFAULT_DOCKER_CMD = 'docker'
const RUNS_ROOT = join(tmpdir(), 'vibe-runs')
const GIT_TIMEOUT_MS = 300000
const DOCKER_TIMEOUT_MS = 3600000
const BOT_NAME = 'autovibe-rator[bot]'
const BOT_EMAIL = 'autovibe-rator[bot]@users.noreply.github.com'
// Reads GITHUB_TOKEN from the environment at fetch/push time, so the token
// is never written to .git/config or the remote URL.
const CREDENTIAL_HELPER = 'credential.helper=!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f'

function generateContainerName(): string {
  const timestamp = Date.now()
  const random = randomBytes(3).toString('hex')
  return `autovibe-${timestamp}-${random}`
}

function buildEnv(context: VibeContext): string[] {
  const env: string[] = [
    `VIBE_REPO_URL=${context.repoUrl}`,
    `VIBE_REPO_FULL_NAME=${context.repoFullName}`,
    `VIBE_EVENT_TYPE=${context.eventType}`,
    `VIBE_MODE=${context.mode}`,
    `VIBE_TARGET_BRANCH=${context.branch}`,
    `VIBE_COMMENT_BODY=${context.commentBody}`,
  ]

  if (context.title !== undefined) {
    env.push(`VIBE_TITLE=${context.title}`)
  }
  if (context.issueNumber !== undefined) {
    env.push(`VIBE_ISSUE_NUMBER=${context.issueNumber}`)
  }
  if (context.pullNumber !== undefined) {
    env.push(`VIBE_PULL_NUMBER=${context.pullNumber}`)
  }

  return env
}

export function loadPersonas(personasPath: string): PersonaInfo[] {
  if (!existsSync(personasPath)) {
    log.warn(`No personas directory at ${personasPath}`)
    return []
  }
  return readdirSync(personasPath)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const content = readFileSync(join(personasPath, file), 'utf8')
      const titleLine = content.split('\n').find((line) => line.startsWith('# '))
      const summaryLine = content.split('\n').find((line) => line.startsWith('> '))
      return {
        name: file.replace(/\.md$/, ''),
        title: titleLine ? titleLine.replace(/^#\s*/, '').trim() : file.replace(/\.md$/, ''),
        summary: summaryLine ? summaryLine.replace(/^>\s*/, '').trim() : undefined,
      }
    })
}

export function buildPrompt(context: VibeContext, personas: PersonaInfo[]): string {
  const number = context.pullNumber ?? context.issueNumber
  const kind = context.pullNumber !== undefined ? 'PR' : 'issue'

  const headerLines = [`Repository: ${context.repoFullName}`]
  if (number !== undefined) {
    headerLines.push(`${kind} #${number}`)
  }
  if (context.title !== undefined) {
    headerLines.push(`${kind} title: ${context.title}`)
  }

  const request = context.commentBody.trim()
    ? `\n## User request (verbatim)\n\n${context.commentBody}\n`
    : ''

  const catalog = personas
    .map((p) => `- ${p.name}.md — ${p.title}${p.summary ? `: ${p.summary}` : ''}`)
    .join('\n')

  const personaSection = personas.length
    ? `
## Persona

Persona definitions are in \`.autovibe/personas/\` in your working directory:
${catalog}

Read the persona file that best matches the user's request and follow it as your operating role for this run. If none fits, use \`.autovibe/personas/${personas[0].name}.md\`.
`
    : ''

  const modeInstruction = context.mode === 'pr'
    ? `- You are working on pull request #${number}: the PR branch \`${context.branch}\` is already checked out. Make your changes directly on this branch.`
    : `- You are working on issue #${number}: implement the request on the branch \`${context.branch}\` (already created and checked out).`

  const instructions = `
## Operating instructions

- Your working directory is a git clone of the repository. This is a LOCAL sandbox: you do NOT have push access, and the GITHUB_TOKEN in your environment (if present) is read-only.
${modeInstruction}
- Commit all of your work locally with \`git commit\` and reference ${context.pullNumber !== undefined ? 'the PR' : `issue #${number}`} in commit messages. Uncommitted changes are discarded - only committed work reaches the remote.
- Do not attempt to push, change remotes, or open pull requests. The harness validates your commits and pushes them for you after you finish.
- Stay on the branch \`${context.branch}\`; leave the working tree on it when you are done.
- Push enforcement: a pre-push hook in this clone rejects any push to a ref other than \`${context.branch}\`. This is enforced by the harness, not a guideline; do not try to bypass it.
`

  return `${headerLines.join('\n')}\n${request}${personaSection}${instructions}\n---\n\n`
}

export function installPushGuard(workdir: string, branch: string): void {
  // The branch is interpolated into a shell script; reject anything that is
  // not on the strict branch whitelist (defense in depth - the handler
  // validates earlier, but this is the choke point).
  if (!isValidGitBranch(branch)) {
    throw new Error(`refusing to install push guard for invalid branch name: ${JSON.stringify(branch)}`)
  }
  const hook = join(workdir, '.git', 'hooks', 'pre-push')
  const script = [
    '#!/bin/sh',
    '# autovibe-rator push guard: only the target branch may be pushed',
    `target="refs/heads/${branch}"`,
    'while read local_ref local_sha remote_ref remote_sha; do',
    '  if [ "$remote_ref" != "$target" ]; then',
    '    echo "autovibe-rator: push rejected: only $target may be pushed" >&2',
    '    exit 1',
    '  fi',
    'done',
    'exit 0',
    '',
  ].join('\n')
  writeFileSync(hook, script)
  chmodSync(hook, 0o755)
}

function copyPersonas(personasPath: string, workdir: string): void {
  if (!existsSync(personasPath)) {
    log.warn(`No personas directory at ${personasPath}`)
    return
  }
  const dest = join(workdir, '.autovibe', 'personas')
  mkdirSync(dest, { recursive: true })
  for (const file of readdirSync(personasPath)) {
    if (file.endsWith('.md')) {
      copyFileSync(join(personasPath, file), join(dest, file))
    }
  }
  // Keep the copied personas out of any commit; .git/info/exclude is local-only.
  appendFileSync(join(workdir, '.git', 'info', 'exclude'), '.autovibe/\n')
}

async function git(workdir: string | undefined, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const fullArgs = workdir ? ['-C', workdir, ...args] : args
  const { stdout } = await execFileAsync('git', fullArgs, { timeout: GIT_TIMEOUT_MS, env })
  return stdout
}

async function remoteBranchExists(workdir: string, branch: string): Promise<boolean> {
  try {
    await git(workdir, ['ls-remote', '--exit-code', '--heads', 'origin', branch])
    return true
  } catch {
    return false
  }
}

export async function prepareWorkspace(context: VibeContext, options: InvokeVibeOptions): Promise<Workspace> {
  // Both values reach git subcommands and shell hooks; anything unexpected is
  // rejected outright rather than sanitized. The webhook payload is signed by
  // GitHub, but a defense-in-depth pin on shape costs nothing.
  if (!isValidGitBranch(context.branch)) {
    throw new Error(`refusing workspace: invalid branch name`)
  }
  if (!isGitHubRepoUrl(context.repoUrl)) {
    throw new Error(`refusing workspace: repo URL is not a github.com https URL`)
  }

  const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`
  const workdir = join(RUNS_ROOT, runId)
  mkdirSync(RUNS_ROOT, { recursive: true })

  const token = options.githubToken || process.env.GITHUB_TOKEN
  const cloneArgs: string[] = []
  if (token) {
    cloneArgs.push('-c', CREDENTIAL_HELPER)
  } else {
    log.warn('No GITHUB_TOKEN available; cloning without auth (public repos only, push will fail)')
  }
  cloneArgs.push('clone', context.repoUrl, workdir)

  log.info(`Cloning ${context.repoUrl} into ${workdir}`)
  await execFileAsync('git', cloneArgs, {
    timeout: GIT_TIMEOUT_MS,
    env: token ? { ...process.env, GITHUB_TOKEN: token } : process.env,
  })

  // The clone was made with a transient credential helper via -c, which git
  // persists into the local config. Remove it so the workspace handed to the
  // agent carries no push credentials at all.
  try {
    await git(workdir, ['config', '--local', '--unset-all', 'credential.helper'])
  } catch {
    // Nothing to unset (no helper persisted); fine.
  }

  // Re-run on the same issue must not fail on checkout -b; reuse an
  // existing remote branch when one is already there.
  if (await remoteBranchExists(workdir, context.branch)) {
    await git(workdir, ['fetch', 'origin', context.branch])
    await git(workdir, ['checkout', context.branch])
  } else {
    await git(workdir, ['checkout', '-b', context.branch])
  }

  await git(workdir, ['config', 'user.name', BOT_NAME])
  await git(workdir, ['config', 'user.email', BOT_EMAIL])
  installPushGuard(workdir, context.branch)
  copyPersonas(options.personasPath || join(process.cwd(), 'personas'), workdir)

  const baseSha = (await git(workdir, ['rev-parse', 'HEAD'])).trim()
  return { workdir, baseSha }
}

// Git config keys the agent could have planted in the workspace that would
// hijack the harness push: repointed remotes via url.*.insteadOf, a
// credential helper that captures the push token, or redirected hooks.
const HOSTILE_CONFIG_RE = /^(credential\.helper|url\.|core\.hooksPath)/

async function sanitizeGitConfigForPush(workdir: string): Promise<void> {
  let entries: string
  try {
    entries = await git(workdir, ['config', '--local', '--get-regexp', '^(credential\\.helper|url\\.|core\\.hooksPath)'])
  } catch {
    return // no matching config: git exits 1
  }
  for (const line of entries.trim().split('\n').filter(Boolean)) {
    const key = line.split(' ')[0]
    if (!HOSTILE_CONFIG_RE.test(key)) {
      continue
    }
    try {
      await git(workdir, ['config', '--local', '--unset-all', key])
      log.warn(`stripped agent-modified git config before push: ${key}`)
    } catch {
      // Already gone; nothing to do.
    }
  }
}

export async function validateAndPush(
  context: VibeContext,
  options: InvokeVibeOptions,
  workspace: Workspace,
): Promise<PushOutcome> {
  const { workdir, baseSha } = workspace

  try {
    const current = (await git(workdir, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    if (current !== context.branch) {
      return { pushed: false, reason: `changes not pushed: HEAD is on '${current}', expected '${context.branch}'` }
    }

    try {
      await git(workdir, ['merge-base', '--is-ancestor', baseSha, 'HEAD'])
    } catch {
      return { pushed: false, reason: `changes not pushed: history on '${context.branch}' does not descend from the original checkout` }
    }

    const ahead = parseInt((await git(workdir, ['rev-list', '--count', `${baseSha}..HEAD`])).trim(), 10)
    if (!Number.isFinite(ahead) || ahead <= 0) {
      return { pushed: false, reason: 'no commits to push' }
    }

    const dirty = (await git(workdir, ['status', '--porcelain'])).trim()
    if (dirty) {
      log.warn(`uncommitted changes left in the workspace; they will NOT be pushed`)
    }

    // The agent had write access to this .git/config between the clone and
    // now. Push to the pinned, validated URL with an explicit refspec, and
    // strip any config it may have planted first. (repoUrl was validated at
    // event intake and again in prepareWorkspace, which always runs before
    // this.)
    await sanitizeGitConfigForPush(workdir)

    const token = options.githubToken || process.env.GITHUB_TOKEN
    const pushArgs = [
      ...(token ? ['-c', CREDENTIAL_HELPER] : []),
      'push',
      context.repoUrl,
      `refs/heads/${context.branch}:refs/heads/${context.branch}`,
    ]
    await git(workdir, pushArgs, token ? { ...process.env, GITHUB_TOKEN: token } : process.env)
    return { pushed: true, reason: `pushed ${ahead} commit(s) to ${context.branch}` }
  } catch (e) {
    return { pushed: false, reason: `changes not pushed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

const TOKEN_PATTERNS: RegExp[] = [
  /gh[posurt]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
]

/**
 * Removes anything that looks like a GitHub token from text that will be
 * posted publicly. The agent's environment contains a (read-only) token, and
 * its raw stdout is posted back to the issue or PR verbatim - a
 * prompt-injected agent could otherwise print the token into its reply.
 */
export function scrubTokens(text: string, knownTokens: Array<string | undefined>): string {
  let out = text
  for (const t of knownTokens) {
    if (t && t.length >= 20) {
      out = out.split(t).join('[REDACTED]')
    }
  }
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]')
  }
  return out
}

function pushFooter(output: string, outcome: PushOutcome): string {
  return `${output.trimEnd()}\n\n---\n*autovibe-rator harness: ${outcome.reason}*\n`
}

async function invokeViaDocker(
  context: VibeContext,
  options: InvokeVibeOptions,
  prompt: string,
): Promise<string> {
  const workspace = await prepareWorkspace(context, options)
  const workdir = workspace.workdir
  const dockerCmd = options.dockerCmd || process.env.DOCKER_CMD || DEFAULT_DOCKER_CMD
  const imageTag = options.imageTag || DEFAULT_IMAGE_TAG
  const containerName = generateContainerName()

  const promptPath = join(RUNS_ROOT, `${containerName}-prompt.md`)
  writeFileSync(promptPath, prompt)

  const args = [
    'run',
    '--rm',
    '--name', containerName,
    '-v', `${workdir}:/workspace/run`,
    '-v', `${promptPath}:/input/prompt.md:ro`,
  ]
  // Only the read-only agent token enters the sandbox. The harness-side
  // push token never does, so a compromised agent cannot push.
  const sandboxEnv = options.agentToken
    ? { ...process.env, GITHUB_TOKEN: options.agentToken }
    : { ...process.env, GITHUB_TOKEN: '' }
  if (options.agentToken) {
    args.push('-e', 'GITHUB_TOKEN')
  }
  // The sandboxed agent needs the Mistral API key to run. Passed through
  // from the harness environment (set in the project .env) - the value is
  // never placed on the docker command line.
  if (process.env.MISTRAL_API_KEY) {
    args.push('-e', 'MISTRAL_API_KEY')
  }
  for (const e of buildEnv(context)) {
    args.push('-e', e)
  }
  args.push(imageTag)

  dockerLog.info(`sandbox run: ${containerName} (${imageTag})`)
  let stdout: string
  try {
    const result = await execFileAsync(dockerCmd, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: DOCKER_TIMEOUT_MS,
      env: sandboxEnv,
    })
    if (result.stderr) {
      dockerLog.error(`${containerName} stderr: ${result.stderr}`)
    }
    stdout = result.stdout
  } finally {
    unlinkSync(promptPath)
  }

  const outcome = await validateAndPush(context, options, workspace)
  log.info(`push outcome: ${outcome.reason}`)
  return pushFooter(scrubTokens(stdout, [options.agentToken]), outcome)
}

async function invokeDirectly(
  context: VibeContext,
  options: InvokeVibeOptions,
  prompt: string,
): Promise<string> {
  const workspace = await prepareWorkspace(context, options)
  const workdir = workspace.workdir

  log.info(`Spawning: vibe -p --workdir ${workdir}`)

  // Direct mode runs unsandboxed on this host - auto-approving tool calls
  // here means arbitrary commands as the harness user. Dev fallback only.
  const vibeProcess = spawn('vibe', [
    '-p',
    '--auto-approve',
    '--workdir', workdir,
  ], {
    env: {
      ...process.env,
      // Read-only token for GitHub API reads; never the harness push token.
      GITHUB_TOKEN: options.agentToken || '',
      ...Object.fromEntries(buildEnv(context).map((e) => {
        const [key, value] = e.split('=')
        return [key, value]
      })),
    },
  })

  log.info(`Vibe process spawned with PID: ${vibeProcess.pid}`)

  vibeProcess.stdin.write(prompt)
  vibeProcess.stdin.end()

  const stdout = await new Promise<string>((resolve, reject) => {
    let stdoutText = ''
    let stderrText = ''

    vibeProcess.stdout.on('data', (data) => {
      const text = data.toString()
      stdoutText += text
      log.debug('vibe stdout:', text)
    })
    vibeProcess.stderr.on('data', (data) => {
      const text = data.toString()
      stderrText += text
      log.debug('vibe stderr:', text)
    })

    vibeProcess.on('close', (code) => {
      log.info(`Vibe process closed with code: ${code}`)
      if (stderrText) {
        log.error('vibe stderr:', stderrText)
      }
      if (code !== 0) {
        reject(new Error(`Vibe exited with code ${code}`))
      } else {
        resolve(stdoutText)
      }
    })

    vibeProcess.on('error', (err) => {
      log.error(`Failed to spawn vibe: ${err.message}`)
      reject(err)
    })
  })

  const outcome = await validateAndPush(context, options, workspace)
  log.info(`push outcome: ${outcome.reason}`)
  return pushFooter(scrubTokens(stdout, [options.agentToken]), outcome)
}

export async function invokeVibe(
  context: VibeContext,
  options: InvokeVibeOptions = {},
): Promise<string> {
  const personas = loadPersonas(options.personasPath || join(process.cwd(), 'personas'))
  const prompt = buildPrompt(context, personas)

  const useDocker = options.useDocker !== false

  if (useDocker) {
    log.info('Using Docker sandbox invocation')
    return invokeViaDocker(context, options, prompt)
  }
  log.info('Using direct invocation (no sandbox)')
  return invokeDirectly(context, options, prompt)
}
