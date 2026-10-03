import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export async function getInstallationOctokit(
  appId: number | string,
  installationId: number | string,
  privateKey: string,
): Promise<Octokit> {
  const numericAppId = Number(appId)
  const numericInstallationId = Number(installationId)

  if (!numericAppId || !numericInstallationId || !privateKey) {
    throw new Error('Invalid credentials: appId, installationId, and privateKey are required')
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: numericAppId,
      installationId: numericInstallationId,
      privateKey,
    },
  })
}

export async function getInstallationToken(
  appId: number | string,
  installationId: number | string,
  privateKey: string,
): Promise<string> {
  const octokit = await getInstallationOctokit(appId, installationId, privateKey)
  const result = await octokit.auth({
    type: 'installation',
    installationId: Number(installationId),
  })
  return (result as { token: string }).token
}

export interface ScopedTokenPermissions {
  contents?: 'read' | 'write'
  issues?: 'read' | 'write'
  pull_requests?: 'read' | 'write'
  metadata?: 'read'
}

/**
 * Mints an installation token restricted to a SUBSET of the app's
 * permissions. Used to hand the sandboxed agent read-only GitHub access
 * without granting it the ability to push.
 */
export async function getScopedInstallationToken(
  appId: number | string,
  installationId: number | string,
  privateKey: string,
  permissions: ScopedTokenPermissions,
): Promise<string> {
  const numericAppId = Number(appId)
  const numericInstallationId = Number(installationId)

  if (!numericAppId || !numericInstallationId || !privateKey) {
    throw new Error('Invalid credentials: appId, installationId, and privateKey are required')
  }

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: numericAppId,
      privateKey,
    },
  })

  const { data } = await octokit.rest.apps.createInstallationAccessToken({
    installation_id: numericInstallationId,
    permissions: permissions as Record<string, string>,
  })
  return data.token
}
