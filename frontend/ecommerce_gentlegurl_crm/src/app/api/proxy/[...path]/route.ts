import { NextRequest, NextResponse } from 'next/server';

// Proxy route for /api/proxy/* that forwards to backend
// Example: /api/proxy/admins -> http://localhost:8000/api/admins

const CRM_SESSION_COOKIE = 'gentlegurl-crm-session';
const LEGACY_AUTH_COOKIE_NAMES = [
  'connect.sid',
  'laravel-session',
  'gentlegurl-api-session',
];

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(CRM_SESSION_COOKIE, '', { maxAge: 0, path: '/' });
}

function getSessionCookieValue(request: NextRequest) {
  const crmCookie = request.cookies.get(CRM_SESSION_COOKIE)?.value;
  if (crmCookie) {
    return { value: crmCookie, fromLegacy: false };
  }

  for (const legacyName of LEGACY_AUTH_COOKIE_NAMES) {
    const legacyCookie = request.cookies.get(legacyName)?.value;
    if (legacyCookie) {
      return { value: legacyCookie, fromLegacy: true };
    }
  }

  return { value: null, fromLegacy: false };
}

function isUnauthenticatedResponse(data: unknown, status: number) {
  if (status === 401 || status === 419) {
    return true;
  }

  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string') {
      const normalized = message.toLowerCase();
      return normalized === 'unauthenticated' || normalized === 'unauthorized';
    }
  }

  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, 'PATCH');
}

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
    
    // Reconstruct the API path - params.path is ['admins'] for /api/proxy/admins
    // We need to rebuild it as /api/admins for the backend
    const apiPath = `/api/${params.path.join('/')}`;
    const url = `${baseUrl}${apiPath}`;
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams.toString();
    const fullUrl = searchParams ? `${url}?${searchParams}` : url;

    console.log(`[Proxy API] ==========================================`);
    console.log(`[Proxy API] ${method} ${fullUrl}`);
    console.log(`[Proxy API] Base URL: ${baseUrl}`);
    console.log(`[Proxy API] API Path: ${apiPath}`);
    console.log(`[Proxy API] Params:`, params.path);

    // Forward cookies from client to backend
    const allCookies = request.cookies.getAll();
    console.log(`[Proxy API] All cookies:`, allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })));
    
    const { value: sessionCookie, fromLegacy } = getSessionCookieValue(request);
    const filteredCookies = allCookies.filter(
      (cookie) =>
        cookie.name !== CRM_SESSION_COOKIE &&
        !LEGACY_AUTH_COOKIE_NAMES.includes(cookie.name),
    );
    const cookiePairs = [
      ...filteredCookies.map(cookie => `${cookie.name}=${cookie.value}`),
      ...(sessionCookie
        ? LEGACY_AUTH_COOKIE_NAMES.map((name) => `${name}=${sessionCookie}`)
        : []),
    ];
    const cookieHeader = cookiePairs.join('; ');
    console.log(`[Proxy API] Cookie header length:`, cookieHeader.length);
    console.log(`[Proxy API] Has laravel-session:`, cookieHeader.includes('laravel-session'));

    // Get request body for POST, PUT, PATCH requests
    let body: string | FormData | undefined;
    let contentType = request.headers.get('content-type') || '';
    const isFormData = contentType.includes('multipart/form-data');
    
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (isFormData) {
        // Handle FormData (file uploads)
        body = await request.formData();
      } else {
        try {
          const json = await request.json();
          body = JSON.stringify(json);
        } catch {
          // If not JSON, try to get as text
          body = await request.text().catch(() => undefined);
        }
      }
    }

    let response: Response;
    try {
      const fetchHeaders: HeadersInit = {
        Accept: '*/*',
      };
      
      // Only set Content-Type for non-FormData requests
      // FormData will set its own Content-Type with boundary
      if (!isFormData) {
        fetchHeaders['Content-Type'] = 'application/json';
      }
      
      // Always include cookies if available
      if (cookieHeader) {
        fetchHeaders['Cookie'] = cookieHeader;
      }
      
      console.log(`[Proxy API] Fetch headers:`, Object.keys(fetchHeaders));
      console.log(`[Proxy API] Cookie header being sent:`, cookieHeader ? cookieHeader.substring(0, 200) + '...' : 'None');
      console.log(`[Proxy API] Is FormData:`, isFormData);
      
      response = await fetch(fullUrl, {
        method,
        headers: fetchHeaders,
        ...(body && { body }),
      });
    } catch (fetchError) {
      console.error('[Proxy API] Fetch failed:', fetchError);
      throw new Error(`Failed to fetch from backend: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    console.log(`[Proxy API] Backend response status:`, response.status);
    console.log(`[Proxy API] Backend response headers:`, Object.fromEntries(response.headers.entries()));

    // Try to parse JSON, but handle non-JSON responses
    let data: unknown;
    const responseContentType = response.headers.get('content-type') || '';
    console.log(`[Proxy API] Response Content-Type: ${responseContentType}`);

    if (
      responseContentType.includes('application/pdf') ||
      responseContentType.includes('text/csv') ||
      responseContentType.startsWith('text/')
    ) {
      const buffer = await response.arrayBuffer();
      const headers = new Headers();
      headers.set('Content-Type', responseContentType || 'application/octet-stream');

      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        headers.set('Content-Disposition', contentDisposition);
      }

      return new NextResponse(buffer, {
        status: response.status,
        headers,
      });
    }

    const responseText = await response.text();
    console.log(`[Proxy API] Response text length: ${responseText.length}`);
    console.log(`[Proxy API] Response text (first 1000 chars):`, responseText.substring(0, 1000));

    if (
      responseContentType.includes('application/json') ||
      responseText.trim().startsWith('{') ||
      responseText.trim().startsWith('[')
    ) {
      try {
        data = responseText ? JSON.parse(responseText) : {};
        console.log(`[Proxy API] Successfully parsed JSON`);
      } catch (parseError) {
        console.error('[Proxy API] JSON parse error:', parseError);
        console.error('[Proxy API] Response text that failed to parse:', responseText);
        return NextResponse.json(
          {
            error: 'Failed to parse JSON response from backend',
            message: parseError instanceof Error ? parseError.message : 'Unknown parse error',
            rawResponse: responseText.substring(0, 500),
          },
          { status: 500 },
        );
      }
    } else {
      console.log(`[Proxy API] Non-JSON response received`);
      return NextResponse.json(
        {
          error: 'Backend returned non-JSON response',
          contentType: responseContentType,
          rawResponse: responseText.substring(0, 500),
        },
        { status: response.status || 500 },
      );
    }

    if (isUnauthenticatedResponse(data, response.status)) {
      const nextResponse = NextResponse.json(
        data ?? { success: false, message: 'Unauthenticated' },
        { status: 401 },
      );
      clearAuthCookies(nextResponse);
      return nextResponse;
    }

    // Create response with forwarded data
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // Forward cookies from backend to client
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      // Handle multiple cookies
      const cookieStrings = setCookieHeader.split(',').map(c => c.trim());
      
      cookieStrings.forEach(cookieString => {
        const parts = cookieString.split(';');
        const [nameValue] = parts;
        const [name, ...valueParts] = nameValue.split('=');
        const value = valueParts.join('=');
        
        if (name && value) {
          const normalizedName = name.trim();
          let httpOnly = false;
          let sameSite: 'strict' | 'lax' | 'none' = 'lax';
          let path = '/';
          let maxAge: number | undefined;
          let secure = false;
          
          parts.slice(1).forEach(attr => {
            const trimmed = attr.trim().toLowerCase();
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
          
          const cookieName = LEGACY_AUTH_COOKIE_NAMES.includes(normalizedName)
            ? CRM_SESSION_COOKIE
            : normalizedName;

          nextResponse.cookies.set(cookieName, value.trim(), {
            httpOnly,
            sameSite,
            path,
            secure,
            ...(maxAge && { maxAge }),
          });
        }
      });
    }

    if (fromLegacy && sessionCookie && !request.cookies.get(CRM_SESSION_COOKIE)) {
      nextResponse.cookies.set(CRM_SESSION_COOKIE, sessionCookie, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    }

    console.log(`[Proxy API] Returning response with status: ${nextResponse.status}`);
    console.log(`[Proxy API] ==========================================`);
    return nextResponse;
  } catch (error) {
    console.error('[Proxy API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Proxy API] Error details:', { errorMessage, errorStack });
    
    return NextResponse.json(
      { 
        error: 'Failed to connect to backend server',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
