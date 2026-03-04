export type HomepageFooter = {
  enabled?: boolean;
  about_text?: string | null;
  contact?: {
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  social?: {
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
  } | null;
  links?: {
    shipping_policy?: string | null;
    return_refund?: string | null;
    privacy?: string | null;
    terms?: string | null;
  } | null;
};

export type HomepageData = {
  shop_logo_url?: string | null;
  shop_favicon_url?: string | null;
  seo?: {
    meta_title?: string | null;
    meta_description?: string | null;
    meta_keywords?: string | null;
    meta_og_image?: string | null;
  } | null;
  contact?: {
    whatsapp?: {
      enabled?: boolean;
      phone?: string | null;
      default_message?: string | null;
    };
  } | null;
  settings?: {
    footer?: HomepageFooter | null;
  } | null;
};

export async function getBookingHomepage(): Promise<HomepageData | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${base}/api/public/shop/homepage?type=booking`, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data ?? null;
  } catch {
    return null;
  }
}
