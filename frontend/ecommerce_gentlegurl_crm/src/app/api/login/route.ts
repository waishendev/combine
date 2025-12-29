import { NextRequest, NextResponse } from 'next/server';

import { getSetCookieHeaders } from '@/lib/setCookie';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    // Forward any cookies from the client request to the backend
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    console.log('Backend response status:', response.status);
    console.log('Backend response data:', data);
    console.log('Set-Cookie header:', response.headers.get('set-cookie'));

    // Create response with forwarded data
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // Forward cookies from backend to client
    const setCookieHeaders = getSetCookieHeaders(response.headers);
    
    console.log('[Login API] Set-Cookie headers count:', setCookieHeaders.length);
    console.log('[Login API] Set-Cookie headers:', setCookieHeaders);
    
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach(cookieString => {
        // Laravel cookies format: name=value; Path=/; HttpOnly; SameSite=lax
        const parts = cookieString.split(';').map(p => p.trim());
        const [nameValue] = parts;
        const [name, ...valueParts] = nameValue.split('=');
        const value = valueParts.join('='); // In case value contains '='
        
        if (name && value) {
          // Extract cookie attributes
          let httpOnly = false;
          let sameSite: 'strict' | 'lax' | 'none' = 'lax';
          let path = '/';
          let maxAge: number | undefined;
          let secure = false;
          
          parts.slice(1).forEach(attr => {
            const trimmed = attr.toLowerCase();
            if (trimmed === 'httponly') httpOnly = true;
            if (trimmed === 'secure') secure = true;
            if (trimmed.startsWith('samesite=')) {
              const samesiteValue = trimmed.split('=')[1];
              if (samesiteValue === 'strict' || samesiteValue === 'none') {
                sameSite = samesiteValue;
              }
            }
            if (trimmed.startsWith('path=')) {
              path = trimmed.split('=')[1];
            }
            if (trimmed.startsWith('max-age=')) {
              maxAge = parseInt(trimmed.split('=')[1], 10);
            }
          });
          
          console.log(`[Login API] Setting cookie: ${name} with path=${path}, httpOnly=${httpOnly}, sameSite=${sameSite}`);
          
          nextResponse.cookies.set(name.trim(), value.trim(), {
            httpOnly,
            sameSite,
            path,
            secure,
            ...(maxAge && { maxAge }),
          });
        }
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend server' },
      { status: 500 }
    );
  }
}
