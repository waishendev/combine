import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE_NAME = 'crm_auth_token'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)

  if (!authCookie?.value) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
