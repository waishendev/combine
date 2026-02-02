'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

type HomepageShopMenuItem = {
  id: number
  label: string
  slug: string
  sort_order: number
}

type HomepageServicesMenuItem = HomepageShopMenuItem

type HomepageData = {
  shop_menu: HomepageShopMenuItem[]
  services_menu?: HomepageServicesMenuItem[]
  shop_logo_url?: string | null
}

type PreviewMode = 'desktop' | 'mobile'

type PreviewHeaderProps = {
  mode: PreviewMode
}

export default function PreviewHeader({ mode }: PreviewHeaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [shopMenu, setShopMenu] = useState<HomepageShopMenuItem[]>([])
  const [servicesMenu, setServicesMenu] = useState<HomepageServicesMenuItem[]>([])
  const [shopOpen, setShopOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(false)
  const fallbackLogo = '/images/logo.png'
  const resolvedLogoUrl = logoUrl || fallbackLogo
  const hasShopMenu = shopMenu.length > 0
  const hasServicesMenu = servicesMenu.length > 0

  useEffect(() => {
    const loadHomepage = async () => {
      try {
        const response = await fetch(`/api/proxy/public/shop/homepage?ts=${Date.now()}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const json = await response.json()
        const payload = (json.data as HomepageData) ?? null

        if (payload) {
          setLogoUrl(payload.shop_logo_url ?? null)
          setShopMenu(payload.shop_menu ?? [])
          setServicesMenu(payload.services_menu ?? [])
        }
      } catch (error) {
        console.error('[PreviewHeader] Failed to load homepage:', error)
      }
    }

    loadHomepage()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-menu]')) {
        setShopOpen(false)
        setServicesOpen(false)
        setMembershipOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Desktop: Logo + Navigation */}
        <div className={`flex items-center gap-6 ${mode === 'mobile' ? 'hidden' : ''}`}>
          {/* Logo - Desktop */}
          <a href="#" className="flex items-center h-8 w-[120px] shrink-0">
            <Image
              src={resolvedLogoUrl}
              alt="Gentlegurl Shop"
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </a>

          {/* Desktop Navigation */}
          <nav className="flex gap-6 text-sm text-[var(--foreground)]/80">
            <a href="#" className="transition-colors hover:text-[var(--accent-strong)]">
              Home
            </a>

            {/* SHOP + Dropdown */}
            <div className="relative" data-menu>
              {hasShopMenu ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShopOpen((prev) => !prev)
                      setServicesOpen(false)
                    }}
                    className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
                  >
                    <span>Shop</span>
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {shopOpen && (
                    <div className="absolute left-0 z-20 mt-2 w-56 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                      <a
                        href="#"
                        className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                        onClick={() => setShopOpen(false)}
                      >
                        All Products
                      </a>

                      <div className="my-1 border-t border-[var(--muted)]" />

                      {shopMenu
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((item) => (
                          <a
                            key={item.id}
                            href="#"
                            className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                            onClick={() => setShopOpen(false)}
                          >
                            {item.label}
                          </a>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <a
                  href="#"
                  className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
                >
                  Shop
                </a>
              )}
            </div>

            {/* Services & Courses Dropdown */}
            {hasServicesMenu && (
              <div className="relative" data-menu>
                <button
                  type="button"
                  onClick={() => {
                    setServicesOpen((prev) => !prev)
                    setShopOpen(false)
                  }}
                  className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
                >
                  <span>Services & Courses</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {servicesOpen && (
                  <div className="absolute left-0 z-20 mt-2 w-64 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                    {servicesMenu.map((item) => (
                      <a
                        key={item.id}
                        href="#"
                        className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                        onClick={() => setServicesOpen(false)}
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Membership Dropdown */}
            <div className="relative" data-menu>
              <button
                type="button"
                onClick={() => {
                  setMembershipOpen((prev) => !prev)
                  setShopOpen(false)
                  setServicesOpen(false)
                }}
                className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
              >
                <span>Membership</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {membershipOpen && (
                <div className="absolute left-0 z-20 mt-2 w-56 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                    onClick={() => setMembershipOpen(false)}
                  >
                    Membership Tiers
                  </a>
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                    onClick={() => setMembershipOpen(false)}
                  >
                    Rewards Center
                  </a>
                </div>
              )}
            </div>

            <a href="#" className="transition-colors hover:text-[var(--accent-strong)]">
              Tracking
            </a>
            <a href="#" className="transition-colors hover:text-[var(--accent-strong)]">
              Store Reviews
            </a>
          </nav>
        </div>

        {/* Desktop: Right Side Actions */}
        <div className={`flex items-center gap-4 ${mode === 'mobile' ? 'hidden' : ''}`}>
          <button
            type="button"
            className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
            aria-label="Open search"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </button>

          {/* Wishlist - Desktop */}
          <a
            href="#"
            className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </a>

          {/* Cart - Desktop */}
          <a
            href="#"
            className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </a>
        </div>

        {/* Mobile: Hamburger + Logo + Icons */}
        <div className={`flex w-full items-center gap-4 ${mode === 'desktop' ? 'hidden' : ''}`}>
          {/* Hamburger Menu Button */}
          <button
            type="button"
            className="flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Logo - Mobile */}
          <a href="#" className="flex items-center h-7 w-[120px] shrink-0">
            <Image
              src={resolvedLogoUrl}
              alt="Gentlegurl Shop"
              width={120}
              height={40}
              className="h-7 w-auto object-contain"
              priority
            />
          </a>

          {/* Mobile Right Side: Icons */}
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
              aria-label="Open search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>

            {/* Mobile Wishlist */}
            <a
              href="#"
              className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
              aria-label="Wishlist"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </a>

            {/* Mobile Cart */}
            <a
              href="#"
              className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
