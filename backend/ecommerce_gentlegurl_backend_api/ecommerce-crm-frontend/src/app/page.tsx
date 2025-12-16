import { MarqueeBar } from "@/components/shop/MarqueeBar";
import { ProductCard } from "@/components/shop/ProductCard";
import { PromotionBox } from "@/components/shop/PromotionBox";
import { apiGet } from "@/lib/api";
import type { MarqueeItem, Product, PromotionItem } from "@/lib/shop-types";

type PromotionResponse = { data: PromotionItem[] };
type MarqueeResponse = { data: MarqueeItem[] };
type ProductResponse = { data: Product[] | { data: Product[]; meta: any } };

export default async function Home() {
  const [promoRes, marqueeRes, featuredRes] = await Promise.allSettled([
    apiGet<PromotionResponse>("/public/shop/promotions"),
    apiGet<MarqueeResponse>("/public/shop/marquees"),
    apiGet<ProductResponse>("/public/shop/products?limit=8"),
  ]);

  const promotions = promoRes.status === "fulfilled" ? promoRes.value.data : [];
  const marquees = marqueeRes.status === "fulfilled" ? marqueeRes.value.data : [];
  // Handle paginated response: if data is an object with data property, extract it
  const featuredRaw = featuredRes.status === "fulfilled" ? featuredRes.value.data : null;
  const featured = Array.isArray(featuredRaw) 
    ? featuredRaw 
    : (featuredRaw && typeof featuredRaw === 'object' && 'data' in featuredRaw && Array.isArray(featuredRaw.data))
    ? featuredRaw.data
    : [];

  return (
    <div>
      <MarqueeBar items={marquees} />
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <div>
          <p className="text-sm uppercase text-blue-700">Welcome</p>
          <h1 className="text-3xl font-semibold">Discover our latest products</h1>
          <p className="text-slate-600">Browse menus, categories, and find items you love.</p>
        </div>

        {promotions.length ? <PromotionBox promotion={promotions[0]} /> : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Featured products</h2>
            <a href="/shop" className="text-sm font-semibold text-blue-600">
              View all
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
            {!featured.length && <p className="text-sm text-slate-500">No featured products yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
