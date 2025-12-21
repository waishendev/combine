const STORAGE_KEY = "shop_session_token";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  return value ? decodeURIComponent(value.split("=")[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function generateToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateSessionToken(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existingCookie = getCookie(STORAGE_KEY);
  const existingStorage = window.localStorage.getItem(STORAGE_KEY);

  if (existingStorage || existingCookie) {
    const token = existingStorage ?? existingCookie ?? "";
    if (!existingStorage && token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    }
    if (!existingCookie && token) {
      setCookie(STORAGE_KEY, token, ONE_YEAR_IN_SECONDS);
    }
    return token;
  }

  const newToken = generateToken();
  window.localStorage.setItem(STORAGE_KEY, newToken);
  setCookie(STORAGE_KEY, newToken, ONE_YEAR_IN_SECONDS);
  return newToken;
}

export function setSessionToken(token: string | null) {
  if (typeof window === "undefined") return;

  if (!token) {
    window.localStorage.removeItem(STORAGE_KEY);
    setCookie(STORAGE_KEY, "", 0);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, token);
  setCookie(STORAGE_KEY, token, ONE_YEAR_IN_SECONDS);
}

export function clearSessionToken() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(STORAGE_KEY);
  setCookie(STORAGE_KEY, "", 0);
}
