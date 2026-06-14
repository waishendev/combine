export function sanitizeWhatsAppPhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function buildWhatsAppUrl(phone: string, message?: string | null): string | null {
  const sanitized = sanitizeWhatsAppPhone(phone);
  if (!sanitized) return null;
  const base = `https://wa.me/${sanitized}`;
  const trimmedMessage = message?.trim();
  if (!trimmedMessage) return base;
  return `${base}?text=${encodeURIComponent(trimmedMessage)}`;
}

export function resolveVisitStudioWhatsAppPhone(studio: {
  whatsapp_phone?: string | null;
  whatsapp_url?: string | null;
}): string {
  const direct = studio.whatsapp_phone?.trim() ?? "";
  if (direct) return direct;

  const legacyUrl = studio.whatsapp_url?.trim() ?? "";
  if (!legacyUrl) return "";

  const waMe = legacyUrl.match(/wa\.me\/(\d+)/i);
  if (waMe?.[1]) return waMe[1];

  const apiPhone = legacyUrl.match(/[?&]phone=(\d+)/i);
  if (apiPhone?.[1]) return apiPhone[1];

  if (/^[\d+\s\-()]+$/.test(legacyUrl)) {
    return legacyUrl.replace(/[^\d+]/g, "");
  }

  return "";
}

export function resolveVisitStudioWhatsAppMessage(studio: {
  whatsapp_message?: string | null;
  whatsapp_url?: string | null;
}): string {
  const direct = studio.whatsapp_message?.trim();
  if (direct) return direct;

  const legacyUrl = studio.whatsapp_url?.trim() ?? "";
  if (!legacyUrl) return "";

  try {
    const parsed = new URL(legacyUrl.startsWith("http") ? legacyUrl : `https://${legacyUrl}`);
    const text = parsed.searchParams.get("text");
    return text ? decodeURIComponent(text.replace(/\+/g, " ")) : "";
  } catch {
    return "";
  }
}
