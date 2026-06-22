export function formatDateTime12Hour(value?: string | null, timeZone?: string): string {
  if (!value?.trim()) return ''

  const trimmed = value.trim()
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2})[ T]/, '$1T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

export function formatTime12Hour(value?: string | null): string {
  if (!value?.trim()) return ''

  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return trimmed

  const hours = Number(match[1])
  const minutes = match[2]
  if (!Number.isFinite(hours) || hours < 0 || hours > 23) return trimmed

  const period = hours >= 12 ? 'pm' : 'am'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${period}`
}
