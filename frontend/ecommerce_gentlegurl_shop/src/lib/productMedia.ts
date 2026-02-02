import { normalizeImageUrl } from "./imageUrl";

export type ProductMediaItem = {
  id?: number | string;
  type?: "image" | "video" | string;
  url?: string | null;
  image_path?: string | null;
  thumbnail_url?: string | null;
  poster_url?: string | null;
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

const resolveLegacyImage = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("/images/")) {
    return value;
  }
  return normalizeMediaUrl(value);
};

const sortByOrder = <T extends { sort_order?: number | null }>(items: T[]) =>
  [...items].sort((a, b) => toNumber(a.sort_order) - toNumber(b.sort_order));

export function getVideoPoster(
  _source: ProductMediaSource,
  video?: ProductMediaItem | null,
): string | null {
  const poster =
    video?.thumbnail_url ??
    (video as { poster_url?: string | null })?.poster_url ??
    null;

  if (poster) {
    return resolveLegacyImage(poster) || null;
  }

  return null;
}

// Cover/primary image rule: first image by sort_order (never a video).
export function getPrimaryProductImage(
  source: ProductMediaSource,
  options: { allowVideoPoster?: boolean } = {},
): string {
  const mediaImages = source.media?.filter((item) => item.type === "image") ?? [];
  if (mediaImages.length > 0) {
    const sorted = sortByOrder(mediaImages);
    const url = normalizeMediaUrl(sorted[0]?.url ?? sorted[0]?.image_path ?? null);
    if (url) {
      return url;
    }
  }

  const images = source.images ?? [];
  if (images.length > 0) {
    const sorted = sortByOrder(images);
    const url = normalizeMediaUrl(sorted[0]?.url ?? sorted[0]?.image_path ?? null);
    if (url) {
      return url;
    }
  }

  const direct =
    source.cover_image_url ??
    source.product_image ??
    source.image_url ??
    source.thumbnail ??
    null;

  if (direct) {
    return resolveLegacyImage(direct) || PLACEHOLDER_IMAGE;
  }

  if (options.allowVideoPoster !== false) {
    const video = source.media?.find((item) => item.type === "video") ?? source.video ?? null;
    if (video) {
      const poster = getVideoPoster(source, video);
      if (poster) {
        return poster;
      }
    }
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
    url: normalizeMediaUrl(item.url ?? ('image_path' in item ? item.image_path : null) ?? null),
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
