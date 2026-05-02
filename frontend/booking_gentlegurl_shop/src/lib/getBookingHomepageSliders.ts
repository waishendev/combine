export type BookingHomepageSlider = {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  image_path?: string | null;
  mobile_image_path?: string | null;
  button_label?: string | null;
  button_link?: string | null;
  image_url?: string | null;
  mobile_image_url?: string | null;
};

export async function getBookingHomepageSliders(): Promise<BookingHomepageSlider[]> {
  const params = new URLSearchParams({ type: 'booking' });
  const res = await fetch(`/api/proxy/public/shop/sliders?${params.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'X-Workspace': 'booking' },
    credentials: 'include',
  });

  if (!res.ok) return [];

  const json = await res.json().catch(() => null);
  return Array.isArray(json?.data) ? json.data : [];
}
