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
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return [];
  const url = `${base}/public/shop/sliders?type=booking`;
  const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}
