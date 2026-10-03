import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOctokitInstance = {
  rest: {
    issues: {},
    pulls: {},
  },
}

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokitInstance),
}))

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}))

import { getInstallationOctokit } from '../../src/utils/github-auth'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

describe('getInstallationOctokit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return an Octokit instance', async () => {
    const result = await getInstallationOctokit(123, 456, 'private-key-content')
    expect(result).toBeDefined()
    expect(result).toBe(mockOctokitInstance)
  })

  it('should pass appId, installationId, and privateKey to Octokit via auth', async () => {
    await getInstallationOctokit(123, 456, 'private-key-content')

    expect(Octokit).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          appId: 123,
          installationId: 456,
          privateKey: 'private-key-content',
        }),
      }),
    )
  })

  it('should use createAppAuth as the auth strategy', async () => {
    await getInstallationOctokit(123, 456, 'private-key-content')

    expect(Octokit).toHaveBeenCalledWith(
      expect.objectContaining({
        authStrategy: createAppAuth,
      }),
    )
  })

  it('should throw if appId is 0', async () => {
    await expect(getInstallationOctokit(0, 456, 'key')).rejects.toThrow()
  })

  it('should throw if installationId is 0', async () => {
    await expect(getInstallationOctokit(123, 0, 'key')).rejects.toThrow()
  })

  it('should throw if privateKey is empty string', async () => {
    await expect(getInstallationOctokit(123, 456, '')).rejects.toThrow()
  })

  it('should accept numeric string IDs and convert them', async () => {
    const result = await getInstallationOctokit('123' as any, '456' as any, 'key')
    expect(result).toBeDefined()
    expect(Octokit).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({
          appId: 123,
          installationId: 456,
        }),
      }),
    )
  })
})
