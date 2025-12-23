import { notFound } from "next/navigation";
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
  const [{ slug }, resolvedSearchParams = {}] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);

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
              <div className="text-xl font-bold text-red-600">
                RM {Number(product.price).toFixed(2)}
              </div>
            )}
            {!isRewardOnly && (
              <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#ec4899]">
                Sold {soldCount}
              </span>
            )}
            {isRewardOnly && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                Reward Item
              </span>
            )}
          </div>

          {!isRewardOnly && product.stock != null && (
            <div className="text-sm text-gray-500">
              Stock: {product.stock}{" "}
              {product.stock <= (product.low_stock_threshold ?? 0) &&
                "(Low stock)"}
            </div>
          )}

          {product.description && (
            <div className="prose max-w-none text-sm text-gray-700">
              {product.description}
            </div>
          )}
          {isRewardOnly || isRewardContext ? (
            <RewardRedeemPanel
              productId={product.id}
              slug={slug}
              fallbackPoints={rewardPoints}
              isRewardOnly={isRewardOnly}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <AddToCartButton productId={product.id} />
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
    </main>
  );
}
