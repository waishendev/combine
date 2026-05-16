'use client'

import { collectApiErrorMessages } from '@/lib/api-errors'

type ApiValidationErrorsProps = {
  /** Raw JSON body from a failed API response */
  payload: unknown
  fallback?: string
  className?: string
}

/**
 * Renders Laravel `errors` (all fields) instead of only `message: "Validation failed"`.
 */
export default function ApiValidationErrors({
  payload,
  fallback = 'Something went wrong.',
  className = 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
}: ApiValidationErrorsProps) {
  const messages = collectApiErrorMessages(payload, { fallback })

  if (messages.length === 0) {
    return null
  }

  if (messages.length === 1) {
    return <div className={`${className} whitespace-pre-line`}>{messages[0]}</div>
  }

  return (
    <div className={className}>
      <ul className="list-disc space-y-1 pl-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )
}
