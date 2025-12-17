import AnnouncementModal from "@/components/home/AnnouncementModal";
import Slider from "@/components/home/Slider";
import ProductGrid from "@/components/products/ProductGrid";
import { getHomepage } from "@/lib/server/getHomepage";

export default async function HomePage() {
  const data = await getHomepage();

  if (!data) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">Homepage</h1>
        <p className="mt-4 text-sm text-gray-600">
          Failed to load homepage data. Please check API /public/shop/homepage.
        </p>
      </main>
    );
  }

  return (
    <main className="bg-gradient-to-b from-transparent via-white/60 to-transparent pb-16">
      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-8 sm:px-6 lg:px-8">
        {data.sliders && data.sliders.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="mt-2 text-3xl font-semibold leading-tight text-gray-900 sm:text-4xl">
                  Effortless silhouettes, luxe textures, everyday confidence.
                </h1>
              </div>
            </div>

            <Slider items={data.sliders} />
          </section>
        )}

        {data.announcements?.length > 0 && <AnnouncementModal items={data.announcements} />}

        {data.featured_products && data.featured_products.length > 0 && (
          <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)] backdrop-blur-sm sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ec4899]">Featured</p>
                <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Featured Products</h2>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#ec4899]/40 to-transparent sm:ml-6" />
            </div>
            <div className="mt-6">
              <ProductGrid items={data.featured_products} />
            </div>
          </section>
        )}

        {data.new_products && data.new_products.length > 0 && (
          <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)] backdrop-blur-sm sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">New Arrivals</p>
                <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">New Products</h2>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#7c3aed]/35 to-transparent sm:ml-6" />
            </div>
            <div className="mt-6">
              <ProductGrid items={data.new_products} />
            </div>
          </section>
        )}

        {data.best_sellers && data.best_sellers.length > 0 && (
          <section className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_22px_70px_-40px_rgba(17,24,39,0.45)] backdrop-blur-sm sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#fb7185]">Community Favorites</p>
                <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Best Sellers</h2>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#fb7185]/40 to-transparent sm:ml-6" />
            </div>
            <div className="mt-6">
              <ProductGrid items={data.best_sellers} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
