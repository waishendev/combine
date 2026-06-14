import type { BookingHomepageSlider } from "@/lib/getBookingHomepageSliders";
import type { LandingSections } from "@/lib/types";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
}

export async function getBookingLandingPageServer(): Promise<LandingSections | null> {
  try {
    const response = await fetch(`${apiBase()}/api/booking/landing-page`, {
      headers: { Accept: "application/json", "X-Workspace": "booking" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const sections = (payload?.data?.sections ?? payload?.sections ?? null) as LandingSections | null;
    if (!sections?.hero) return sections;

    return {
      ...sections,
      hero: {
        ...sections.hero,
        title_2: sections.hero.title_2 ?? "",
        subtitle_2: sections.hero.subtitle_2 ?? "",
      },
    };
  } catch {
    return null;
  }
}

export async function getBookingHomepageSlidersServer(): Promise<BookingHomepageSlider[]> {
  try {
    const params = new URLSearchParams({ type: "booking" });
    const response = await fetch(`${apiBase()}/api/public/shop/sliders?${params.toString()}`, {
      headers: { Accept: "application/json", "X-Workspace": "booking" },
      cache: "no-store",
    });
    if (!response.ok) return [];

    const payload = await response.json().catch(() => null);
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    return [];
  }
}
