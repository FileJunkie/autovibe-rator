import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { execFileSync } from 'child_process'
import { installPushGuard } from '../../../src/agent/vibe/invoke'

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
}

function makeRepoWithBareOrigin(): { workdir: string; originDir: string } {
  const base = mkdtempSync(join(tmpdir(), 'vibe-guard-'))
  const originDir = join(base, 'origin.git')
  const workdir = join(base, 'work')
  execFileSync('git', ['init', '--bare', '-b', 'main', originDir])
  execFileSync('git', ['clone', originDir, workdir])
  git(workdir, 'config', 'user.name', 'test')
  git(workdir, 'config', 'user.email', 'test@example.com')
  return { workdir, originDir }
}

describe('installPushGuard', () => {
  let baseDir: string
  let workdir: string

  beforeEach(() => {
    const repo = makeRepoWithBareOrigin()
    baseDir = dirname(repo.workdir)
    workdir = repo.workdir
    installPushGuard(workdir, 'main')
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('should allow a push to the target branch', () => {
    git(workdir, 'commit', '--allow-empty', '-m', 'first')
    expect(() => git(workdir, 'push', '-u', 'origin', 'main')).not.toThrow()
  })

  it('should reject a push to any other branch', () => {
    git(workdir, 'commit', '--allow-empty', '-m', 'first')
    git(workdir, 'push', '-u', 'origin', 'main')
    git(workdir, 'checkout', '-b', 'evil-branch')
    git(workdir, 'commit', '--allow-empty', '-m', 'second')
    expect(() => git(workdir, 'push', '-u', 'origin', 'evil-branch')).toThrow()
  })

  it('should reject pushing the target branch under a different remote ref name', () => {
    git(workdir, 'commit', '--allow-empty', '-m', 'first')
    expect(() => git(workdir, 'push', 'origin', 'main:other-branch')).toThrow()
  })

  it('should reject a tag push', () => {
    git(workdir, 'commit', '--allow-empty', '-m', 'first')
    git(workdir, 'push', '-u', 'origin', 'main')
    git(workdir, 'tag', 'v1.0')
    expect(() => git(workdir, 'push', 'origin', 'v1.0')).toThrow()
  })

  it('should enforce the configured branch, not a fixed one', () => {
    installPushGuard(workdir, 'feature-x')
    git(workdir, 'checkout', '-b', 'feature-x')
    git(workdir, 'commit', '--allow-empty', '-m', 'first')
    expect(() => git(workdir, 'push', '-u', 'origin', 'feature-x')).not.toThrow()
    expect(() => git(workdir, 'push', 'origin', 'feature-x:main')).toThrow()
  })
})
