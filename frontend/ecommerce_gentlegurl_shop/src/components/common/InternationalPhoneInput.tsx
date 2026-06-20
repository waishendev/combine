'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CountrySelectorDropdown,
  FlagImage,
  defaultCountries,
  parseCountry,
  usePhoneInput,
} from 'react-international-phone'
import type { CountryData, ParsedCountry } from 'react-international-phone'
import { normalizeInternationalPhone } from '@/lib/phone'

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

const countries = defaultCountries

const normalizeSearch = (value: string) => value.trim().toLowerCase().replace(/^\+/, '')

const countryMatchesSearch = (country: CountryData, searchValue: string) => {
  const parsed = parseCountry(country)
  const query = normalizeSearch(searchValue)

  if (!query) return true

  return (
    parsed.name.toLowerCase().includes(query) ||
    parsed.iso2.toLowerCase().includes(query) ||
    parsed.dialCode.includes(query)
  )
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
  const [showDropdown, setShowDropdown] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { inputValue, country, setCountry, handlePhoneValueChange, inputRef } = usePhoneInput({
    value: value ?? '',
    countries,
    defaultCountry: 'my',
    preferredCountries: [...preferredCountries],
    forceDialCode: true,
    onChange: ({ phone }) => onChange(normalizeInternationalPhone(phone)),
  })

  const classes = ['gg-international-phone', error ? 'gg-international-phone--error' : '', className]
    .filter(Boolean)
    .join(' ')

  const filteredCountries = useMemo(
    () => countries.filter((item) => countryMatchesSearch(item, countrySearch)),
    [countrySearch],
  )

  const openDropdown = useCallback(() => {
    if (disabled) return
    setShowDropdown((current) => !current)
    setCountrySearch('')
    window.setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [disabled])


  useEffect(() => {
    if (!showDropdown) return

    const closeOnOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (target && dropdownRef.current?.contains(target)) return
      setShowDropdown(false)
    }

    document.addEventListener('mousedown', closeOnOutsidePointer)
    document.addEventListener('touchstart', closeOnOutsidePointer)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer)
      document.removeEventListener('touchstart', closeOnOutsidePointer)
    }
  }, [showDropdown])

  const handleCountrySelect = useCallback(
    (selectedCountry: ParsedCountry) => {
      setCountry(selectedCountry.iso2, { focusOnInput: true })
      setShowDropdown(false)
      setCountrySearch('')
    },
    [setCountry],
  )

  return (
    <div className={classes}>
      <div className="gg-international-phone__country-selector">
        <button
          type="button"
          className="react-international-phone-country-selector-button"
          onClick={openDropdown}
          onMouseDown={(event) => event.preventDefault()}
          disabled={disabled}
          role="combobox"
          aria-label="Country selector"
          aria-haspopup="listbox"
          aria-controls="gg-international-phone-country-list"
          aria-expanded={showDropdown}
          title={country?.name}
        >
          <div className="react-international-phone-country-selector-button__button-content">
            <FlagImage iso2={country?.iso2} className="react-international-phone-country-selector-button__flag-emoji" />
            <div
              className={`react-international-phone-country-selector-button__dropdown-arrow${
                showDropdown ? ' react-international-phone-country-selector-button__dropdown-arrow--active' : ''
              }`}
            />
          </div>
        </button>

        {showDropdown ? (
          <div ref={dropdownRef} id="gg-international-phone-country-list" className="gg-international-phone__dropdown" onMouseDown={(event) => event.preventDefault()}>
            <div className="gg-international-phone__search-wrapper">
              <input
                ref={searchInputRef}
                className="gg-international-phone__search"
                value={countrySearch}
                onChange={(event) => setCountrySearch(event.target.value)}
                placeholder="Search country, code, or +60"
                aria-label="Search countries"
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setShowDropdown(false)
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    const list = event.currentTarget
                      .closest('.gg-international-phone__dropdown')
                      ?.querySelector('ul') as HTMLUListElement | null
                    list?.focus()
                  }
                }}
              />
            </div>
            {filteredCountries.length > 0 ? (
              <CountrySelectorDropdown
                show
                countries={filteredCountries}
                preferredCountries={countrySearch ? [] : [...preferredCountries]}
                selectedCountry={country?.iso2 ?? 'my'}
                onSelect={handleCountrySelect}
                onClose={() => setShowDropdown(false)}
              />
            ) : (
              <div className="gg-international-phone__no-results">No countries found</div>
            )}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        className="react-international-phone-input gg-international-phone__input"
        type="tel"
        value={inputValue}
        onChange={handlePhoneValueChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="tel"
        aria-invalid={error || undefined}
      />
    </div>
  )
}
