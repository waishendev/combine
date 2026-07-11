'use client'

import { FormEvent, useState } from 'react'
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

async function completeSessionAndNavigate(
  router: ReturnType<typeof useRouter>,
  portal: 'admin' | 'staff',
  workspace: Workspace,
  options?: { preferPosForAdminRoleFromHub?: boolean },
) {
  await new Promise((resolve) => setTimeout(resolve, 100))

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

type LoginHubRole = 'admin' | 'staff'

export function UnifiedLoginForm() {
  const router = useRouter()
  const [role, setRole] = useState<LoginHubRole>('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(() => getWorkspace())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError(
            'CORS错误：无法连接到后端服务器。请检查后端CORS配置是否允许来自 http://localhost:3000 的请求，并确保允许 credentials。',
          )
        } else {
          setError(err.message || 'Login failed')
        }
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium transition ${
      active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Ecommerce CRM</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to access your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Sign-in failed</p>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700">Role</span>
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={toggleClass(role === 'admin')}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={toggleClass(role === 'staff')}
                >
                  Staff
                </button>
              </div>
            </div>

            {role === 'admin' && (
              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700">Workspace</span>
                <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedWorkspace('ecommerce')}
                    className={toggleClass(selectedWorkspace === 'ecommerce')}
                  >
                    Ecommerce
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWorkspace('booking')}
                    className={toggleClass(selectedWorkspace === 'booking')}
                  >
                    Booking
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="hub-email">
                Email
              </label>
              <input
                id="hub-email"
                type="email"
                className="ios-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="hub-password">
                Password
              </label>
              <input
                id="hub-password"
                type="password"
                className="ios-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">Forgot password? Contact your administrator</div>
        </div>
      </div>
    </div>
  )
}

function StaffLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError(
            'CORS错误：无法连接到后端服务器。请检查后端CORS配置是否允许来自 http://localhost:3000 的请求，并确保允许 credentials。',
          )
        } else {
          setError(err.message || 'Login failed')
        }
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Staff Portal</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in for Booking & POS</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Sign-in failed</p>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="staff-email">
                Email
              </label>
              <input
                id="staff-email"
                type="email"
                className="ios-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="staff-password">
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                className="ios-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">Forgot password? Contact your administrator</div>
        </div>
      </div>
    </div>
  )
}

function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(() => getWorkspace())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError(
            'CORS错误：无法连接到后端服务器。请检查后端CORS配置是否允许来自 http://localhost:3000 的请求，并确保允许 credentials。',
          )
        } else {
          setError(err.message || 'Login failed')
        }
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">Ecommerce CRM</h1>
            <p className="mt-2 text-sm text-gray-600">Sign in to access your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Sign-in failed</p>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700">Workspace</span>
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedWorkspace('ecommerce')}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    selectedWorkspace === 'ecommerce'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Ecommerce
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWorkspace('booking')}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    selectedWorkspace === 'booking'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Booking
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                className="ios-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                className="ios-input w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">Forgot password? Contact your administrator</div>
        </div>
      </div>
    </div>
  )
}

export default function LoginForm({ variant }: LoginFormProps) {
  if (variant === 'staff') {
    return <StaffLoginForm />
  }
  return <AdminLoginForm />
}
