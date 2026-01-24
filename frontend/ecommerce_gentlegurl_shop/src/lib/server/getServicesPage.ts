import { cookies } from "next/headers";

export type ServicesHeroSlide = {
  id?: number;
  sort_order?: number;
  src: string;
  mobileSrc?: string;
  alt?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  buttonHref?: string;
};

export type ServicesServiceItem = {
  title: string;
  description: string;
};

export type ServicesPricingItem = {
  label: string;
  price: string;
};

export type ServicesFaqItem = {
  question: string;
  answer: string;
};

export type ServicesSection<T> = {
  is_active: boolean;
  items: T[];
};

export type ServicesNotesSection = {
  is_active: boolean;
  items: string[];
};

export type ServicesPageData = {
  id: number;
  menu_item_id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  hero_slides: ServicesHeroSlide[];
  sections: {
    services: ServicesSection<ServicesServiceItem>;
    pricing: ServicesSection<ServicesPricingItem>;
    faqs: ServicesSection<ServicesFaqItem>;
    notes: ServicesNotesSection;
  };
};

export async function getServicesPage(slug: string): Promise<ServicesPageData | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const sessionToken = cookieStore.get("shop_session_token")?.value;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const searchParams = new URLSearchParams();
    if (sessionToken) {
      searchParams.set("session_token", sessionToken);
    }

    const qs = searchParams.toString();
    const url = `${siteUrl}/api/proxy/public/services/pages/${slug}${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: cookieHeader
        ? {
            cookie: cookieHeader,
          }
        : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch services page (${res.status})`);
    }

    const json = await res.json();
    const payload = json?.data ?? json;

    return payload as ServicesPageData;
  } catch (error) {
    console.error("[getServicesPage]", error);
    return null;
  }
}
