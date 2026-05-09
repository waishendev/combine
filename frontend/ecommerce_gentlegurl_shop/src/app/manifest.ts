import type { MetadataRoute } from "next";

import { buildManifestIcons } from "@/lib/pwaIcons";
import { getHomepage } from "@/lib/server/getHomepage";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const homepage = await getHomepage();
  const name = homepage?.seo?.meta_title || process.env.NEXT_PUBLIC_APP_NAME || "Gentlegurls";
  const description = homepage?.seo?.meta_description || "Gentlegurls ecommerce shop.";

  return {
    name,
    short_name: name.slice(0, 12),
    description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: buildManifestIcons(homepage?.shop_favicon_icons, homepage?.shop_favicon_url ?? "/images/logo.png"),
  };
}
