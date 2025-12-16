export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // If path starts with /api/, use Next.js API route (no baseUrl needed)
  // Otherwise, use the backend API directly
  const isLocalApiRoute = path.startsWith('/api/');
  const baseUrl = isLocalApiRoute 
    ? '' 
    : process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!isLocalApiRoute && !baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });

  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const url = isLocalApiRoute ? path : `${baseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch (fetchError) {
    // Handle network errors (CORS, connection refused, etc.)
    if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
      throw new ApiError(
        '网络错误：无法连接到服务器。可能是CORS配置问题或服务器未运行。',
        0
      );
    }
    throw fetchError;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.error || data?.message || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}
