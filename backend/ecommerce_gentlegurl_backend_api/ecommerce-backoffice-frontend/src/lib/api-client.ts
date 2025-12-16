const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export type ApiResult<T> = {
  data: T;
  message: string | null;
  success: boolean;
};

async function handleResponse<T>(res: Response): Promise<ApiResult<T>> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiGet<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: any, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body?: any, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
  return handleResponse<T>(res);
}
