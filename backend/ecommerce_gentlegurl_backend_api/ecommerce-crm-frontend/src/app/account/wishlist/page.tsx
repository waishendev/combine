import { WishlistGrid } from "@/components/account/WishlistGrid";
import { requireCustomer } from "@/lib/require-auth";
import { fetchWishlist } from "@/lib/shop-api";
import type { WishlistItem } from "@/lib/shop-types";

export default async function WishlistPage() {
  await requireCustomer("/account/wishlist");
  const res = await fetchWishlist();
  const items: WishlistItem[] = res.data;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Your wishlist</h2>
      <WishlistGrid items={items} />
    </div>
  );
}
