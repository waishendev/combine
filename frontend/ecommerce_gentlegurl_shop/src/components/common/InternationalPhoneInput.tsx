'use client'

import { PhoneInput } from 'react-international-phone'

type InternationalPhoneInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  error?: boolean
}

const preferredCountries = ['my', 'sg', 'id', 'th', 'bn'] as const

const normalizePhoneValue = (phone: string): string => {
  const trimmed = phone.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export default function InternationalPhoneInput({
  value,
  onChange,
  placeholder = 'Phone',
  disabled = false,
  required = false,
  className = '',
  error = false,
}: InternationalPhoneInputProps) {
  const classes = ['gg-international-phone', error ? 'gg-international-phone--error' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <PhoneInput
      value={value ?? ''}
      onChange={(phone) => onChange(normalizePhoneValue(phone))}
      defaultCountry="my"
      preferredCountries={[...preferredCountries]}
      forceDialCode
      disabled={disabled}
      placeholder={placeholder}
      required={required}
      className={classes}
      inputClassName="gg-international-phone__input"
      inputProps={{
        autoComplete: 'tel',
        'aria-invalid': error || undefined,
      }}
    />
  )
}
