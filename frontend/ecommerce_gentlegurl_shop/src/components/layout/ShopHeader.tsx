import { getHomepage, HomepageShopMenuItem } from "@/lib/server/getHomepage";
import { getUser } from "@/lib/server/getUser";
import { ShopHeaderClient } from "./ShopHeaderClient";

export default async function ShopHeader() {
  const overview = await getUser();
  const homepage = await getHomepage();
  const shopMenu: HomepageShopMenuItem[] = homepage?.shop_menu ?? [];

  return <ShopHeaderClient overview={overview} shopMenu={shopMenu} />;
}
