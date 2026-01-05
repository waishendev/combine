"use client";

import { useState } from "react";
import { PLACEHOLDER_IMAGE, type ProductMediaItem } from "@/lib/productMedia";

type ProductGalleryProps = {
  media: ProductMediaItem[];
  initialIndex?: number;
  videoPoster?: string | null;
  alt: string;
};

export function ProductGallery({ media, initialIndex = 0, videoPoster, alt }: ProductGalleryProps) {
  const safeMedia = media.filter((item) => item.url);
  const [activeIndex, setActiveIndex] = useState(
    initialIndex >= 0 && initialIndex < safeMedia.length ? initialIndex : 0,
  );
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (src: string) => {
    setImageErrors((prev) => new Set(prev).add(src));
  };

  const getImageSrc = (src: string) => (imageErrors.has(src) ? PLACEHOLDER_IMAGE : src);

  const activeMedia = safeMedia[activeIndex] ?? safeMedia[0];

  if (!safeMedia.length || !activeMedia) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-[var(--muted)]/40 text-[color:var(--text-muted)]">
        No Media
      </div>
    );
  }

  const isVideoActive = activeMedia.type === "video";
  const poster = activeMedia.thumbnail_url
    ? getImageSrc(activeMedia.thumbnail_url)
    : videoPoster || undefined;

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[var(--muted)]/40">
        {isVideoActive ? (
          <>
            <video
              className="h-full w-full object-cover"
              src={activeMedia.url ?? undefined}
              poster={poster}
              controls
              playsInline
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
              <i className="fa-solid fa-play" />
              Video
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageSrc(activeMedia.url ?? "")}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => handleImageError(activeMedia.url ?? "")}
          />
        )}
      </div>

      {safeMedia.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {safeMedia.map((item, index) => {
            const isVideo = item.type === "video";
            const thumbnailSrc = isVideo
              ? item.thumbnail_url || videoPoster || null
              : item.url || PLACEHOLDER_IMAGE;
            const resolvedThumbnail = thumbnailSrc ? getImageSrc(thumbnailSrc) : null;

            return (
              <button
                key={`${item.id ?? item.url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border transition ${
                  index === activeIndex
                    ? "border-[var(--accent-strong)]"
                    : "border-[var(--card-border)] hover:border-[var(--accent)]"
                }`}
              >
                {resolvedThumbnail ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedThumbnail}
                      alt={`${alt} thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                      onError={() => thumbnailSrc && handleImageError(thumbnailSrc)}
                    />
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--muted)]/40 text-[color:var(--text-muted)]">
                    <i className="fa-solid fa-video" />
                  </div>
                )}
                {isVideo && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35 text-white text-[10px] font-semibold uppercase tracking-wide">
                    <i className="fa-solid fa-play text-base" />
                    Video
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
