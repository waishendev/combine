import { proxy } from './src/proxy'

export const config = {
  matcher: ['/admins/:path*', '/dashboard/:path*', '/login'],
}

export const middleware = proxy
