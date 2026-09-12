import { NextRequest, NextResponse } from 'next/server'

import { forwardSetCookies } from '@/lib/forward-set-cookies'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

    // Forward any cookies from the client request to the backend
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

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    })

    // Critical on LIVE: use getSetCookie() — never split Set-Cookie by comma.
    forwardSetCookies(response, nextResponse)

    return nextResponse
  } catch (error) {
    console.error('API proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to backend server' },
      { status: 500 },
    )
  }
}
