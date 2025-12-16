import { Suspense } from "react";
import { apiGet } from "@/lib/api";
import { AddToCart } from "@/components/shop/AddToCart";
import type { Product } from "@/lib/shop-types";

interface ProductResponse {
  data: Product;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const productRes = await apiGet<ProductResponse>(`/public/shop/products/${slug}`);
  const product = productRes.data;

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {product.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.thumbnail_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-80 items-center justify-center bg-slate-100 text-slate-500">No image</div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm uppercase text-blue-700">Product</p>
            <h1 className="text-3xl font-semibold">{product.name}</h1>
            <p className="text-sm text-slate-500">SKU: {product.sku ?? "N/A"}</p>
          </div>
          <div className="text-3xl font-bold text-blue-700">RM {product.price}</div>
          <p className="text-slate-700">{product.description ?? "No description provided."}</p>
          <Suspense fallback={<p>Loading cart...</p>}>
            <AddToCart productId={product.id} stock={product.stock_quantity} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

