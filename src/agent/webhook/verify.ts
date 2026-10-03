import { createHmac, timingSafeEqual } from 'crypto'

export function verifySignature(
  payload: string | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false
  }

  const expected = 'sha256=' + createHmac('sha256', secret).update(payload || '').digest('hex')

  if (signature.length !== expected.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
