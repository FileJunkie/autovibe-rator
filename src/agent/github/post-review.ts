import type { Octokit } from '@octokit/rest'

export interface PostReviewParams {
  owner: string
  repo: string
  pullNumber: number
  body: string
  event?: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'
}

export async function postReview(octokit: Octokit, params: PostReviewParams): Promise<void> {
  await octokit.rest.pulls.createReview({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    body: params.body,
    event: params.event || 'COMMENT',
  })
}
