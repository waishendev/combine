'use client'

import { forwardRef, memo, useImperativeHandle, useRef } from 'react'

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
 * Uncontrolled remark field isolated from the parent tree.
 *
 * The POS page is very large and can re-render while a modal is open. Keeping
 * this textarea uncontrolled prevents React from re-applying stale values while
 * the cashier is typing quickly; callers read the DOM value only on submit.
 */
const PosModalRemarkField = memo(forwardRef<PosModalRemarkFieldHandle, Props>(function PosModalRemarkField(
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
      getValue: () => textareaRef.current?.value ?? defaultValue,
      setValue: (value: string) => {
        if (textareaRef.current) {
          textareaRef.current.value = value
        }
      },
    }),
    [defaultValue],
  )

  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-semibold text-gray-600">
        {label}
      </label>
      <textarea
        key={resetKey}
        ref={textareaRef}
        id={id}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </div>
  )
}), (prev, next) => (
  prev.id === next.id &&
  prev.label === next.label &&
  prev.defaultValue === next.defaultValue &&
  prev.resetKey === next.resetKey &&
  prev.placeholder === next.placeholder &&
  prev.rows === next.rows &&
  prev.className === next.className
))

PosModalRemarkField.displayName = 'PosModalRemarkField'

export default PosModalRemarkField
