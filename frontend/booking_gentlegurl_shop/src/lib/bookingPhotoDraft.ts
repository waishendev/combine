export type BookingPhotoDraftItem = {
  id: string;
  name: string;
  type: string;
  data_url: string;
};

const KEY_PREFIX = "booking_photo_draft";

const buildKey = (serviceId: string | number) => `${KEY_PREFIX}:${serviceId}`;

export function loadBookingPhotoDraft(serviceId: string | number): BookingPhotoDraftItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(buildKey(serviceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BookingPhotoDraftItem[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => Boolean(item?.data_url && item?.name))
      .slice(0, 3)
      .map((item) => ({
        id: String(item.id ?? `${item.name}-${Math.random()}`),
        name: String(item.name),
        type: String(item.type ?? "image/jpeg"),
        data_url: String(item.data_url),
      }));
  } catch {
    return [];
  }
}

export function saveBookingPhotoDraft(serviceId: string | number, items: BookingPhotoDraftItem[]): void {
  if (typeof window === "undefined") return;
  const normalized = items.slice(0, 3);

  if (normalized.length === 0) {
    window.sessionStorage.removeItem(buildKey(serviceId));
    return;
  }

  window.sessionStorage.setItem(buildKey(serviceId), JSON.stringify(normalized));
}

export function clearBookingPhotoDraft(serviceId: string | number): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(buildKey(serviceId));
}
