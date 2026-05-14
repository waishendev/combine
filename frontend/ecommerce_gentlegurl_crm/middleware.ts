import { proxy } from './src/proxy'

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
}

export const middleware = proxy
