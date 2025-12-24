const AUTH_FLAG_KEY = "shop_auth_session";

export function getAuthFlag(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_FLAG_KEY) === "true";
}

export function setAuthFlag(value: boolean) {
  if (typeof window === "undefined") return;

  if (value) {
    window.localStorage.setItem(AUTH_FLAG_KEY, "true");
  } else {
    window.localStorage.removeItem(AUTH_FLAG_KEY);
  }
}

export function clearAuthFlag() {
  setAuthFlag(false);
}
