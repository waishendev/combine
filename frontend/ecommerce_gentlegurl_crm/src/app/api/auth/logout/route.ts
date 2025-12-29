import { NextRequest, NextResponse } from 'next/server'

import { getSetCookieHeaders } from '@/lib/setCookie'

const AUTH_COOKIE_NAME = 'crm_auth_token'

const getBackendBaseUrl = () =>
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ''

export async function POST(request: NextRequest) {
  const baseUrl = getBackendBaseUrl()
  const cookieHeader = request.headers.get('cookie') || ''
  let responseStatus = 200
  let responseBody: unknown = { success: true }
  let backendSetCookies: string[] = []

  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl}/api/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
      })
      responseStatus = response.status
      responseBody = await response.json().catch(() => ({}))
      backendSetCookies = getSetCookieHeaders(response.headers)
    } catch (error) {
      console.error('Logout proxy error:', error)
      responseStatus = 500
      responseBody = { error: 'Failed to connect to backend server' }
    }
  }

  const nextResponse = NextResponse.json(responseBody, {
    status: responseStatus,
  })

  backendSetCookies.forEach((cookieString) => {
    nextResponse.headers.append('set-cookie', cookieString)
  })

  nextResponse.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })

  return nextResponse
}
