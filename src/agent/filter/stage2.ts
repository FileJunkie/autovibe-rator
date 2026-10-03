export interface Stage2Input {
  eventType: string
  action: string
  repoFullName: string
  repoOwner?: string
  allowedOwners?: string[]
  authorAssociation?: string
  allowedAssociations?: string[]
}

export interface FilterResult {
  passed: boolean
  reason: string
}

const VALID_EVENTS: Record<string, string[]> = {
  issues: ['opened'],
  issue_comment: ['created'],
  pull_request: ['opened', 'synchronize'],
}

export function stage2Filter(input: Stage2Input): FilterResult {
  const { eventType, action, repoFullName, repoOwner, allowedOwners, authorAssociation, allowedAssociations } = input

  // Author gate: GitHub stamps author_association on every user object in
  // webhook payloads, so this costs no API call. Fail closed - an event
  // without a recognizable association is treated as untrusted.
  if (allowedAssociations && allowedAssociations.length > 0) {
    const assoc = (authorAssociation || '').toUpperCase()
    if (!allowedAssociations.includes(assoc)) {
      return { passed: false, reason: `Author association '${authorAssociation || 'unknown'}' is not allowed` }
    }
  }

  // Owner allowlist: gate on the account that owns the repository, so
  // adding a user or org to the list unlocks all of their repos.
  if (allowedOwners && allowedOwners.length > 0) {
    const owner = (repoOwner || repoFullName.split('/')[0] || '').toLowerCase()
    const found = allowedOwners.some((o) => o.toLowerCase() === owner)
    if (!found) {
      return { passed: false, reason: `Repository owner '${owner || 'unknown'}' is not in the allowed owners list` }
    }
  }

  const validActions = VALID_EVENTS[eventType]
  if (!validActions) {
    return { passed: false, reason: `Event type '${eventType}' is not supported` }
  }

  if (!validActions.includes(action)) {
    return { passed: false, reason: `Action '${action}' is not supported for event '${eventType}'` }
  }

  return { passed: true, reason: `Event ${eventType}:${action} is valid` }
}
