type BookingTimeInput = {
  starts_at: string;
  ends_at?: string | null;
  end_at?: string | null;
  estimated_duration_min?: number | null;
};

export const BOOKING_DISPLAY_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kuala_Lumpur";

export function formatAccountDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const datePart = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BOOKING_DISPLAY_TIMEZONE,
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: BOOKING_DISPLAY_TIMEZONE,
  });

  return `${datePart}  ${timePart}`;
}

export function getBookingEndDate(booking: BookingTimeInput): Date {
  const endIso = booking.ends_at ?? booking.end_at;
  if (endIso) {
    return new Date(endIso);
  }

  const start = new Date(booking.starts_at);
  const durationMin = Number(booking.estimated_duration_min ?? 0);
  if (durationMin > 0) {
    return new Date(start.getTime() + durationMin * 60 * 1000);
  }

  return start;
}

const timeFormat: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function formatBookingTime(booking: BookingTimeInput): string {
  const start = new Date(booking.starts_at);
  const end = getBookingEndDate(booking);
  const startLabel = start.toLocaleTimeString("en-MY", timeFormat);

  if (end.getTime() <= start.getTime()) {
    return startLabel;
  }

  const endLabel = end.toLocaleTimeString("en-MY", timeFormat);
  return `${startLabel} – ${endLabel}`;
}

export function formatBookingDateTime(booking: BookingTimeInput): string {
  const start = new Date(booking.starts_at);
  const dateLabel = start.toLocaleDateString("en-MY", { dateStyle: "medium" });
  return `${dateLabel}, ${formatBookingTime(booking)}`;
}
