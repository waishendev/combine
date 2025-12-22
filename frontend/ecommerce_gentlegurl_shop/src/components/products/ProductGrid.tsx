import Image from "next/image";
import Link from "next/link";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";

interface ProductGridProps {
  items: Array<{
    id: number | string;
    name: string;
    price: number | string;
    slug?: string;
    images?: Array<{ image_path?: string }>;
    is_in_wishlist?: boolean;
    sold_count?: number | string;
  }>;
}

export default function ProductGrid({ items }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {items?.map((product) => {
        const productSlug = product.slug ?? product.id;
        const priceNumber = Number(product.price);
        const priceLabel = Number.isFinite(priceNumber) ? priceNumber.toFixed(2) : product.price;
        const image = product.images?.[0]?.image_path;
        const soldCountValue = Number(product.sold_count ?? 0);
        const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;

        return (
          <div
            key={product.id}
            className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_12px_45px_-30px_rgba(17,24,39,0.65)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_70px_-32px_rgba(109,40,217,0.35)]"
          >
            <div className="absolute right-3 top-3 z-10">
              <WishlistToggleButton
                productId={Number(product.id)}
                initialIsWishlisted={product.is_in_wishlist ?? false}
              />
            </div>

            <Link href={`/product/${productSlug}`} className="block">
              {image && (
                <div className="relative h-44 w-full overflow-hidden bg-gradient-to-b from-[#f5f0ff] to-white">
                  <Image
                    // src={image}
                    src={"/images/placeholder.png"}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-500 ease-out group-hover:scale-105"
                  />
                </div>
              )}
              <div className="space-y-2 p-4">
                <h3 className="text-sm font-semibold leading-snug text-gray-900 md:text-base">
                  {product.name}
                </h3>
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span className="font-semibold text-[#ec4899]">RM {priceLabel}</span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-gray-400">View</span>
                </div>
                <p className="text-xs font-medium text-gray-500">Sold {soldCount}</p>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
