import { NextRequest, NextResponse } from 'next/server'

import { getSetCookieHeaders } from '@/lib/setCookie'

const AUTH_COOKIE_NAME = 'crm_auth_token'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

const getBackendBaseUrl = () =>
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ''

const extractSessionToken = (setCookieHeaders: string[]) => {
  for (const header of setCookieHeaders) {
    const laravelMatch = header.match(/laravel_session=([^;]+)/i)
    if (laravelMatch?.[1]) {
      return laravelMatch[1]
    }

    const connectMatch = header.match(/connect\.sid=([^;]+)/i)
    if (connectMatch?.[1]) {
      return connectMatch[1]
    }
  }

  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const baseUrl = getBackendBaseUrl()
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'BACKEND_INTERNAL_URL is not set' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const cookieHeader = request.headers.get('cookie') || ''

    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))
    const nextResponse = NextResponse.json(data, { status: response.status })

    const setCookieHeaders = getSetCookieHeaders(response.headers)
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookieString) => {
        nextResponse.headers.append('set-cookie', cookieString)
      })
    }

    if (response.ok) {
      const tokenFromBody =
        data?.data?.token || data?.token || data?.data?.access_token
      const tokenFromCookie = extractSessionToken(setCookieHeaders)
      const tokenValue = tokenFromBody || tokenFromCookie

      if (tokenValue) {
        nextResponse.cookies.set({
          name: AUTH_COOKIE_NAME,
          value: tokenValue,
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: AUTH_COOKIE_MAX_AGE,
        })
      }
    }

    return nextResponse
  } catch (error) {
    console.error('Login proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to backend server' },
      { status: 500 }
    )
  }
}
