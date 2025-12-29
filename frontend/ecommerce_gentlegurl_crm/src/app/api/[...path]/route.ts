import { NextRequest, NextResponse } from 'next/server';

import { getSetCookieHeaders, parseSetCookieHeader } from '@/lib/setCookie';

// This is a catch-all proxy route for all API endpoints except /api/login
// It forwards requests to the backend server to avoid CORS issues

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
    
    // Reconstruct the API path - params.path is ['profile'] for /api/profile
    // We need to rebuild it as /api/profile for the backend
    const apiPath = `/api/${params.path.join('/')}`;
    const url = `${baseUrl}${apiPath}`;
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams.toString();
    const fullUrl = searchParams ? `${url}?${searchParams}` : url;

    console.log(`[API Proxy] ==========================================`);
    console.log(`[API Proxy] ${method} ${fullUrl}`);
    console.log(`[API Proxy] Base URL: ${baseUrl}`);
    console.log(`[API Proxy] API Path: ${apiPath}`);
    console.log(`[API Proxy] Params:`, params.path);

    // Forward cookies from client to backend
    // Use Next.js cookies API to get all cookies
    const allCookies = request.cookies.getAll();
    console.log(`[API Proxy] All cookies:`, allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })));
    
    // Build cookie header - include all cookies, especially laravel-session
    const cookiePairs = allCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const cookieHeader = cookiePairs || request.headers.get('cookie') || '';
    console.log(`[API Proxy] Cookie header length:`, cookieHeader.length);
    console.log(`[API Proxy] Has laravel-session:`, cookieHeader.includes('laravel-session'));

    // Get request body for POST, PUT, PATCH requests
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const json = await request.json();
        body = JSON.stringify(json);
      } catch {
        // If not JSON, try to get as text
        body = await request.text().catch(() => undefined);
      }
    }

    let response: Response;
    try {
      const fetchHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      
      // Always include cookies if available
      if (cookieHeader) {
        fetchHeaders['Cookie'] = cookieHeader;
      }
      
      console.log(`[API Proxy] Fetch headers:`, Object.keys(fetchHeaders));
      console.log(`[API Proxy] Cookie header being sent:`, cookieHeader ? cookieHeader.substring(0, 200) + '...' : 'None');
      
      response = await fetch(fullUrl, {
        method,
        headers: fetchHeaders,
        ...(body && { body }),
      });
    } catch (fetchError) {
      console.error('[API Proxy] Fetch failed:', fetchError);
      throw new Error(`Failed to fetch from backend: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    console.log(`[API Proxy] Backend response status:`, response.status);
    console.log(`[API Proxy] Backend response headers:`, Object.fromEntries(response.headers.entries()));

    // Try to parse JSON, but handle non-JSON responses
    let data: unknown;
    const contentType = response.headers.get('content-type') || '';
    console.log(`[API Proxy] Response Content-Type: ${contentType}`);
    
    const responseText = await response.text();
    console.log(`[API Proxy] Response text length: ${responseText.length}`);
    console.log(`[API Proxy] Response text (first 1000 chars):`, responseText.substring(0, 1000));
    
    if (contentType.includes('application/json') || responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
      try {
        data = responseText ? JSON.parse(responseText) : {};
        console.log(`[API Proxy] Successfully parsed JSON`);
      } catch (parseError) {
        console.error('[API Proxy] JSON parse error:', parseError);
        console.error('[API Proxy] Response text that failed to parse:', responseText);
        // Even if JSON parsing fails, return the text as error
        return NextResponse.json(
          { 
            error: 'Failed to parse JSON response from backend',
            message: parseError instanceof Error ? parseError.message : 'Unknown parse error',
            rawResponse: responseText.substring(0, 500)
          },
          { status: 500 }
        );
      }
    } else {
      // If not JSON, return as error
      console.log(`[API Proxy] Non-JSON response received`);
      return NextResponse.json(
        { 
          error: 'Backend returned non-JSON response',
          contentType,
          rawResponse: responseText.substring(0, 500)
        },
        { status: response.status || 500 }
      );
    }

    // Create response with forwarded data
    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // Forward cookies from backend to client
    const setCookieHeaders = getSetCookieHeaders(response.headers);
    if (setCookieHeaders.length > 0) {
      setCookieHeaders.forEach((cookieString) => {
        const parsedCookie = parseSetCookieHeader(cookieString);
        if (!parsedCookie) return;
        nextResponse.cookies.set(
          parsedCookie.name,
          parsedCookie.value,
          parsedCookie.attributes,
        );
      });
    }

    console.log(`[API Proxy] Returning response with status: ${nextResponse.status}`);
    console.log(`[API Proxy] ==========================================`);
    return nextResponse;
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[API Proxy] Error details:', { errorMessage, errorStack });
    
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
