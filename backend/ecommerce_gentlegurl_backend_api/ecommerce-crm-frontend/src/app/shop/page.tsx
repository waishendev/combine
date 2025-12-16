import { apiGet } from "@/lib/api";
import type { ShopMenuItem } from "@/lib/shop-types";
import Link from "next/link";

type MenuResponse = { data: ShopMenuItem[] };

export default async function ShopIndexPage() {
  const menuRes = await apiGet<MenuResponse>("/public/shop/menu");

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm uppercase text-blue-700">Shop</p>
        <h1 className="text-3xl font-semibold">Browse menus</h1>
        <p className="text-sm text-slate-600">Pick a menu to explore categories and products.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {menuRes.data.map((menu) => (
          <Link
            key={menu.id}
            href={`/shop/${menu.slug}`}
            className="rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow"
          >
            <p className="text-sm uppercase text-blue-700">Menu</p>
            <h2 className="text-xl font-semibold">{menu.name}</h2>
            <p className="text-sm text-slate-600">Sort order: {menu.sort_order}</p>
          </Link>
        ))}
        {!menuRes.data.length && <p className="text-sm text-slate-500">No menus available.</p>}
      </div>
    </section>
  );
}
