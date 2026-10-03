import type { Octokit } from '@octokit/rest'

export interface PostCommentParams {
  owner: string
  repo: string
  issueNumber: number
  body: string
}

export async function postComment(octokit: Octokit, params: PostCommentParams): Promise<void> {
  await octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.issueNumber,
    body: params.body,
  })
}
