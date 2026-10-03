import { describe, it, expect, vi } from 'vitest'
import { postReview } from '../../../src/agent/github/post-review'

describe('postReview', () => {
  it('should call octokit.rest.pulls.createReview with correct params', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({ data: { id: 1 } })
    const mockOctokit = {
      rest: {
        pulls: {
          createReview: mockCreateReview,
        },
      },
    }

    await postReview(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pullNumber: 7,
      body: 'Review complete',
    })

    expect(mockCreateReview).toHaveBeenCalledWith({
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pull_number: 7,
      body: 'Review complete',
      event: 'COMMENT',
    })
  })

  it('should default review event to COMMENT', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({})
    const mockOctokit = {
      rest: {
        pulls: {
          createReview: mockCreateReview,
        },
      },
    }

    await postReview(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pullNumber: 7,
      body: 'test',
    })

    expect(mockCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'COMMENT' }),
    )
  })

  it('should allow specifying review event as APPROVE', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({})
    const mockOctokit = {
      rest: {
        pulls: {
          createReview: mockCreateReview,
        },
      },
    }

    await postReview(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pullNumber: 7,
      body: 'LGTM',
      event: 'APPROVE',
    })

    expect(mockCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'APPROVE' }),
    )
  })

  it('should allow specifying review event as REQUEST_CHANGES', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({})
    const mockOctokit = {
      rest: {
        pulls: {
          createReview: mockCreateReview,
        },
      },
    }

    await postReview(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pullNumber: 7,
      body: 'Please fix this',
      event: 'REQUEST_CHANGES',
    })

    expect(mockCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'REQUEST_CHANGES' }),
    )
  })

  it('should call createReview exactly once', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({})
    const mockOctokit = {
      rest: {
        pulls: {
          createReview: mockCreateReview,
        },
      },
    }

    await postReview(mockOctokit as any, {
      owner: 'FileJunkie',
      repo: 'autovibe-rator',
      pullNumber: 7,
      body: 'test',
    })

    expect(mockCreateReview).toHaveBeenCalledTimes(1)
  })

  it('should propagate errors from octokit', async () => {
    const mockCreateReview = vi.fn().mockRejectedValue(new Error('API error'))
    const mockOctokit = {
      rest: {
        pulls: {
          createReview: mockCreateReview,
        },
      },
    }

    await expect(
      postReview(mockOctokit as any, {
        owner: 'FileJunkie',
        repo: 'autovibe-rator',
        pullNumber: 7,
        body: 'test',
      }),
    ).rejects.toThrow('API error')
  })
})
