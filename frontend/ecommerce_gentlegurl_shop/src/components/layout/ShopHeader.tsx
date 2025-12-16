import { getHomepage, HomepageShopMenuItem } from "@/lib/server/getHomepage";
import { getAccountOverview } from "@/lib/server/getAccountOverview";
import { ShopHeaderClient } from "./ShopHeaderClient";

export default async function ShopHeader() {
  const overview = await getAccountOverview();
  const homepage = await getHomepage();
  const shopMenu: HomepageShopMenuItem[] = homepage?.shop_menu ?? [];

  return <ShopHeaderClient overview={overview} shopMenu={shopMenu} />;
}
