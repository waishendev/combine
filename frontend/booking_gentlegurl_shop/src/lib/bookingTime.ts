type BookingTimeInput = {
  starts_at: string;
  ends_at?: string | null;
  end_at?: string | null;
  estimated_duration_min?: number | null;
};

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
