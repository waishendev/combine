import { AccountWishlistGrid } from "@/components/account/AccountWishlistGrid";
import { getWishlist } from "@/lib/server/getWishlist";

export default async function AccountWishlistPage() {
  const data = await getWishlist();
  const itemsArray = Array.isArray(data) ? data : (data?.items ?? data?.wishlist ?? []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Wishlist</h2>
        <p className="text-sm text-[var(--foreground)]/70">Keep track of products you love and revisit them anytime.</p>
      </div>

      <AccountWishlistGrid initialItems={itemsArray} />
    </div>
  );
}
