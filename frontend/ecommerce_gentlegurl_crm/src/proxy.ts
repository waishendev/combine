import { NextRequest, NextResponse } from 'next/server';

function isLoginPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/admin/login') ||
    pathname.startsWith('/staff/login')
  );
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isProtectedPage =
    pathname.startsWith('/admins') ||
    pathname.startsWith('/staffs') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/reports');
  const isLoginPage = isLoginPath(pathname);
  const hasSessionCookie =
    req.cookies.get('connect.sid') ||
    req.cookies.get('laravel-session') ||
    req.cookies.get('gentlegurl-api-session');

  if (isLoginPage && hasSessionCookie) {
    const portal = req.cookies.get('crm_login_portal')?.value;
    const destPath = portal === 'staff' ? '/booking/appointments' : '/dashboard';
    return NextResponse.redirect(new URL(destPath, req.url));
  }

  if (isProtectedPage && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admins/:path*',
    '/staffs/:path*',
    '/dashboard/:path*',
    '/reports/:path*',
    '/login',
    '/admin/login',
    '/staff/login',
  ],
};
