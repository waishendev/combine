import { cookies } from 'next/headers'

/**
 * Check if user has a valid session cookie (Laravel session)
 */
export async function hasSessionCookie(): Promise<boolean> {
  const ck = await cookies()
  const sessionCookie = 
    ck.get('laravel-session') || 
    ck.get('connect.sid')
  return !!sessionCookie
}
