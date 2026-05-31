import { proxy } from './src/proxy'

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|api|manifest|login|admin/login|staff/login).*)',
    '/login',
    '/admin/login',
    '/staff/login',
  ],
}

export const middleware = proxy
