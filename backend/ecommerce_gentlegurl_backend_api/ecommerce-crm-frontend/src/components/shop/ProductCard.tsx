import Link from "next/link";
import type { Product } from "@/lib/shop-types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex h-full flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow"
    >
      <div className="mb-4 h-40 w-full overflow-hidden rounded-lg bg-slate-100">
        {product.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-900 hover:text-blue-600">
          {product.name}
        </h3>
        <div className="text-sm text-slate-600">Stock: {product.stock_quantity}</div>
        <div className="text-xl font-bold text-blue-700">RM {product.price}</div>
      </div>
    </Link>
  );
}
