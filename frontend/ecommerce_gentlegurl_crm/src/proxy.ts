import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isProtectedPage = 
    pathname.startsWith('/admins') || 
    pathname.startsWith('/dashboard');
  const isLoginPage = pathname.startsWith('/login');
  const hasSessionCookie = 
    req.cookies.get('gentlegurl-crm-session') ||
    req.cookies.get('connect.sid') || 
    req.cookies.get('laravel-session') || 
    req.cookies.get('gentlegurl-api-session');

  if (isLoginPage && hasSessionCookie) {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  if (isProtectedPage && !hasSessionCookie) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admins/:path*', '/dashboard/:path*', '/login'],
};
