import { getOrCreateSessionToken } from "@/lib/session-token";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export type CustomerAuthUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch (error) {
    return null;
  }
}

async function handleAuthResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.message || `Auth request failed: ${res.status}`);
  }
  return res.json();
}

export async function customerRegister(payload: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
}): Promise<{ data: CustomerAuthUser }> {
  const sessionToken = getOrCreateSessionToken();
  const res = await fetch(`${API_BASE}/public/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      ...payload,
      session_token: sessionToken,
    }),
  });
  return handleAuthResponse(res);
}

export async function customerLogin(payload: {
  email: string;
  password: string;
}): Promise<{ data: CustomerAuthUser }> {
  const sessionToken = getOrCreateSessionToken();
  const res = await fetch(`${API_BASE}/public/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      ...payload,
      session_token: sessionToken,
    }),
  });
  return handleAuthResponse(res);
}

export async function customerLogout(): Promise<void> {
  await fetch(`${API_BASE}/public/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function fetchCustomerProfile(): Promise<{ data: CustomerAuthUser | null }> {
  try {
    const headers: HeadersInit = {};

    // When running on the server (e.g. for Server Components or route handlers),
    // forward the incoming request cookies so the API can recognize the session.
    if (typeof window === "undefined") {
      const { headers: nextHeaders } = await import("next/headers");
      const headersList = await nextHeaders();
      const cookieHeader = headersList.get("cookie");
      
      // Forward all relevant headers that might be needed for authentication
      if (cookieHeader) {
        headers.Cookie = cookieHeader;
      }
      
      // Forward other headers that might be needed
      const forwardedHost = headersList.get("x-forwarded-host");
      const forwardedProto = headersList.get("x-forwarded-proto");
      const referer = headersList.get("referer");
      
      if (forwardedHost) {
        headers["x-forwarded-host"] = forwardedHost;
      }
      if (forwardedProto) {
        headers["x-forwarded-proto"] = forwardedProto;
      }
      if (referer) {
        headers["Referer"] = referer;
      }
    }

    const res = await fetch(`${API_BASE}/public/auth/profile`, {
      credentials: "include",
      cache: "no-store",
      headers,
    });
    
  
    if (!res.ok) {
      // 401 means not authenticated, which is fine - return null
      if (res.status === 401) {
        return { data: null };
      }
      // For other errors, log but still return null
      console.warn('Failed to fetch customer profile:', res.status, res.statusText);
      return { data: null };
    }
    
    return res.json();
  } catch (error) {
    // Network errors or other issues - silently return null
    console.warn('Error fetching customer profile:', error);
    return { data: null };
  }
}
