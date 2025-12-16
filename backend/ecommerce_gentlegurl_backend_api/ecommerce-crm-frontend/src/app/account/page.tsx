import Link from "next/link";
import { fetchMyOrders, fetchReturns, fetchWishlist } from "@/lib/shop-api";
import { requireCustomer } from "@/lib/require-auth";

export default async function AccountOverviewPage() {
  const user = await requireCustomer("/account");
  const [profileRes, ordersRes, returnsRes, wishlistRes] = await Promise.allSettled([
    Promise.resolve({ data: user }),
    fetchMyOrders({ page: 1 }),
    fetchReturns(),
    fetchWishlist(),
  ]);

  const userProfile = profileRes.status === "fulfilled" ? profileRes.value.data : null;
  const orders = ordersRes.status === "fulfilled" ? ordersRes.value.data : [];
  const returns = returnsRes.status === "fulfilled" ? returnsRes.value.data : [];
  const wishlist = wishlistRes.status === "fulfilled" ? wishlistRes.value.data : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Orders</div>
          <div className="text-3xl font-semibold">{orders.length}</div>
          <p className="text-sm text-slate-600">Recent orders placed with your account.</p>
          <Link href="/account/orders" className="text-sm font-semibold text-blue-600">
            View all
          </Link>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Returns</div>
          <div className="text-3xl font-semibold">{returns.length}</div>
          <p className="text-sm text-slate-600">Track your refund / return requests.</p>
          <Link href="/account/returns" className="text-sm font-semibold text-blue-600">
            View returns
          </Link>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Wishlist</div>
          <div className="text-3xl font-semibold">{wishlist.length}</div>
          <p className="text-sm text-slate-600">Products you saved for later.</p>
          <Link href="/account/wishlist" className="text-sm font-semibold text-blue-600">
            View wishlist
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Contact</div>
          <p className="text-lg font-semibold">{userProfile?.name}</p>
          <p className="text-sm text-slate-700">{userProfile?.email}</p>
          {userProfile?.phone && <p className="text-sm text-slate-700">{userProfile.phone}</p>}
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm uppercase text-blue-700">Quick links</div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            <Link href="/account/orders" className="rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">
              Orders
            </Link>
            <Link href="/account/returns" className="rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">
              Returns
            </Link>
            <Link href="/account/wishlist" className="rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">
              Wishlist
            </Link>
            <Link href="/account/loyalty" className="rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">
              Loyalty
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
