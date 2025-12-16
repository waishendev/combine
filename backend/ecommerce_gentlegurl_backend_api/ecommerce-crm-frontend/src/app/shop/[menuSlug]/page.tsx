import { ProductCard } from "@/components/shop/ProductCard";
import { apiGet } from "@/lib/api";
import type { Category, Product, ShopMenuItem } from "@/lib/shop-types";
import Link from "next/link";

interface MenuDetailResponse {
  data: ShopMenuItem & {
    categories: Category[];
  };
}

interface ProductsResponse {
  data: Product[];
}

export default async function ShopMenuPage({ params }: { params: Promise<{ menuSlug: string }> }) {
  const { menuSlug } = await params;
  const menuData = await apiGet<MenuDetailResponse>(`/public/shop/menu/${menuSlug}`);
  const productsData = await apiGet<ProductsResponse>(`/public/shop/products?menu_slug=${menuSlug}&limit=100`);
  
  const menu = menuData.data;
  const categories = menu.categories || [];
  const products = productsData.data || [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase text-blue-700">Menu</p>
          <h1 className="text-3xl font-semibold">{menu.name}</h1>
        </div>
        <Link href="/cart" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
          View Cart
        </Link>
      </div>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Categories</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            {categories.map((category) => (
              <li key={category.id} className="rounded-md px-2 py-1 hover:bg-slate-100">
                {category.name}
              </li>
            ))}
            {!categories.length && <li className="text-slate-500">No categories</li>}
          </ul>
        </aside>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Products</h2>
            <span className="text-sm text-slate-500">{products.length} items</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {!products.length && <p className="text-sm text-slate-500">No products available.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
