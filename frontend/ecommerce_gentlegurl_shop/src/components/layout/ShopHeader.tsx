import {
  getHomepage,
  HomepageServicesMenuItem,
  HomepageShopMenuItem,
} from "@/lib/server/getHomepage";
import { ShopHeaderClient } from "./ShopHeaderClient";

export default async function ShopHeader() {
  const homepage = await getHomepage();
  const shopMenu: HomepageShopMenuItem[] = homepage?.shop_menu ?? [];
  const servicesMenu: HomepageServicesMenuItem[] = homepage?.services_menu ?? [];
  const shopLogoUrl = homepage?.shop_logo_url ?? null;

  return (
    <ShopHeaderClient
      shopMenu={shopMenu}
      servicesMenu={servicesMenu}
      logoUrl={shopLogoUrl}
    />
  );
}
