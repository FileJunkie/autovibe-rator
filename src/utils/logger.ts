export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// RFC 5424 severity values, used as the <PRI> prefix in syslog mode.
const SYSLOG_PRIORITY: Record<LogLevel, number> = {
  debug: 7,
  info: 6,
  warn: 4,
  error: 3,
}

let cachedMinLevel: number | null = null

function resolvedMinLevel(): number {
  if (cachedMinLevel === null) {
    const raw = (process.env.LOG_LEVEL || '').trim().toLowerCase()
    cachedMinLevel = raw in LEVEL_ORDER ? LEVEL_ORDER[raw as LogLevel] : LEVEL_ORDER.info
  }
  return cachedMinLevel
}

function syslogMode(): boolean {
  return (process.env.LOG_FORMAT || '').trim().toLowerCase() === 'syslog'
}

function oneLine(text: string): string {
  return text.replace(/\s+$/, '').replace(/\n/g, '\\n')
}

function formatValue(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function emit(level: LogLevel, component: string, args: unknown[]): void {
  if (LEVEL_ORDER[level] < resolvedMinLevel()) {
    return
  }

  const body = oneLine(
    args.map(formatValue).filter((part) => part.length > 0).join(' '),
  )
  const timestamp = new Date().toISOString()

  if (syslogMode()) {
    // Syslog priority prefix; journald maps <PRI> to the journal priority
    // when the unit uses StandardOutput=journal, and remote syslog
    // forwarders accept the same framing.
    const line = `<${SYSLOG_PRIORITY[level]}>${timestamp} ${component}: ${body}\n`
    process.stdout.write(line)
    return
  }

  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout
  stream.write(`${timestamp} ${level.toUpperCase().padEnd(5)} [${component}] ${body}\n`)
}

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export function createLogger(component: string): Logger {
  return {
    debug: (...args: unknown[]) => emit('debug', component, args),
    info: (...args: unknown[]) => emit('info', component, args),
    warn: (...args: unknown[]) => emit('warn', component, args),
    error: (...args: unknown[]) => emit('error', component, args),
  }
}

export function resetLogConfigForTests(): void {
  cachedMinLevel = null
}
