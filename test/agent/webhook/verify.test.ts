import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifySignature } from '../../../src/agent/webhook/verify'

const SECRET = 'test-webhook-secret'

function makeSignature(payload: string, secret: string = SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
}

describe('verifySignature - valid signatures', () => {
  it('should return true for a valid signature', () => {
    const payload = '{"action":"opened"}'
    const signature = makeSignature(payload)
    expect(verifySignature(payload, signature, SECRET)).toBe(true)
  })

  it('should return true for empty payload with valid signature', () => {
    const payload = ''
    const signature = makeSignature(payload)
    expect(verifySignature(payload, signature, SECRET)).toBe(true)
  })

  it('should return true for a large payload with valid signature', () => {
    const payload = JSON.stringify({ data: 'x'.repeat(10000) })
    const signature = makeSignature(payload)
    expect(verifySignature(payload, signature, SECRET)).toBe(true)
  })

  it('should return true for payload with unicode characters', () => {
    const payload = '{"body":"@autovibe-rator review this — émoji 🎉"}'
    const signature = makeSignature(payload)
    expect(verifySignature(payload, signature, SECRET)).toBe(true)
  })
})

describe('verifySignature - invalid signatures', () => {
  it('should return false for wrong signature', () => {
    const payload = '{"action":"opened"}'
    const signature = 'sha256=deadbeef00000000000000000000000000000000000000000000000000000000'
    expect(verifySignature(payload, signature, SECRET)).toBe(false)
  })

  it('should return false for signature with wrong secret', () => {
    const payload = '{"action":"opened"}'
    const signature = makeSignature(payload, 'wrong-secret')
    expect(verifySignature(payload, signature, SECRET)).toBe(false)
  })

  it('should return false for tampered payload', () => {
    const payload = '{"action":"closed"}'
    const signature = makeSignature('{"action":"opened"}')
    expect(verifySignature(payload, signature, SECRET)).toBe(false)
  })

  it('should return false for signature without sha256= prefix', () => {
    const payload = '{"action":"opened"}'
    const hex = createHmac('sha256', SECRET).update(payload).digest('hex')
    expect(verifySignature(payload, hex, SECRET)).toBe(false)
  })

  it('should return false for signature with sha1= prefix', () => {
    const payload = '{"action":"opened"}'
    const hex = createHmac('sha1', SECRET).update(payload).digest('hex')
    const signature = 'sha1=' + hex
    expect(verifySignature(payload, signature, SECRET)).toBe(false)
  })

  it('should return false for empty signature', () => {
    const payload = '{"action":"opened"}'
    expect(verifySignature(payload, '', SECRET)).toBe(false)
  })

  it('should return false for undefined signature', () => {
    const payload = '{"action":"opened"}'
    expect(verifySignature(payload, undefined as unknown as string, SECRET)).toBe(false)
  })

  it('should return false for signature with correct hex but wrong prefix length', () => {
    const payload = '{"action":"opened"}'
    const hex = createHmac('sha256', SECRET).update(payload).digest('hex')
    const truncatedSig = 'sha256=' + hex.slice(0, 32)
    expect(verifySignature(payload, truncatedSig, SECRET)).toBe(false)
  })
})

describe('verifySignature - timing safety', () => {
  it('should not throw for any invalid input', () => {
    expect(() => verifySignature('', '', '')).not.toThrow()
    expect(() => verifySignature('payload', 'sha256=short', 'secret')).not.toThrow()
    expect(() => verifySignature('payload', 'invalid', 'secret')).not.toThrow()
  })
})
