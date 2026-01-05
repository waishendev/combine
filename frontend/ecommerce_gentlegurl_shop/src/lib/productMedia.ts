import { normalizeImageUrl } from "./imageUrl";

export type ProductMediaItem = {
  id?: number | string;
  type?: "image" | "video" | string;
  url?: string | null;
  image_path?: string | null;
  thumbnail_url?: string | null;
  sort_order?: number | null;
  status?: string | null;
};

export type ProductMediaSource = {
  cover_image_url?: string | null;
  image_url?: string | null;
  product_image?: string | null;
  thumbnail?: string | null;
  images?: Array<{ image_path?: string | null; url?: string | null; sort_order?: number | null }>;
  media?: ProductMediaItem[] | null;
  video?: ProductMediaItem | null;
};

export const PLACEHOLDER_IMAGE = "/images/placeholder.png";

const toNumber = (value: unknown) =>
  typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseInt(value, 10)
      : 0;

const normalizeMediaUrl = (value?: string | null) =>
  value ? normalizeImageUrl(value) : "";

// Cover image rule: always the first image by sort_order (never a video).
export function getCoverImageUrl(source: ProductMediaSource): string {
  const direct =
    source.cover_image_url ??
    source.product_image ??
    source.image_url ??
    source.thumbnail ??
    null;

  if (direct) {
    if (direct.startsWith("/images/")) {
      return direct;
    }
    const normalized = normalizeMediaUrl(direct);
    return normalized || PLACEHOLDER_IMAGE;
  }

  const mediaImages =
    source.media?.filter((item) => item.type === "image") ?? [];

  if (mediaImages.length > 0) {
    const sorted = [...mediaImages].sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order));
    const url = normalizeMediaUrl(sorted[0]?.url ?? sorted[0]?.image_path ?? null);
    return url || PLACEHOLDER_IMAGE;
  }

  const images = source.images ?? [];
  if (images.length > 0) {
    const sorted = [...images].sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order));
    const url = normalizeMediaUrl(sorted[0]?.url ?? sorted[0]?.image_path ?? null);
    return url || PLACEHOLDER_IMAGE;
  }

  return PLACEHOLDER_IMAGE;
}

// Detail gallery rule: video (if any) first, then images sorted by sort_order.
export function buildProductGalleryMedia(source: ProductMediaSource): ProductMediaItem[] {
  const mediaItems = Array.isArray(source.media) ? source.media : [];
  const imagesFromMedia = mediaItems.filter((item) => item.type === "image");
  const videoFromMedia = mediaItems.find((item) => item.type === "video");

  const images = imagesFromMedia.length
    ? imagesFromMedia
    : (source.images ?? []).map((image) => ({
        type: "image",
        url: image.url ?? image.image_path ?? null,
        sort_order: image.sort_order ?? 0,
      }));

  const video = videoFromMedia ?? source.video ?? null;

  const sortedImages = [...images].sort(
    (a, b) => toNumber(a.sort_order) - toNumber(b.sort_order),
  );

  const normalizedImages = sortedImages.map((item) => ({
    ...item,
    url: normalizeMediaUrl(item.url ?? item.image_path ?? null),
  }));

  const normalizedVideo = video
    ? {
        ...video,
        url: normalizeMediaUrl(video.url ?? null),
        thumbnail_url: normalizeMediaUrl(video.thumbnail_url ?? null),
      }
    : null;

  return normalizedVideo
    ? [normalizedVideo, ...normalizedImages]
    : normalizedImages;
}
