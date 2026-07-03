'use client'

import { useEffect, useRef } from 'react'

import ErrorBox from './ErrorBox'

type Props = {
  error: string | null
  className?: string
}

/** Shows form errors at the top and scrolls them into view when `error` is set (e.g. after Save). */
export default function FormErrorAnchor({ error, className = 'mb-4' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!error) return
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [error])

  if (!error) return null

  return (
    <div ref={ref} tabIndex={-1} className={`outline-none scroll-mt-4 ${className}`} role="alert">
      <ErrorBox error={error} />
    </div>
  )
}
