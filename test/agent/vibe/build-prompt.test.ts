import { describe, it, expect } from 'vitest'
import { buildPrompt, loadPersonas } from '../../../src/agent/vibe/invoke'

const personas = [
  { name: 'code-reviewer', title: 'Code Reviewer', summary: 'Reviews code changes and posts findings' },
  { name: 'implementer', title: 'Implementer', summary: 'Implements the requested change and pushes the allowed branch' },
]

describe('buildPrompt', () => {
  it('should include repo, issue number, verbatim comment, and the persona catalog', () => {
    const prompt = buildPrompt(
      {
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'issues',
        mode: 'issue',
        branch: 'autovibe-rator/issue-42',
        issueNumber: 42,
        commentBody: '@autovibe-rator please fix the flaky test',
        title: 'Bug report',
      },
      personas,
    )

    expect(prompt).toContain('Repository: FileJunkie/autovibe-rator')
    expect(prompt).toContain('issue #42')
    expect(prompt).toContain('issue title: Bug report')
    expect(prompt).toContain('## User request (verbatim)')
    expect(prompt).toContain('@autovibe-rator please fix the flaky test')
    expect(prompt).toContain('## Persona')
    expect(prompt).toContain('- code-reviewer.md — Code Reviewer: Reviews code changes and posts findings')
    expect(prompt).toContain('- implementer.md — Implementer: Implements the requested change and pushes the allowed branch')
    expect(prompt).toContain('.autovibe/personas/')
  })

  it('should instruct issue mode to commit locally without pushing', () => {
    const prompt = buildPrompt(
      {
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'issues',
        mode: 'issue',
        branch: 'autovibe-rator/issue-42',
        issueNumber: 42,
        commentBody: '@autovibe-rator fix it',
      },
      personas,
    )

    expect(prompt).toContain('You are working on issue #42')
    expect(prompt).toContain('implement the request on the branch `autovibe-rator/issue-42`')
    expect(prompt).toContain('you do NOT have push access')
    expect(prompt).toContain('Commit all of your work locally')
    expect(prompt).toContain('reference issue #42 in commit messages')
    expect(prompt).toContain('The harness validates your commits and pushes them for you')
    expect(prompt).not.toContain('git push')
  })

  it('should instruct pr mode to edit the current PR branch locally', () => {
    const prompt = buildPrompt(
      {
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'pull_request',
        mode: 'pr',
        branch: 'fix-bug',
        pullNumber: 7,
        commentBody: '@autovibe-rator review this PR',
        title: 'Fix bug',
      },
      personas,
    )

    expect(prompt).toContain('PR #7')
    expect(prompt).toContain('PR title: Fix bug')
    expect(prompt).toContain('You are working on pull request #7')
    expect(prompt).toContain('the PR branch `fix-bug` is already checked out')
    expect(prompt).toContain('Make your changes directly on this branch')
    expect(prompt).toContain("reference the PR in commit messages")
    expect(prompt).not.toContain('git push')
  })

  it('should mention the deterministic push enforcement', () => {
    const prompt = buildPrompt(
      {
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'issues',
        mode: 'issue',
        branch: 'autovibe-rator/issue-42',
        issueNumber: 42,
        commentBody: 'hello',
      },
      personas,
    )

    expect(prompt).toContain('a pre-push hook in this clone rejects any push to a ref other than `autovibe-rator/issue-42`')
  })

  it('should omit the request section when the comment body is empty', () => {
    const prompt = buildPrompt(
      {
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'issues',
        mode: 'issue',
        branch: 'autovibe-rator/issue-42',
        issueNumber: 42,
        commentBody: '',
      },
      personas,
    )

    expect(prompt).not.toContain('## User request (verbatim)')
  })

  it('should omit the persona section when no personas are available', () => {
    const prompt = buildPrompt(
      {
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'issues',
        mode: 'issue',
        branch: 'autovibe-rator/issue-42',
        issueNumber: 42,
        commentBody: 'hello',
      },
      [],
    )

    expect(prompt).not.toContain('## Persona')
  })
})

describe('loadPersonas', () => {
  it('should read title and summary from persona files', () => {
    const result = loadPersonas('personas')
    const names = result.map((p) => p.name)
    expect(names).toContain('code-reviewer')
    expect(names).toContain('implementer')

    const reviewer = result.find((p) => p.name === 'code-reviewer')!
    expect(reviewer.title).toBe('Code Reviewer')
    expect(reviewer.summary).toMatch(/^Reviews code changes/)
  })
})
