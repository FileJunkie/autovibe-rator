// Branch names reach shell scripts (the pre-push hook) and git command
// arguments, so they are validated against a conservative whitelist rather
// than git's full refname rules. Anything outside this set is rejected
// before it can reach a shell or a remote.
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/

export function isValidGitBranch(branch: string | undefined | null): boolean {
  if (!branch || branch.length > 200) {
    return false
  }
  if (!BRANCH_RE.test(branch)) {
    return false
  }
  if (branch.includes('..')) {
    return false
  }
  const components = branch.split('/')
  for (const component of components) {
    if (component.endsWith('.lock') || component.endsWith('.lock/')) {
      return false
    }
  }
  return true
}

export function isGitHubRepoUrl(url: string | undefined | null): boolean {
  if (!url) {
    return false
  }
  return /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(\.git)?$/.test(url)
}
