export const BOOKING_CART_CHANGED_EVENT = "booking_cart_changed";
export const OPEN_BOOKING_CART_DRAWER_EVENT = "open_booking_cart_drawer";

export function emitBookingCartChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BOOKING_CART_CHANGED_EVENT));
}

export function emitOpenBookingCartDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_BOOKING_CART_DRAWER_EVENT));
}
