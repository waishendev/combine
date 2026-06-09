import { defaultCountries, parseCountry } from 'react-international-phone'

const countryDialCodes = new Set(
  defaultCountries
    .map((country) => parseCountry(country).dialCode)
    .filter((dialCode): dialCode is string => Boolean(dialCode)),
)

export function normalizeInternationalPhone(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  if (countryDialCodes.has(digits)) return ''

  return trimmed.startsWith('+') ? `+${digits}` : digits
}
