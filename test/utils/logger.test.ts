import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createLogger, resetLogConfigForTests } from '../../src/utils/logger'

function captureStdout(): string[] {
  const chunks: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    chunks.push(String(chunk))
    return true
  })
  return chunks
}

function captureStderr(): string[] {
  const chunks: string[] = []
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    chunks.push(String(chunk))
    return true
  })
  return chunks
}

describe('logger - text format (default)', () => {
  beforeEach(() => {
    resetLogConfigForTests()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('should write an ISO timestamp, level, and component', () => {
    const out = captureStdout()
    const log = createLogger('webhook')

    log.info('event received')

    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO {2}\[webhook\] event received\n$/)
  })

  it('should write warn and error records to stderr', () => {
    const err = captureStderr()
    const out = captureStdout()
    const log = createLogger('vibe')

    log.warn('careful')
    log.error('broken')

    expect(out).toHaveLength(0)
    expect(err).toHaveLength(2)
    expect(err[0]).toContain('WARN')
    expect(err[0]).toContain('careful')
    expect(err[1]).toContain('ERROR')
    expect(err[1]).toContain('broken')
  })

  it('should filter records below LOG_LEVEL', () => {
    vi.stubEnv('LOG_LEVEL', 'warn')
    resetLogConfigForTests()
    const out = captureStdout()
    const log = createLogger('webhook')

    log.debug('hidden')
    log.info('hidden too')

    expect(out).toHaveLength(0)
  })

  it('should collapse newlines so each record is a single line', () => {
    const out = captureStdout()
    const log = createLogger('webhook')

    log.info('line one\nline two')

    expect(out).toHaveLength(1)
    expect(out[0]).not.toContain('\nline two')
    expect(out[0]).toContain('line one\\nline two\n')
  })

  it('should serialize error objects with their stack', () => {
    const err = captureStderr()
    const log = createLogger('webhook')

    log.error('spawn failed', new Error('ENOENT'))

    expect(err[0]).toContain('spawn failed')
    expect(err[0]).toContain('Error: ENOENT')
  })

  it('should serialize non-string values as JSON', () => {
    const out = captureStdout()
    const log = createLogger('webhook')

    log.info('payload', { eventType: 'issues', number: 42 })

    expect(out[0]).toContain('{"eventType":"issues","number":42}')
  })
})

describe('logger - syslog format', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('LOG_FORMAT', 'syslog')
    resetLogConfigForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetLogConfigForTests()
  })

  it('should prefix info records with RFC 5424 priority 6', () => {
    const out = captureStdout()
    const log = createLogger('webhook')

    log.info('event received')

    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/^<6>.*webhook: event received\n$/)
  })

  it('should use the correct priorities for each level', () => {
    const out = captureStdout()
    const err = captureStderr()
    const log = createLogger('vibe')

    log.debug('dbg')
    log.info('inf')
    log.warn('warning')
    log.error('failed')

    // In syslog mode everything goes to stdout so a single channel
    // carries the full stream with priorities. The debug record is
    // filtered by the default LOG_LEVEL=info.
    expect(out.map((l) => l.slice(0, 3))).toEqual(['<6>', '<4>', '<3>'])
    expect(err).toHaveLength(0)
  })
})
