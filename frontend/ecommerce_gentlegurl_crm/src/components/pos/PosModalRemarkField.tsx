'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

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
 * Remark field isolated from the parent tree — typing does not update parent state,
 * so large POS pages do not re-render on every keystroke.
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
  const [localValue, setLocalValue] = useState(defaultValue)
  const localValueRef = useRef(localValue)
  localValueRef.current = localValue

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => localValueRef.current,
      setValue: (value: string) => {
        localValueRef.current = value
        setLocalValue(value)
      },
    }),
    [],
  )

  useEffect(() => {
    setLocalValue(defaultValue)
    localValueRef.current = defaultValue
  }, [resetKey, defaultValue])

  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-semibold text-gray-600">
        {label}
      </label>
      <textarea
        id={id}
        value={localValue}
        onChange={(event) => {
          const next = event.target.value
          localValueRef.current = next
          setLocalValue(next)
        }}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </div>
  )
})

export default PosModalRemarkField
