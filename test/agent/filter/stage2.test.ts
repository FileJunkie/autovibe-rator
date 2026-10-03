import { describe, it, expect } from 'vitest'
import { stage2Filter } from '../../../src/agent/filter/stage2'

describe('stage2Filter - valid event actions', () => {
  const repoFullName = 'FileJunkie/autovibe-rator'

  it('should pass for issues:opened', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName,
    })
    expect(result.passed).toBe(true)
  })

  it('should pass for issue_comment:created', () => {
    const result = stage2Filter({
      eventType: 'issue_comment',
      action: 'created',
      repoFullName,
    })
    expect(result.passed).toBe(true)
  })

  it('should pass for pull_request:opened', () => {
    const result = stage2Filter({
      eventType: 'pull_request',
      action: 'opened',
      repoFullName,
    })
    expect(result.passed).toBe(true)
  })

  it('should pass for pull_request:synchronize', () => {
    const result = stage2Filter({
      eventType: 'pull_request',
      action: 'synchronize',
      repoFullName,
    })
    expect(result.passed).toBe(true)
  })
})

describe('stage2Filter - invalid event actions', () => {
  const repoFullName = 'FileJunkie/autovibe-rator'

  it('should not pass for issues:closed', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'closed',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for issues:edited', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'edited',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for issue_comment:deleted', () => {
    const result = stage2Filter({
      eventType: 'issue_comment',
      action: 'deleted',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for issue_comment:edited', () => {
    const result = stage2Filter({
      eventType: 'issue_comment',
      action: 'edited',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for pull_request:closed', () => {
    const result = stage2Filter({
      eventType: 'pull_request',
      action: 'closed',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for pull_request:edited', () => {
    const result = stage2Filter({
      eventType: 'pull_request',
      action: 'edited',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })
})

describe('stage2Filter - unknown event types', () => {
  const repoFullName = 'FileJunkie/autovibe-rator'

  it('should not pass for push events', () => {
    const result = stage2Filter({
      eventType: 'push',
      action: '',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for star events', () => {
    const result = stage2Filter({
      eventType: 'star',
      action: 'created',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for unknown event type', () => {
    const result = stage2Filter({
      eventType: 'some_random_event',
      action: 'opened',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass for empty event type', () => {
    const result = stage2Filter({
      eventType: '',
      action: 'opened',
      repoFullName,
    })
    expect(result.passed).toBe(false)
  })
})

describe('stage2Filter - owner allowlist (optional)', () => {
  it('should pass when allowedOwners is empty array (allow all)', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'FileJunkie/autovibe-rator',
      allowedOwners: [],
    })
    expect(result.passed).toBe(true)
  })

  it('should pass when allowedOwners is undefined (allow all)', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'FileJunkie/autovibe-rator',
    })
    expect(result.passed).toBe(true)
  })

  it('should pass any repo owned by an allowed owner', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'FileJunkie/some-random-repo',
      repoOwner: 'FileJunkie',
      allowedOwners: ['FileJunkie', 'some-org'],
    })
    expect(result.passed).toBe(true)
  })

  it('should not pass when the repo owner is not allowed', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'Stranger/autovibe-rator',
      repoOwner: 'Stranger',
      allowedOwners: ['FileJunkie'],
    })
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('not in the allowed owners list')
  })

  it('should derive the owner from the full name when repoOwner is missing', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'filejunkie/autovibe-rator',
      allowedOwners: ['FileJunkie'],
    })
    expect(result.passed).toBe(true)
  })

  it('should be case insensitive for owner names in whitelist', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'FileJunkie/autovibe-rator',
      repoOwner: 'FILEJUNKIE',
      allowedOwners: ['filejunkie'],
    })
    expect(result.passed).toBe(true)
  })
})

describe('stage2Filter - author association gate', () => {
  const repoFullName = 'FileJunkie/autovibe-rator'

  it.each(['OWNER', 'MEMBER', 'COLLABORATOR'])('should pass for association %s', (association) => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName,
      authorAssociation: association,
      allowedAssociations: ['OWNER', 'MEMBER', 'COLLABORATOR'],
    })
    expect(result.passed).toBe(true)
  })

  it.each(['NONE', 'FIRST_TIME_CONTRIBUTOR', 'CONTRIBUTOR', 'first_timer', '', undefined])(
    'should not pass for association %s',
    (association) => {
      const result = stage2Filter({
        eventType: 'issue_comment',
        action: 'created',
        repoFullName,
        authorAssociation: association,
        allowedAssociations: ['OWNER', 'MEMBER', 'COLLABORATOR'],
      })
      expect(result.passed).toBe(false)
      expect(result.reason).toContain('not allowed')
    },
  )

  it('should treat a missing association as untrusted (fail closed)', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName,
      allowedAssociations: ['OWNER'],
    })
    expect(result.passed).toBe(false)
  })

  it('should skip the gate when no allowedAssociations is configured', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName,
      authorAssociation: 'NONE',
    })
    expect(result.passed).toBe(true)
  })

  it('should match associations case-insensitively', () => {
    const result = stage2Filter({
      eventType: 'pull_request',
      action: 'opened',
      repoFullName,
      authorAssociation: 'owner',
      allowedAssociations: ['OWNER'],
    })
    expect(result.passed).toBe(true)
  })
})

describe('stage2Filter - result shape', () => {
  it('should return a reason string when not passed', () => {
    const result = stage2Filter({
      eventType: 'push',
      action: '',
      repoFullName: 'FileJunkie/autovibe-rator',
    })
    expect(result.passed).toBe(false)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('should return a reason string when passed', () => {
    const result = stage2Filter({
      eventType: 'issues',
      action: 'opened',
      repoFullName: 'FileJunkie/autovibe-rator',
    })
    expect(result.passed).toBe(true)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })
})
