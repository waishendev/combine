'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  defaultCountries,
  FlagImage,
  parseCountry,
  usePhoneInput,
  type CountryData,
  type ParsedCountry,
} from 'react-international-phone'
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

type DropdownPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const preferredCountries = ['my', 'sg', 'id', 'th', 'bn'] as const
const DROPDOWN_GAP = 4
const DROPDOWN_SEARCH_HEIGHT = 49
const DROPDOWN_Z_INDEX = 9999

function matchesCountrySearch(country: ParsedCountry, query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/^\+/, '')
  if (!normalized) return true

  return (
    country.name.toLowerCase().includes(normalized) ||
    country.iso2.toLowerCase().includes(normalized) ||
    country.dialCode.includes(normalized)
  )
}

function buildCountryList(
  countries: CountryData[],
  preferred: readonly string[],
): ParsedCountry[] {
  const preferredSet = new Set(preferred)
  const preferredList: ParsedCountry[] = []
  const otherList: ParsedCountry[] = []

  for (const entry of countries) {
    const parsed = parseCountry(entry)
    if (preferredSet.has(parsed.iso2)) {
      preferredList.push(parsed)
    } else {
      otherList.push(parsed)
    }
  }

  preferredList.sort(
    (a, b) =>
      preferred.indexOf(a.iso2 as (typeof preferredCountries)[number]) -
      preferred.indexOf(b.iso2 as (typeof preferredCountries)[number]),
  )

  return [...preferredList, ...otherList]
}

function getDropdownPosition(container: HTMLElement): DropdownPosition {
  const rect = container.getBoundingClientRect()
  const viewportPadding = 8
  const preferredMaxHeight = 280
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
  const spaceAbove = rect.top - viewportPadding
  const openBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove
  const availableSpace = openBelow ? spaceBelow - DROPDOWN_GAP : spaceAbove - DROPDOWN_GAP
  const maxHeight = Math.max(160, Math.min(preferredMaxHeight, availableSpace))

  return {
    left: rect.left,
    width: rect.width,
    top: openBelow ? rect.bottom + DROPDOWN_GAP : rect.top - DROPDOWN_GAP - maxHeight,
    maxHeight,
  }
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const { inputValue, handlePhoneValueChange, inputRef, country, setCountry } = usePhoneInput({
    defaultCountry: 'my',
    value: value ?? '',
    countries: defaultCountries,
    forceDialCode: true,
    onChange: (data) => onChange(normalizeInternationalPhone(data.phone)),
  })

  const allCountries = useMemo(
    () => buildCountryList(defaultCountries, preferredCountries),
    [],
  )

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return allCountries
    return allCountries.filter((entry) => matchesCountrySearch(entry, searchQuery))
  }, [allCountries, searchQuery])

  const classes = ['gg-international-phone', error ? 'gg-international-phone--error' : '', className]
    .filter(Boolean)
    .join(' ')

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false)
    setSearchQuery('')
    setDropdownPosition(null)
  }, [])

  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return
    setDropdownPosition(getDropdownPosition(containerRef.current))
  }, [])

  const openDropdown = useCallback(() => {
    if (disabled) return
    setDropdownOpen(true)
    setSearchQuery('')
    updateDropdownPosition()
  }, [disabled, updateDropdownPosition])

  const selectCountry = useCallback(
    (entry: ParsedCountry) => {
      setCountry(entry.iso2, { focusOnInput: true })
      closeDropdown()
    },
    [setCountry, closeDropdown],
  )

  useEffect(() => {
    if (!dropdownOpen) return

    updateDropdownPosition()

    const handleReposition = () => updateDropdownPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [dropdownOpen, updateDropdownPosition])

  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return
      }
      closeDropdown()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen, closeDropdown])

  useEffect(() => {
    if (dropdownOpen) {
      searchRef.current?.focus()
    }
  }, [dropdownOpen])

  const isSearching = searchQuery.trim().length > 0
  const preferredDividerIndex = preferredCountries.length - 1
  const listMaxHeight = dropdownPosition
    ? Math.max(120, dropdownPosition.maxHeight - DROPDOWN_SEARCH_HEIGHT)
    : 220

  const dropdownContent =
    dropdownOpen && dropdownPosition ? (
      <div
        ref={dropdownRef}
        className="gg-phone-country-dropdown gg-phone-country-dropdown--portal"
        style={{
          position: 'fixed',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          zIndex: DROPDOWN_Z_INDEX,
        }}
      >
        <div className="gg-phone-country-dropdown__search-wrap">
          <input
            ref={searchRef}
            type="text"
            className="gg-phone-country-dropdown__search"
            placeholder="Search country or dial code"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeDropdown()
            }}
          />
        </div>
        <ul
          role="listbox"
          className="gg-phone-country-dropdown__list"
          style={{ maxHeight: listMaxHeight }}
        >
          {filteredCountries.length === 0 ? (
            <li className="gg-phone-country-dropdown__empty">No countries found</li>
          ) : (
            filteredCountries.map((entry, index) => {
              const isPreferred = preferredCountries.includes(
                entry.iso2 as (typeof preferredCountries)[number],
              )
              const showDivider =
                !isSearching &&
                isPreferred &&
                index === preferredDividerIndex &&
                filteredCountries.length > preferredCountries.length
              const isSelected = entry.iso2 === country.iso2

              return (
                <li key={entry.iso2}>
                  {showDivider && (
                    <hr className="react-international-phone-country-selector-dropdown__preferred-list-divider" />
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      'react-international-phone-country-selector-dropdown__list-item',
                      isSelected
                        ? 'react-international-phone-country-selector-dropdown__list-item--selected'
                        : '',
                      isPreferred && !isSearching
                        ? 'react-international-phone-country-selector-dropdown__list-item--preferred'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectCountry(entry)}
                  >
                    <FlagImage
                      iso2={entry.iso2}
                      className="react-international-phone-country-selector-dropdown__list-item-flag-emoji"
                    />
                    <span className="react-international-phone-country-selector-dropdown__list-item-country-name">
                      {entry.name}
                    </span>
                    <span className="react-international-phone-country-selector-dropdown__list-item-dial-code">
                      +{entry.dialCode}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    ) : null

  return (
    <div ref={containerRef} className={classes}>
      <div className="react-international-phone-input-container">
        <div className="react-international-phone-country-selector">
          <button
            type="button"
            className="react-international-phone-country-selector-button"
            onClick={() => (dropdownOpen ? closeDropdown() : openDropdown())}
            onMouseDown={(event) => event.preventDefault()}
            disabled={disabled}
            aria-label="Country selector"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <div className="react-international-phone-country-selector-button__button-content">
              <FlagImage
                iso2={country.iso2}
                className="react-international-phone-country-selector-button__flag-emoji"
              />
              <div
                className={[
                  'react-international-phone-country-selector-button__dropdown-arrow',
                  dropdownOpen
                    ? 'react-international-phone-country-selector-button__dropdown-arrow--active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </div>
          </button>
        </div>

        <input
          ref={inputRef}
          type="tel"
          className="react-international-phone-input gg-international-phone__input"
          value={inputValue}
          onChange={handlePhoneValueChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="tel"
          aria-invalid={error || undefined}
        />
      </div>

      {typeof document !== 'undefined' && dropdownContent
        ? createPortal(dropdownContent, document.body)
        : null}
    </div>
  )
}
