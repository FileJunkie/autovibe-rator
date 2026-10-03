import { describe, it, expect, vi } from 'vitest'
import { postComment } from '../../../src/agent/github/post-comment'

describe('postComment', () => {
  it('should call octokit.issues.createComment with correct params', async () => {
    const mockCreateComment = vi.fn().mockResolvedValue({ data: { id: 1 } })
    const mockOctokit = {
      rest: {
        issues: {
          createComment: mockCreateComment,
        },
      },
    }

    await postComment(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      issueNumber: 42,
      body: 'Review complete',
    })

    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      issue_number: 42,
      body: 'Review complete',
    })
  })

  it('should call createComment exactly once', async () => {
    const mockCreateComment = vi.fn().mockResolvedValue({})
    const mockOctokit = {
      rest: {
        issues: {
          createComment: mockCreateComment,
        },
      },
    }

    await postComment(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      issueNumber: 1,
      body: 'test',
    })

    expect(mockCreateComment).toHaveBeenCalledTimes(1)
  })

  it('should propagate errors from octokit', async () => {
    const mockCreateComment = vi.fn().mockRejectedValue(new Error('API error'))
    const mockOctokit = {
      rest: {
        issues: {
          createComment: mockCreateComment,
        },
      },
    }

    await expect(
      postComment(mockOctokit as any, {
        owner: 'FileJunkie',
        repo: 'autovibe-rator',
        issueNumber: 42,
        body: 'test',
      }),
    ).rejects.toThrow('API error')
  })

  it('should handle multi-line body content', async () => {
    const mockCreateComment = vi.fn().mockResolvedValue({})
    const mockOctokit = {
      rest: {
        issues: {
          createComment: mockCreateComment,
        },
      },
    }

    const body = '## Review\n\nLine 1\nLine 2\n\n```diff\n- old\n+ new\n```'
    await postComment(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      issueNumber: 42,
      body,
    })

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ body }),
    )
  })
})
