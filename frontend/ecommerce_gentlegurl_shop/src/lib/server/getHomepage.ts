import { cookies } from "next/headers";

export type HomepageSlider = {
  id: number;
  title: string | null;
  subtitle: string | null;
  image_path: string;
  mobile_image_path: string | null;
  button_label: string | null;
  button_link: string | null;
  sort_order: number;
  image_url?: string | null;
  mobile_image_url?: string | null;
};

export type HomepageMarquee = {
  id: number;
  text: string;
  sort_order: number;
};

export type HomepageAnnouncement = {
  id: number;
  title: string;
  content: string;
  image_path: string | null;
  button_label: string | null;
  button_link: string | null;
  image_url: string | null;
};

export type HomepageShopMenuItem = {
  id: number;
  label: string;
  slug: string;
  sort_order: number;
};

export type HomepageSeo = {
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  meta_og_image: string | null;
};

export type HomepageProductImage = {
  id: number;
  product_id: number;
  image_path: string;
  is_main: boolean;
  sort_order: number;
};

export type HomepageProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  is_featured: boolean;
  stock: number | null;
  low_stock_threshold: number | null;
  description: string | null;
  images?: HomepageProductImage[];
  [key: string]: unknown;
};

export type HomepageContact = {
  whatsapp?: {
    enabled: boolean;
    phone: string | null;
    default_message: string | null;
  };
};

export type HomepageSettings = {
  shipping?: {
    enabled?: boolean;
    currency?: string;
    label?: string;
    free_shipping?: {
      enabled?: boolean;
      min_order_amount?: number;
    };
    zones?: {
      MY_WEST?: {
        label?: string;
        countries?: string[];
        states?: string[];
        fee?: number;
        free_shipping?: {
          enabled?: boolean;
          min_order_amount?: number | null;
        };
      };
      MY_EAST?: {
        label?: string;
        countries?: string[];
        states?: string[];
        fee?: number;
        free_shipping?: {
          enabled?: boolean;
          min_order_amount?: number | null;
        };
      };
      SG?: {
        label?: string;
        countries?: string[];
        states?: string[];
        fee?: number;
        free_shipping?: {
          enabled?: boolean;
          min_order_amount?: number | null;
        };
      };
    };
    fallback?: {
      mode?: "block_checkout" | "use_default";
      default_fee?: number;
    };
  };
  footer?: HomepageFooter;
};

export type HomepageData = {
  sliders: HomepageSlider[];
  marquees: HomepageMarquee[];
  announcements: HomepageAnnouncement[];
  shop_menu: HomepageShopMenuItem[];
  new_products: HomepageProduct[];
  best_sellers: HomepageProduct[];
  featured_products: HomepageProduct[];
  seo: HomepageSeo | null;
  contact?: HomepageContact | null;
  settings?: HomepageSettings | null;
  payment_gateways?: HomepagePaymentGateway[];
};

export type HomepagePaymentGateway = {
  id: number;
  key: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  config?: Record<string, unknown> | null;
};

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

export async function getHomepage(): Promise<HomepageData | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Get session_token from cookie as fallback for query parameter
    const sessionToken = cookieStore.get("shop_session_token")?.value;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const searchParams = new URLSearchParams();
    if (sessionToken) {
      searchParams.set("session_token", sessionToken);
    }
    const qs = searchParams.toString();
    const url = `${siteUrl}/api/proxy/public/shop/homepage${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[getHomepage] Failed:", res.status, text);
      return null;
    }

    const json = await res.json();

    return (json.data as HomepageData) ?? null;
  } catch (error) {
    console.error("[getHomepage] Error:", error);
    return null;
  }
}
