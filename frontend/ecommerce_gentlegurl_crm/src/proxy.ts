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
    // Match redirect to the URL the user opened. Otherwise /admin/login + crm_login_portal=staff
    // sent users to booking first; invalid session then bounced them to /staff/login (confusing).
    let destPath = '/dashboard';
    if (pathname.startsWith('/staff/login')) {
      destPath = '/booking/appointment-history';
    } else if (pathname.startsWith('/admin/login')) {
      destPath = '/dashboard';
    } 
    
    // else {
    //   const portal = req.cookies.get('crm_login_portal')?.value;
    //   destPath = portal === 'staff' ? '/booking/appointment-history' : '/dashboard';
    // }
    return NextResponse.redirect(new URL(destPath, req.url));
  }

  if (isProtectedPage && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url));
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
