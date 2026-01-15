export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  console.info(
    "[fetchJson]",
    url,
    "status=",
    res.status,
    "content-type=",
    contentType,
  );

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Expected JSON but got "${contentType}". status=${res.status}. body_snippet=${text.slice(0, 300)}`,
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}
