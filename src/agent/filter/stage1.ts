export interface Stage1Input {
  body: string
  title?: string
  authorLogin: string
  botHandle: string
}

export interface FilterResult {
  passed: boolean
  reason: string
}

export function stage1Filter(input: Stage1Input): FilterResult {
  const { body, title, authorLogin, botHandle } = input

  const authorLower = authorLogin.toLowerCase()
  const handleLower = botHandle.toLowerCase()

  if (authorLower === handleLower || authorLower === `${handleLower}[bot]`) {
    return { passed: false, reason: 'Event triggered by bot itself, ignoring' }
  }

  const escaped = botHandle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`@${escaped}(\\[bot\\])?(?![a-zA-Z0-9-])`, 'i')
  const text = `${body || ''} ${title || ''}`

  if (pattern.test(text)) {
    return { passed: true, reason: 'Bot ping detected' }
  }

  return { passed: false, reason: 'No bot ping detected in body or title' }
}
