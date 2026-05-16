/**
 * Shared Laravel API error formatting for CRM (`{ message, errors: { field: string[] } }`).
 * Use `getApiErrorMessage` / `collectApiErrorMessages` anywhere you handle `!res.ok` JSON bodies.
 */

export type FieldLabelResolver = (fieldKey: string) => string | null

const GENERIC_MESSAGES = new Set([
  'validation failed',
  'server error',
  'unprocessable entity',
])

export function defaultFieldLabelResolver(fieldKey: string): string | null {
  const idsMatch = /^ids\.(\d+)$/.exec(fieldKey)
  if (idsMatch) {
    return `Selection #${Number(idsMatch[1]) + 1}`
  }

  const variantSku = /^variants\.(\d+)\.sku$/.exec(fieldKey)
  if (variantSku) {
    return `Variant row ${Number(variantSku[1]) + 1} (SKU)`
  }

  const variantBarcode = /^variants\.(\d+)\.barcode$/.exec(fieldKey)
  if (variantBarcode) {
    return `Variant row ${Number(variantBarcode[1]) + 1} (Barcode)`
  }

  if (fieldKey === 'sku') return 'Product SKU'
  if (fieldKey === 'slug') return 'Slug'
  if (fieldKey === 'barcode') return 'Barcode'

  return null
}

function pushMessage(messages: string[], message: string) {
  const trimmed = message.trim()
  if (!trimmed) return
  if (!messages.includes(trimmed)) {
    messages.push(trimmed)
  }
}

function formatFieldMessages(
  errors: Record<string, unknown>,
  labelResolver: FieldLabelResolver,
): string[] {
  const messages: string[] = []
  const idsInvalidKeys: string[] = []
  const otherEntries: Array<{ key: string; messages: string[] }> = []

  for (const [key, value] of Object.entries(errors)) {
    if (/^ids\.\d+$/.test(key)) {
      idsInvalidKeys.push(key)
      continue
    }

    const fieldMessages: string[] = []
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
          fieldMessages.push(item.trim())
        }
      }
    } else if (typeof value === 'string' && value.trim()) {
      fieldMessages.push(value.trim())
    }

    if (fieldMessages.length > 0) {
      otherEntries.push({ key, messages: fieldMessages })
    }
  }

  if (idsInvalidKeys.length === 1) {
    const key = idsInvalidKeys[0]
    const value = errors[key]
    const label = labelResolver(key)
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          pushMessage(messages, label ? `${label}: ${item}` : item)
        }
      }
    }
  } else if (idsInvalidKeys.length > 1) {
    pushMessage(
      messages,
      `${idsInvalidKeys.length} selected item(s) are invalid or cannot be processed.`,
    )
  }

  for (const entry of otherEntries) {
    const label = labelResolver(entry.key)
    for (const text of entry.messages) {
      pushMessage(messages, label ? `${label}: ${text}` : text)
    }
  }

  return messages
}

/**
 * Laravel-style validation payload: { errors: { field: string[] } }
 */
export function flattenLaravelValidationErrors(
  errors: unknown,
  labelResolver: FieldLabelResolver = defaultFieldLabelResolver,
): string | null {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return null
  }

  const messages = formatFieldMessages(errors as Record<string, unknown>, labelResolver)
  if (messages.length === 0) {
    return null
  }

  return messages.join('\n')
}

export function collectApiErrorMessages(
  data: unknown,
  options?: {
    fallback?: string
    labelResolver?: FieldLabelResolver
    includeGenericMessage?: boolean
  },
): string[] {
  const labelResolver = options?.labelResolver ?? defaultFieldLabelResolver
  const messages: string[] = []

  if (data && typeof data === 'object') {
    const record = data as {
      errors?: unknown
      error?: unknown
      message?: unknown
      data?: { errors?: unknown }
    }

    if (record.errors && typeof record.errors === 'object' && !Array.isArray(record.errors)) {
      messages.push(...formatFieldMessages(record.errors as Record<string, unknown>, labelResolver))
    }

    const nested = record.data
    if (nested && typeof nested === 'object' && nested.errors && typeof nested.errors === 'object' && !Array.isArray(nested.errors)) {
      messages.push(...formatFieldMessages(nested.errors as Record<string, unknown>, labelResolver))
    }

    if (typeof record.error === 'string' && record.error.trim()) {
      pushMessage(messages, record.error.trim())
    }

    if (options?.includeGenericMessage !== false && typeof record.message === 'string') {
      const apiMessage = record.message.trim()
      const isGeneric = GENERIC_MESSAGES.has(apiMessage.toLowerCase())
      if (apiMessage && (!isGeneric || messages.length === 0)) {
        pushMessage(messages, apiMessage)
      }
    }
  }

  if (messages.length === 0 && options?.fallback) {
    messages.push(options.fallback)
  }

  return messages
}

export function getApiErrorMessage(
  data: unknown,
  fallback: string,
  options?: {
    separator?: string
    labelResolver?: FieldLabelResolver
  },
): string {
  const messages = collectApiErrorMessages(data, {
    fallback,
    labelResolver: options?.labelResolver,
  })

  if (messages.length === 0) {
    return fallback
  }

  return messages.join(options?.separator ?? '\n')
}

export async function getApiErrorMessageFromResponse(
  response: Response,
  fallback: string,
  options?: {
    separator?: string
    labelResolver?: FieldLabelResolver
  },
): Promise<string> {
  const data = await response.json().catch(() => null)
  return getApiErrorMessage(data, fallback, options)
}
