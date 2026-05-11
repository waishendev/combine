import { proxy } from './src/proxy'

export const config = {
  matcher: ['/admins/:path*', '/dashboard/:path*', '/reports/:path*', '/login'],
}

export const middleware = proxy
