'use client'

import Image from 'next/image'

const navItems = ['Shop', 'Services', 'Membership', 'About', 'Contact']

export default function PreviewHeader() {
  return (
    <header className="w-full border-b border-[var(--card-border)] bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[var(--card-border)] bg-white">
            <Image src="/images/logo.png" alt="Gentlegurls" fill className="object-cover" sizes="40px" />
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
            Gentlegurls
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--foreground)] md:flex">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className="cursor-default text-[var(--text-muted)] transition hover:text-[var(--foreground)]"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] bg-white">
            <i className="fa-solid fa-magnifying-glass text-xs" />
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] bg-white">
            <i className="fa-solid fa-bag-shopping text-xs" />
          </span>
        </div>
      </div>
    </header>
  )
}
