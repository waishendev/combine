const SESSION_TOKEN_KEY = "session_token";
const LEGACY_SESSION_TOKEN_KEY = "shop_session_token";

let cachedToken: string | null = null;

export function getExistingSessionToken(): string | null {
  if (typeof window === "undefined") {
    return cachedToken;
  }

  return (
    window.localStorage.getItem(SESSION_TOKEN_KEY) ||
    window.localStorage.getItem(LEGACY_SESSION_TOKEN_KEY)
  );
}

export function getOrCreateSessionToken(): string {
  if (typeof window === "undefined") {
    if (!cachedToken) {
      cachedToken = crypto.randomUUID();
    }
    return cachedToken;
  }

  if (cachedToken) {
    return cachedToken;
  }

  const existing =
    window.localStorage.getItem(SESSION_TOKEN_KEY) ||
    window.localStorage.getItem(LEGACY_SESSION_TOKEN_KEY);
  if (existing) {
    cachedToken = existing;
    // Ensure the token is stored under the new key for future reads.
    window.localStorage.setItem(SESSION_TOKEN_KEY, existing);
    document.cookie = `${SESSION_TOKEN_KEY}=${existing}; path=/; max-age=31536000`;
    return existing;
  }

  const token = crypto.randomUUID();
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  window.localStorage.setItem(LEGACY_SESSION_TOKEN_KEY, token);
  document.cookie = `${SESSION_TOKEN_KEY}=${token}; path=/; max-age=31536000`;
  cachedToken = token;
  return token;
}
