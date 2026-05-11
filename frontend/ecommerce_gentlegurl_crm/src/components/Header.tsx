'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

import { useI18n } from '@/lib/i18n'
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher'

type HeaderProps = {
  onLogout: () => Promise<void> | void
  onToggleSidebar: () => void
  userEmail?: string | null
  permissions?: string[]
}

export default function Header({ onLogout, onToggleSidebar, userEmail, permissions = [] }: HeaderProps) {
  const { t } = useI18n()
  const [accountOpen, setAccountOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const storageKey = 'branding.crm_logo_url'
  // 在初始状态时就从 sessionStorage 同步读取，避免初始为 null 导致的闪烁
  const getInitialLogoUrl = (): string | null => {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(storageKey)
  }
  const [logoUrl, setLogoUrl] = useState<string | null>(getInitialLogoUrl())
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

  const loadBranding = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/proxy/ecommerce/branding?ts=${Date.now()}`, {
        cache: 'no-store',
        signal,
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json()
      const crmLogo = payload?.data?.crm_logo_url ?? null

      setLogoUrl(crmLogo)
      if (typeof window !== 'undefined' && crmLogo) {
        window.sessionStorage.setItem(storageKey, crmLogo)
      }
    } catch (error) {
      if (signal?.aborted) return
    }
  }

  useEffect(() => {
    let abort = false
    const controller = new AbortController()
    if (typeof window !== 'undefined') {
      const cachedLogo = window.sessionStorage.getItem(storageKey)
      if (cachedLogo) {
        setLogoUrl(cachedLogo)
      }
    }
    loadBranding(controller.signal)

    const handleBrandingUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ logoKey?: string; logoUrl?: string | null }>).detail
      if (detail?.logoKey === 'crm_logo_url' && detail.logoUrl) {
        setLogoUrl(detail.logoUrl)
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(storageKey, detail.logoUrl)
        }
        return
      }
      if (!abort) {
        loadBranding(controller.signal)
      }
    }
    window.addEventListener('branding:updated', handleBrandingUpdate)

    return () => {
      abort = true
      controller.abort()
      window.removeEventListener('branding:updated', handleBrandingUpdate)
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
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center gap-2 border-b border-slate-100/80 bg-white px-2 shadow-sm sm:gap-3 sm:px-4 md:px-6">
      <div className="relative z-[1] flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          aria-label="Toggle sidebar"
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <i className="fa-solid fa-bars text-lg" />
        </button>
        <div className="flex h-7 w-[72px] shrink-0 items-center justify-center sm:h-8 sm:w-[120px]">
          <Image
            src={logoUrl || '/images/logo.png'}
            alt="CRM Logo"
            width={120}
            height={40}
            className="h-full w-auto max-w-[72px] object-contain sm:max-w-[120px]"
            priority
            onError={() => setLogoUrl(null)}
          />
        </div>
      </div>

      <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 items-center justify-end gap-1 sm:gap-3">
        <div className="min-w-0 flex-1 overflow-visible sm:overflow-hidden lg:flex-none lg:overflow-visible">
          <div
            className="-mr-1 flex touch-pan-x justify-end overflow-visible py-0.5 pl-1 sm:overflow-x-auto sm:overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:mr-0 lg:overflow-visible lg:py-0 sm:[&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <WorkspaceSwitcher permissions={permissions} />
          </div>
        </div>

        <div className="relative shrink-0" ref={accountRef}>
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            className="flex touch-manipulation items-center gap-1.5 rounded-full border border-transparent bg-white px-1 py-1.5 text-left transition hover:bg-slate-100 sm:gap-3 sm:px-2 sm:py-2"
          >
            <Image
              src="/images/default_user_image.jpg"
              alt="user avatar"
              width={36}
              height={36}
              className="h-8 w-8 shrink-0 rounded-full border border-slate-200 sm:h-9 sm:w-9"
            />
            <p
              className="hidden max-w-[120px] truncate text-sm font-semibold text-slate-700 md:block lg:max-w-[160px]"
              title={userEmail || t('header.account')}
            >
              {userEmail || t('header.account')}
            </p>
            <i className="fa-solid fa-chevron-down text-xs text-slate-400" />
          </button>
          {accountOpen && (
            <div className="absolute right-0 z-[110] mt-2 w-52 max-w-[calc(100vw-1rem)] rounded-xl border border-slate-200 bg-white py-2 shadow-lg sm:max-w-none sm:w-48">
              {userEmail ? (
                <div className="border-b border-slate-100 px-4 py-2 md:hidden">
                  <p className="truncate text-xs font-medium text-slate-700" title={userEmail}>
                    {userEmail}
                  </p>
                </div>
              ) : null}
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
