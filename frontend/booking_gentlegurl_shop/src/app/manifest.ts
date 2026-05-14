import type { MetadataRoute } from "next";

import { buildManifestIcons } from "@/lib/pwaIcons";
import { getBookingHomepage } from "@/lib/serverHomepage";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const homepage = await getBookingHomepage();
  const name = homepage?.seo?.meta_title || process.env.NEXT_PUBLIC_APP_NAME || "GentleGurls Booking";
  const description = homepage?.seo?.meta_description || "Premium salon booking experience for GentleGurls.";

  return {
    name,
    short_name: name,
    description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: buildManifestIcons(homepage?.shop_favicon_icons, homepage?.shop_favicon_url ?? "/images/logo.png"),
  };
}
