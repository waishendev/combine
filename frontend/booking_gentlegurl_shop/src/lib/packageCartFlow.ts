const PENDING_PACKAGE_STORAGE_KEY = "booking_pending_package_id";

type CartLike = {
  items?: unknown[] | null;
  package_items?: unknown[] | null;
} | null | undefined;

export function openBookingCart() {
  window.dispatchEvent(new CustomEvent("openCart"));
}

export function syncCartCount(cart: CartLike) {
  const itemCount = (cart?.items?.length || 0) + (cart?.package_items?.length || 0);
  window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
  return itemCount;
}

export function storePendingPackageId(packageId: number) {
  try {
    sessionStorage.setItem(PENDING_PACKAGE_STORAGE_KEY, String(packageId));
  } catch {
    // ignore storage errors
  }
}

export function readPendingPackageId(): number | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("pendingPackage");
    const raw = fromUrl || sessionStorage.getItem(PENDING_PACKAGE_STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function clearPendingPackageId() {
  try {
    sessionStorage.removeItem(PENDING_PACKAGE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has("pendingPackage") && !url.searchParams.has("openCart")) return;

  url.searchParams.delete("pendingPackage");
  url.searchParams.delete("openCart");
  const nextSearch = url.searchParams.toString();
  window.history.replaceState({}, "", `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}`);
}

export function buildPackageLoginRedirect(returnPath: string, packageId: number) {
  storePendingPackageId(packageId);
  const separator = returnPath.includes("?") ? "&" : "?";
  const redirect = `${returnPath}${separator}pendingPackage=${packageId}&openCart=1`;
  return `/login?redirect=${encodeURIComponent(redirect)}`;
}

export function shouldOpenCartFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("openCart") === "1";
  } catch {
    return false;
  }
}
