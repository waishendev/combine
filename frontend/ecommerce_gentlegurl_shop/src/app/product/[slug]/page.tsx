import Image from "next/image";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { WishlistToggleButton } from "@/components/wishlist/WishlistToggleButton";
import { getProduct } from "@/lib/server/getProduct";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return notFound();

  const mainImage =
    product.images?.find((img) => img.is_main) ?? product.images?.[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* 左边图片 */}
        <div>
          {mainImage ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
              <Image
                src={mainImage.image_path}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              No Image
            </div>
          )}

          {product.images?.length > 1 && (
            <div className="mt-4 flex gap-2">
              {product.images.map((img) => (
                <div
                  key={img.id}
                  className={`relative h-16 w-16 overflow-hidden rounded border ${
                    img.id === mainImage?.id
                      ? "border-black"
                      : "border-gray-200"
                  }`}
                >
                  <Image
                    src={img.image_path}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

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
