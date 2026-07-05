export type OrderItemImageSource = {
  cover_image_url?: string | null;
  product_image?: string | null;
};

function resolveImageUrl(value?: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/storage/${trimmed.replace(/^\/+/, "")}`;
}

export function getOrderItemDisplayImage(item: OrderItemImageSource): string | null {
  return resolveImageUrl(item.cover_image_url ?? item.product_image);
}
