'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export type PosModalRemarkFieldHandle = {
  getValue: () => string
  setValue: (value: string) => void
}

type Props = {
  id?: string
  label: string
  defaultValue?: string
  /** Change when the modal re-opens to reset the field (e.g. booking id). */
  resetKey?: string | number
  placeholder?: string
  rows?: number
  className?: string
}

/**
 * Uncontrolled remark field — no React state updates while typing (avoids fighting
 * the POS barcode keydown handler and huge parent re-renders).
 */
const PosModalRemarkField = forwardRef<PosModalRemarkFieldHandle, Props>(function PosModalRemarkField(
  {
    id,
    label,
    defaultValue = '',
    resetKey,
    placeholder,
    rows = 2,
    className = '',
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => textareaRef.current?.value ?? '',
      setValue: (value: string) => {
        if (textareaRef.current) {
          textareaRef.current.value = value
        }
      },
    }),
    [],
  )

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = defaultValue
    }
  }, [resetKey, defaultValue])

  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-semibold text-gray-600">
        {label}
      </label>
      <textarea
        ref={textareaRef}
        id={id}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </div>
  )
})

export default PosModalRemarkField
