import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";
import { ProductReviewsSection } from "@/components/product/ProductReviewsSection";
import { getProduct } from "@/lib/server/getProduct";
import { getProductReviewEligibility } from "@/lib/server/getProductReviewEligibility";
import { getProductReviews } from "@/lib/server/getProductReviews";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { ReviewSettings } from "@/lib/types/reviews";
import { ProductGallery } from "@/components/product/ProductGallery";
import { RewardRedeemPanel } from "@/components/product/RewardRedeemPanel";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const [{ slug }, searchParamsResolved] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const resolvedSearchParams: Record<string, string | string[] | undefined> = searchParamsResolved;

  const rewardParam = Array.isArray(resolvedSearchParams?.reward)
    ? resolvedSearchParams.reward[0]
    : resolvedSearchParams?.reward;
  const isRewardContext = typeof rewardParam === "string"
    ? ["1", "true", "yes", "reward"].includes(rewardParam.toLowerCase())
    : false;

  const product = await getProduct(slug, { reward: isRewardContext });
  if (!product) return notFound();
  const isRewardOnly = product.is_reward_only === true;
  const rewardPoints =
    (product as { points_required?: number | null })?.points_required ??
    (product as { reward_points_required?: number | null })?.reward_points_required ??
    null;

  const [reviewsData, eligibility] = await Promise.all([
    getProductReviews(slug),
    getProductReviewEligibility(slug),
  ]);

  const normalizedImages = (product.images ?? []).map((img) => ({
    ...img,
    image_path: normalizeImageUrl(img.image_path),
  }));

  const gallerySources = product.gallery?.length
    ? product.gallery
    : normalizedImages;

  const galleryImages = gallerySources
    .map((image) => normalizeImageUrl(typeof image === "string" ? image : image.image_path))
    .filter(Boolean);

  const mainImage =
    normalizedImages.find((img) => img.is_main) ?? normalizedImages.find((img) => !!img.image_path);

  const initialIndex = mainImage
    ? galleryImages.findIndex((image) => image === mainImage.image_path)
    : 0;
  const soldCountValue = Number(product.sold_count ?? 0);
  const soldCount = Number.isFinite(soldCountValue) ? soldCountValue : 0;
  const relatedProducts = Array.isArray(product.related_products)
    ? (product.related_products as Array<{
        id: number | string;
        name: string;
        slug?: string;
        price: number | string;
        thumbnail?: string | null;
      }>)
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* 左边图片 */}
        <div className="relative">
          <ProductGallery
            images={galleryImages}
            initialIndex={initialIndex >= 0 ? initialIndex : 0}
            alt={product.name}
          />
          <div className="absolute right-3 top-3 z-10">
            <WishlistToggleButton
              productId={product.id}
              initialIsWishlisted={product.is_in_wishlist ?? false}
            />
          </div>
        </div>

        {/* 右边信息 */}
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>

          <div className="flex flex-wrap items-center gap-3">
            {!isRewardOnly && (
              <div className="text-xl font-bold text-[var(--accent-strong)]">
                RM {Number(product.price).toFixed(2)}
              </div>
            )}
            {!isRewardOnly && (
              <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                Sold {soldCount}
              </span>
            )}
          {isRewardOnly && (
            <span className="rounded-full bg-[var(--status-warning-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--status-warning)]">
              Reward Item
            </span>
          )}
        </div>

        {isRewardOnly && product.stock != null && (
          <div className="text-sm text-[color:var(--text-muted)]">
            <p>Stock left: {product.stock}</p>
            {product.stock <= 0 && (
              <p className="mt-1 font-semibold text-[color:var(--status-error)]">Out of stock</p>
            )}
          </div>
        )}

        {!isRewardOnly && product.stock != null && (
          <div className="text-sm text-[color:var(--text-muted)]">
            <p>Stock left: {product.stock}</p>
            {product.stock <= 0 && (
              <p className="mt-1 font-semibold text-[color:var(--status-error)]">Out of stock</p>
            )}
            </div>
          )}

          {product.description && (
            <div className="prose max-w-none text-sm text-[color:var(--text-muted)]">
              {product.description}
            </div>
          )}
          {isRewardOnly || isRewardContext ? (
            <RewardRedeemPanel
              productId={product.id}
              slug={slug}
              fallbackPoints={rewardPoints}
              isRewardOnly={isRewardOnly}
              stock={product.stock ?? null}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <AddToCartButton productId={product.id} stock={product.stock ?? null} />
            </div>
          )}
        </div>
      </div>
      <ProductReviewsSection
        slug={slug}
        initialReviews={reviewsData}
        initialEligibility={eligibility}
        settings={product.review_settings as ReviewSettings | undefined}
      />
            {relatedProducts.length > 0 && (
        <section className="mt-12 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent-strong)]">
              Recommended
            </p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              You May Also Like
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((related) => {
              const priceNumber = Number(related.price);
              const priceLabel = Number.isFinite(priceNumber)
                ? priceNumber.toFixed(2)
                : related.price;
              const thumbnail = related.thumbnail
                ? normalizeImageUrl(related.thumbnail)
                : null;

              return (
                <Link
                  key={related.id}
                  href={`/product/${related.slug ?? related.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card)]/90 shadow-[0_16px_50px_-36px_rgba(15,23,42,0.6)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_-36px_rgba(var(--accent-rgb),0.45)]"
                >
                  <div className="relative h-36 w-full overflow-hidden bg-gradient-to-b from-[var(--background-soft)] via-white/80 to-white">
                    {thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt={related.name}
                        fill
                        className="object-cover transition duration-500 ease-out group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                        No Image
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/80 to-transparent" />
                  </div>
                  <div className="space-y-2 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-[var(--foreground)]">
                      {related.name}
                    </h3>

                    <span className="text-sm font-semibold text-[var(--accent-strong)]">
                      RM {priceLabel}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
