import { describe, it, expect } from 'vitest'
import { stage1Filter } from '../../../src/agent/filter/stage1'

describe('stage1Filter - ping detection', () => {
  const botHandle = 'autovibe-rator'

  it('should pass when @autovibe-rator is in body', () => {
    const result = stage1Filter({
      body: '@autovibe-rator please review this',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should pass when @autovibe-rator[bot] is in body', () => {
    const result = stage1Filter({
      body: '@autovibe-rator[bot] please review',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should pass when ping is in title', () => {
    const result = stage1Filter({
      body: 'some body text',
      title: '@autovibe-rator review this PR',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should pass when ping with [bot] suffix is in title', () => {
    const result = stage1Filter({
      body: 'some body text',
      title: '@autovibe-rator[bot] check this',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should not pass when no ping in body or title', () => {
    const result = stage1Filter({
      body: 'just a regular issue',
      title: 'fix bug',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass when body is empty and no title', () => {
    const result = stage1Filter({
      body: '',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should pass when ping is surrounded by other text', () => {
    const result = stage1Filter({
      body: 'Hey @autovibe-rator can you take a look at this?',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should be case insensitive for the handle', () => {
    const result = stage1Filter({
      body: '@AutoVibe-Rator review this',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should be case insensitive for [bot] suffix', () => {
    const result = stage1Filter({
      body: '@autovibe-rator[BOT] review this',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should not match partial handle (@autovibe-rator-extra)', () => {
    const result = stage1Filter({
      body: '@autovibe-rator-extra is different',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should not match when handle is a substring of a longer mention', () => {
    const result = stage1Filter({
      body: '@autovibe-rators check this',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should pass with custom bot handle', () => {
    const result = stage1Filter({
      body: '@my-reviewer check this',
      authorLogin: 'user1',
      botHandle: 'my-reviewer',
    })
    expect(result.passed).toBe(true)
  })

  it('should pass with custom bot handle and [bot] suffix', () => {
    const result = stage1Filter({
      body: '@my-reviewer[bot] check this',
      authorLogin: 'user1',
      botHandle: 'my-reviewer',
    })
    expect(result.passed).toBe(true)
  })

  it('should match ping at end of body', () => {
    const result = stage1Filter({
      body: 'please review @autovibe-rator',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should match ping at start of body', () => {
    const result = stage1Filter({
      body: '@autovibe-rator please review',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should match ping followed by punctuation', () => {
    const result = stage1Filter({
      body: '@autovibe-rator, please review this',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should match ping followed by period', () => {
    const result = stage1Filter({
      body: 'thanks @autovibe-rator. great work',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })

  it('should match ping followed by newline', () => {
    const result = stage1Filter({
      body: '@autovibe-rator\nplease review',
      authorLogin: 'user1',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })
})

describe('stage1Filter - bot self-filter', () => {
  const botHandle = 'autovibe-rator'

  it('should not pass when author is the bot itself (with [bot] suffix)', () => {
    const result = stage1Filter({
      body: '@autovibe-rator review this',
      authorLogin: 'autovibe-rator[bot]',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass when author login matches bot handle (without [bot])', () => {
    const result = stage1Filter({
      body: '@autovibe-rator review this',
      authorLogin: 'autovibe-rator',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should be case insensitive when checking bot author', () => {
    const result = stage1Filter({
      body: '@autovibe-rator review this',
      authorLogin: 'AutoVibe-Rator[bot]',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should not pass when author is bot even if no ping present', () => {
    const result = stage1Filter({
      body: 'just a comment',
      authorLogin: 'autovibe-rator[bot]',
      botHandle,
    })
    expect(result.passed).toBe(false)
  })

  it('should pass when author is a different bot', () => {
    const result = stage1Filter({
      body: '@autovibe-rator review this',
      authorLogin: 'other-bot[bot]',
      botHandle,
    })
    expect(result.passed).toBe(true)
  })
})

describe('stage1Filter - result shape', () => {
  it('should return a reason string when not passed (no ping)', () => {
    const result = stage1Filter({
      body: 'no ping here',
      authorLogin: 'user1',
      botHandle: 'autovibe-rator',
    })
    expect(result.passed).toBe(false)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('should return a reason string when not passed (bot author)', () => {
    const result = stage1Filter({
      body: '@autovibe-rator review',
      authorLogin: 'autovibe-rator[bot]',
      botHandle: 'autovibe-rator',
    })
    expect(result.passed).toBe(false)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('should return a reason string when passed', () => {
    const result = stage1Filter({
      body: '@autovibe-rator review',
      authorLogin: 'user1',
      botHandle: 'autovibe-rator',
    })
    expect(result.passed).toBe(true)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })
})
