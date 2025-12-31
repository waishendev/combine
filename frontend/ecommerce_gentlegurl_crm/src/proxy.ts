import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isProtectedPage = 
    pathname.startsWith('/admins') || 
    pathname.startsWith('/dashboard');

  if (isProtectedPage) {
    // Check for both possible session cookie names
    const hasSessionCookie = 
      req.cookies.get('connect.sid') || 
      req.cookies.get('laravel-session') || req.cookies.get('gentlegurl-api-session');
    
    if (!hasSessionCookie) {
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admins/:path*', '/dashboard/:path*'],
};

