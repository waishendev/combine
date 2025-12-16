import { AccountNav } from "@/components/account/AccountNav";
import { requireCustomer } from "@/lib/require-auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer("/account");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-blue-700">My Account</p>
          <h1 className="text-3xl font-semibold">Welcome back, {user?.name}</h1>
          <p className="text-sm text-slate-600">Manage your orders, returns, wishlist, and rewards in one place.</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
          <div className="font-semibold">{user?.email}</div>
          {user?.phone && <div className="text-slate-600">{user.phone}</div>}
        </div>
      </div>
      <AccountNav />
      <div className="py-6">{children}</div>
    </div>
  );
}
