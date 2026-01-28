'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

import { useI18n } from '@/lib/i18n'

type HeaderProps = {
  onLogout: () => Promise<void> | void
  onToggleSidebar: () => void
  userEmail?: string | null
}

export default function Header({ onLogout, onToggleSidebar, userEmail }: HeaderProps) {
  const { t } = useI18n()
  const [accountOpen, setAccountOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const accountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let abort = false
    const controller = new AbortController()

    const fetchBranding = async () => {
      try {
        const response = await fetch('/api/proxy/ecommerce/branding', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          return
        }

        const payload = await response.json()
        const crmLogo = payload?.data?.crm_logo_url ?? null

        if (!abort) {
          setLogoUrl(crmLogo)
        }
      } catch (error) {
        if (controller.signal.aborted) return
      }
    }

    fetchBranding()

    return () => {
      abort = true
      controller.abort()
    }
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await onLogout()
    } finally {
      setAccountOpen(false)
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white shadow-sm flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4">
        <button
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <i className="fa-solid fa-bars text-lg" />
        </button>
        <div className="flex items-center gap-3">
          <Image
            src={logoUrl || '/images/logo.png'}
            alt="CRM Logo"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
            priority
            onError={() => setLogoUrl(null)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            className="flex items-center gap-3 rounded-full border border-transparent bg-white px-2 py-2 text-left transition hover:bg-slate-100"
          >
            <Image
              src="/images/default_user_image.jpg"
              alt="user avatar"
              width={36}
              height={36}
              className="rounded-full border border-slate-200"
            />
            <p
              className="max-w-[140px] truncate text-sm font-semibold text-slate-700"
              title={userEmail || t('header.account')}
            >
              {userEmail || t('header.account')}
            </p>
            <i className="fa-solid fa-chevron-down text-xs text-slate-400" />
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`flex w-full items-center justify-between px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 ${
                  isLoggingOut ? 'cursor-not-allowed opacity-60' : ''
                }`}
              >
                <span>
                  {isLoggingOut ? `${t('header.logout')}...` : t('header.logout')}
                </span>
                <i className="fa-solid fa-arrow-right-from-bracket text-sm" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
