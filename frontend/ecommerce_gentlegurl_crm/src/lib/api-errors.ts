/**
 * Laravel-style validation payload: { errors: { field: string[] } }
 */
export function flattenLaravelValidationErrors(errors: unknown): string | null {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return null
  }

  const messages: string[] = []
  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
          messages.push(item.trim())
        }
      }
    } else if (typeof value === 'string' && value.trim()) {
      messages.push(value.trim())
    }
  }

  if (messages.length === 0) {
    return null
  }

  return [...new Set(messages)].join(' ')
}

export function getApiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') {
    return fallback
  }

  const record = data as { errors?: unknown; error?: unknown; message?: unknown }
  const fromErrors = flattenLaravelValidationErrors(record.errors)
  if (fromErrors) {
    return fromErrors
  }

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim()
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim()
  }

  return fallback
}
