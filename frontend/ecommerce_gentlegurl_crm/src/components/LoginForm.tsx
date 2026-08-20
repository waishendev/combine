'use client'

import { FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from '@/lib/api'
import { setLoginPortal } from '@/lib/login-portal'
import { getWorkspace, getWorkspaceLanding, setWorkspace, type Workspace } from '@/lib/workspace'

type MePayload = {
  data?: {
    staff_id?: number | null
    permissions?: string[]
    roles?: string[]
  }
}

type LoginFormProps = {
  variant: 'admin' | 'staff'
}

/** Matches AdminSeeder role name `Admin` (case-insensitive). */
function hasAdminRoleName(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false
  return roles.some((r) => typeof r === 'string' && r.toLowerCase() === 'admin')
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      return 'CORS错误：无法连接到后端服务器。请检查后端CORS配置是否允许来自 http://localhost:3000 的请求，并确保允许 credentials。'
    }
    return err.message || 'Login failed'
  }
  return 'Login failed'
}

async function completeSessionAndNavigate(
  router: ReturnType<typeof useRouter>,
  portal: 'admin' | 'staff',
  workspace: Workspace,
  options?: { preferPosForAdminRoleFromHub?: boolean },
) {
  setLoginPortal(portal)

  if (options?.preferPosForAdminRoleFromHub && portal === 'admin') {
    try {
      const me = await apiFetch<MePayload>('/api/me')
      const permissions = Array.isArray(me?.data?.permissions) ? me.data.permissions : []
      if (hasAdminRoleName(me?.data?.roles) && permissions.includes('pos.checkout')) {
        setWorkspace(workspace)
        router.refresh()
        router.replace('/pos')
        return
      }
    } catch {
      // fall through to default landing
    }
  }

  let landing = getWorkspaceLanding(workspace)

  if (portal === 'staff') {
    landing = '/my-sales'
  } else if (workspace === 'booking') {
    try {
      const me = await apiFetch<MePayload>('/api/me')
      const staffId = me?.data?.staff_id ?? null
      const permissions = Array.isArray(me?.data?.permissions) ? me.data.permissions : []

      if (staffId) {
        landing = '/my-sales'
      } else if (permissions.includes('booking.appointments.view')) {
        landing = '/booking/appointment-history'
      } else {
        landing = '/dashboard'
      }
    } catch {
      landing = '/dashboard'
    }
  }

  setWorkspace(workspace)
  router.refresh()
  router.replace(landing)
}

const fieldClass =
  'h-12 w-full rounded-xl border border-white/80 bg-white/80 pl-11 pr-4 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-neutral-500 focus:border-white focus:bg-white focus:ring-4 focus:ring-white/50 disabled:cursor-not-allowed disabled:opacity-60'

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M3 3l18 18" strokeLinecap="round" />
        <path d="M10.6 10.6A2 2 0 0013.4 13.4" strokeLinecap="round" />
        <path
          d="M9.9 5.2A10.8 10.8 0 0112 5c5.5 0 9.5 4.5 10.5 7-.4 1-1.2 2.3-2.3 3.5M6.1 6.1C3.9 7.7 2.4 9.9 1.5 12c1 2.5 5 7 10.5 7 1.4 0 2.7-.3 3.9-.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  )
}

function SegmentedOption<T extends string>({
  value,
  selected,
  label,
  onSelect,
  name,
}: {
  value: T
  selected: boolean
  label: string
  onSelect: (value: T) => void
  name: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      name={name}
      onClick={() => onSelect(value)}
      className={`h-10 flex-1 rounded-xl text-sm font-medium transition ${
        selected ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      {label}
    </button>
  )
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <img
        src="/images/login-sky.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-sky-200/20" aria-hidden />

      <div className="relative w-full max-w-[440px] rounded-[28px] border border-white/70 bg-white/55 px-8 py-9 shadow-[0_24px_70px_-28px_rgba(30,60,90,0.35)] backdrop-blur-2xl sm:px-9 sm:py-10">
        {children}
        <p className="mt-6 text-center text-xs text-neutral-500">Forgot password? Contact your administrator</p>
      </div>
    </div>
  )
}

function CredentialsFields({
  idPrefix,
  email,
  password,
  loading,
  onEmailChange,
  onPasswordChange,
}: {
  idPrefix: string
  email: string
  password: string
  loading: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const emailId = `${idPrefix}-email`
  const passwordId = `${idPrefix}-password`

  return (
    <>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-neutral-500">
          <MailIcon />
        </span>
        <label className="sr-only" htmlFor={emailId}>
          Email
        </label>
        <input
          id={emailId}
          type="email"
          className={fieldClass}
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="email"
          autoFocus
          inputMode="email"
          placeholder="Email"
          required
          disabled={loading}
        />
      </div>

      <div>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-neutral-500">
            <LockIcon />
          </span>
          <label className="sr-only" htmlFor={passwordId}>
            Password
          </label>
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            className={`${fieldClass} pr-11`}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoComplete="current-password"
            placeholder="Password"
            required
            disabled={loading}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-500 transition hover:text-neutral-700"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
      </div>
    </>
  )
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 text-sm font-semibold text-white transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <>
          <Spinner />
          Signing in…
        </>
      ) : (
        'Sign in'
      )}
    </button>
  )
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-5 rounded-xl bg-rose-50/80 px-4 py-3 text-sm text-rose-800">
      {message}
    </div>
  )
}

function usePrefetchLandingRoutes(router: ReturnType<typeof useRouter>) {
  useEffect(() => {
    ;['/dashboard', '/pos', '/my-sales', '/booking/appointment-history'].forEach((path) => {
      router.prefetch(path)
    })
  }, [router])
}

type LoginHubRole = 'admin' | 'staff'

export function UnifiedLoginForm() {
  const router = useRouter()
  const groupId = useId()
  const [role, setRole] = useState<LoginHubRole>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(() => getWorkspace())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  usePrefetchLandingRoutes(router)

  const portal: 'admin' | 'staff' = role === 'staff' ? 'staff' : 'admin'
  const workspace: Workspace = role === 'staff' ? 'booking' : selectedWorkspace

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portal }),
      })
      await completeSessionAndNavigate(router, portal, workspace, {
        preferPosForAdminRoleFromHub: role === 'admin',
      })
    } catch (err) {
      setError(loginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginShell>
      <div className="mb-7 text-center">
        <h1 className="mt-5 text-[1.35rem] font-semibold tracking-tight text-neutral-950">Gentlegurls CRM</h1>
      </div>

      <ErrorBanner message={error} />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div role="radiogroup" aria-label="Role" className="flex rounded-xl bg-white/70 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
          <SegmentedOption name={`${groupId}-role`} value="admin" selected={role === 'admin'} label="Admin" onSelect={setRole} />
          <SegmentedOption name={`${groupId}-role`} value="staff" selected={role === 'staff'} label="Staff" onSelect={setRole} />
        </div>

        {role === 'admin' && (
          <div role="radiogroup" aria-label="Workspace" className="flex rounded-xl bg-white/70 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
            <SegmentedOption
              name={`${groupId}-workspace`}
              value="ecommerce"
              selected={selectedWorkspace === 'ecommerce'}
              label="Ecommerce"
              onSelect={setSelectedWorkspace}
            />
            <SegmentedOption
              name={`${groupId}-workspace`}
              value="booking"
              selected={selectedWorkspace === 'booking'}
              label="Booking"
              onSelect={setSelectedWorkspace}
            />
          </div>
        )}

        <CredentialsFields
          idPrefix="hub"
          email={email}
          password={password}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />

        <div className="pt-2">
          <SubmitButton loading={loading} />
        </div>
      </form>
    </LoginShell>
  )
}

function StaffLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  usePrefetchLandingRoutes(router)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portal: 'staff' }),
      })
      await completeSessionAndNavigate(router, 'staff', 'booking')
    } catch (err) {
      setError(loginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginShell>
      <div className="mb-7 text-center">
        <h1 className="mt-5 text-[1.35rem] font-semibold tracking-tight text-neutral-950">Sign in with email</h1>
      </div>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-3">
        <CredentialsFields
          idPrefix="staff"
          email={email}
          password={password}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />
        <div className="pt-2">
          <SubmitButton loading={loading} />
        </div>
      </form>
    </LoginShell>
  )
}

function AdminLoginForm() {
  const router = useRouter()
  const groupId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(() => getWorkspace())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  usePrefetchLandingRoutes(router)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portal: 'admin' }),
      })
      await completeSessionAndNavigate(router, 'admin', selectedWorkspace)
    } catch (err) {
      setError(loginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginShell>
      <div className="mb-7 text-center">
        <h1 className="mt-5 text-[1.35rem] font-semibold tracking-tight text-neutral-950">Sign in with email</h1>
      </div>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit} className="space-y-3">
        <div role="radiogroup" aria-label="Workspace" className="flex rounded-xl bg-white/70 p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
          <SegmentedOption
            name={`${groupId}-workspace`}
            value="ecommerce"
            selected={selectedWorkspace === 'ecommerce'}
            label="Ecommerce"
            onSelect={setSelectedWorkspace}
          />
          <SegmentedOption
            name={`${groupId}-workspace`}
            value="booking"
            selected={selectedWorkspace === 'booking'}
            label="Booking"
            onSelect={setSelectedWorkspace}
          />
        </div>
        <CredentialsFields
          idPrefix="admin"
          email={email}
          password={password}
          loading={loading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />
        <div className="pt-2">
          <SubmitButton loading={loading} />
        </div>
      </form>
    </LoginShell>
  )
}

export default function LoginForm({ variant }: LoginFormProps) {
  if (variant === 'staff') {
    return <StaffLoginForm />
  }
  return <AdminLoginForm />
}
