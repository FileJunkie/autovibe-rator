import { describe, it, expect } from 'vitest'
import { scrubTokens } from '../../../src/agent/vibe/invoke'

describe('scrubTokens', () => {
  it('should remove the exact agent token from output', () => {
    const token = 'ghs_abcdefghijklmnopqrstuvwx'
    const output = `My token is ${token} and here is more text`

    expect(scrubTokens(output, [token])).not.toContain(token)
    expect(scrubTokens(output, [token])).toContain('[REDACTED]')
  })

  it('should remove known GitHub token patterns even without the exact value', () => {
    const cases = [
      'ghs_abcdefghijklmnopqrstuvwx',
      'ghp_abcdefghijklmnopqrstuvwx',
      'gho_abcdefghijklmnopqrstuvwx',
      'github_pat_abcdefghijklmnopqrstuvwx',
    ]
    for (const value of cases) {
      const result = scrubTokens(`leak ${value} end`, [undefined])
      expect(result).not.toContain(value)
      expect(result).toContain('[REDACTED]')
    }
  })

  it('should leave ordinary text untouched', () => {
    const text = 'Fixed the parser in src/utils/logger.ts. All 124 tests pass.'

    expect(scrubTokens(text, ['ghs_short'])).toBe(text)
  })

  it('should scrub multiple occurrences', () => {
    const token = 'ghs_abcdefghijklmnopqrstuvwx'
    const result = scrubTokens(`${token} mid ${token}`, [token])

    expect(result.split('[REDACTED]')).toHaveLength(3)
  })
})
