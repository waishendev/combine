import { cookies } from 'next/headers'

export type User = {
  id: number
  name: string
  email: string
  username: string
  is_active?: boolean
  roles: string[] | Array<{ id: number; name: string }>
  permissions: string[]
}

export type UserResponse = {
  data: User
  message: string | null
  success: boolean
}

/**
 * Get current user from API using session cookie
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!baseUrl) {
      return null
    }

    // Get cookies from request
    const ck = await cookies()
    const cookieHeader = ck
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')

    // Try common endpoints for getting current user
    const endpoints = ['/api/user', '/api/me', '/api/auth/user', '/api/auth/me']
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(cookieHeader && { Cookie: cookieHeader }),
          },
          cache: 'no-store',
        })

        if (response.ok) {
          const data: UserResponse = await response.json()
          if (data.success && data.data) {
            return data.data
          }
        }
      } catch {
        // Try next endpoint
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

