import type { LandingVisitStudio } from "@/lib/types/landingVisitStudio";
import type { EcommerceLandingSections } from "@/lib/types/ecommerceLanding";

export type { EcommerceLandingHero, EcommerceSliderIntro, EcommerceLandingSections } from "@/lib/types/ecommerceLanding";

type EcommerceLandingPageResponse = {
  data?: {
    sections?: EcommerceLandingSections | null;
  } | null;
  sections?: EcommerceLandingSections | null;
};

export async function getEcommerceLandingPage(): Promise<EcommerceLandingSections | null> {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const url = `${siteUrl}/api/proxy/public/shop/landing-page`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as EcommerceLandingPageResponse;
    return json.data?.sections ?? json.sections ?? null;
  } catch {
    return null;
  }
}

/** @deprecated Use getEcommerceLandingPage */
export async function getLandingVisitStudio(): Promise<LandingVisitStudio | null> {
  const sections = await getEcommerceLandingPage();
  const visitStudio = sections?.visit_studio;
  if (!visitStudio?.is_active) {
    return null;
  }
  return visitStudio;
}
