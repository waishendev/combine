'use client'

import { useEffect, useRef, useState } from 'react'

interface MenuOption {
  id: number
  name: string
}

interface MenuSelectorProps {
  menus: MenuOption[]
  selectedMenuIds: number[]
  onSelectionChange: (menuIds: number[]) => void
  disabled?: boolean
  loading?: boolean
}

export default function MenuSelector({
  menus,
  selectedMenuIds,
  onSelectionChange,
  disabled = false,
  loading = false,
}: MenuSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedMenus = menus.filter((menu) => selectedMenuIds.includes(menu.id))
  const availableMenus = menus.filter(
    (menu) =>
      !selectedMenuIds.includes(menu.id) &&
      menu.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleMenuToggle = (menuId: number) => {
    if (selectedMenuIds.includes(menuId)) {
      onSelectionChange(selectedMenuIds.filter((id) => id !== menuId))
    } else {
      onSelectionChange([...selectedMenuIds, menuId])
    }
    setSearchTerm('')
  }

  const handleRemoveMenu = (menuId: number) => {
    onSelectionChange(selectedMenuIds.filter((id) => id !== menuId))
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Menus
      </label>
      
      {/* Combined container with tags and input */}
      <div className="relative border border-gray-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
        {/* Selected menus as tags inside the container */}
        {selectedMenus.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2.5 pb-1.5 border-b border-gray-200">
            {selectedMenus.map((menu) => (
              <span
                key={menu.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md text-sm font-medium shadow-sm transition-colors hover:bg-blue-200"
              >
                <i className="fa-solid fa-check-circle text-xs text-blue-600" />
                <span>{menu.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMenu(menu.id)}
                    className="ml-0.5 text-blue-600 hover:text-blue-900 focus:outline-none transition-colors"
                    aria-label={`Remove ${menu.name}`}
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Input field for dropdown inside the container */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedMenus.length > 0 ? 'Add more menus...' : 'Select menus...'}
            disabled={disabled || loading}
            className="w-full pl-3 pr-10 py-2.5 border-0 rounded-md text-sm focus:outline-none focus:ring-0 disabled:opacity-50 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          >
            <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} text-sm`} />
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && !loading && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {availableMenus.length > 0 ? (
            <ul className="py-1">
              {availableMenus.map((menu) => (
                <li key={menu.id}>
                  <button
                    type="button"
                    onClick={() => handleMenuToggle(menu.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 focus:outline-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <i className="fa-solid fa-plus text-xs text-blue-500" />
                      <span className="font-medium">{menu.name}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-4 text-sm text-gray-500 text-center">
              <i className="fa-solid fa-inbox text-gray-400 mb-1 block" />
              {searchTerm ? 'No menus found' : 'All menus selected'}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
          <i className="fa-solid fa-spinner fa-spin text-sm" />
        </div>
      )}
    </div>
  )
}

