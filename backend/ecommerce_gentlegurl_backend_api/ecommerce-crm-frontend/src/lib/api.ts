const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch (error) {
    return null;
  }
}

async function apiGet<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await parseJsonSafe(res);
    console.error("API GET error", path, res.status, errorBody);
    throw new Error(errorBody?.message || `GET ${path} failed: ${res.status}`);
  }

  return res.json();
}

async function apiPost<T>(path: string, body: any, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    credentials: "include",
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorBody = await parseJsonSafe(res);
    console.error("API POST error", path, res.status, errorBody);
    throw new Error(errorBody?.message || `POST ${path} failed: ${res.status}`);
  }

  return res.json();
}

export { apiGet, apiPost };
