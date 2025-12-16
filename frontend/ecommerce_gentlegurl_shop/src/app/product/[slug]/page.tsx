import { notFound } from "next/navigation";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";
import { getProduct } from "@/lib/server/getProduct";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { ProductGallery } from "@/components/product/ProductGallery";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return notFound();

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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* 左边图片 */}
        <ProductGallery
          images={galleryImages}
          initialIndex={initialIndex >= 0 ? initialIndex : 0}
          alt={product.name}
        />

        {/* 右边信息 */}
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{product.name}</h1>

          <div className="text-xl font-bold text-red-600">
            RM {Number(product.price).toFixed(2)}
          </div>

          {product.stock !== undefined && (
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
          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton productId={product.id} />
            <WishlistToggleButton
              productId={product.id}
              initialIsWishlisted={product.is_in_wishlist ?? false}
              variant="button"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
