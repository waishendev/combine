"use client";

import { useEffect, useState } from "react";
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
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);

  const handleImageError = (src: string) => {
    setImageErrors((prev) => new Set(prev).add(src));
  };

  const getImageSrc = (src: string) => (imageErrors.has(src) ? PLACEHOLDER_IMAGE : src);

  const activeMedia = safeMedia[activeIndex] ?? safeMedia[0];
  const videoSource = safeMedia.find((item) => item.type === "video")?.url ?? null;

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

  useEffect(() => {
    if (!videoSource) {
      setVideoThumbnail(null);
      return;
    }

    let isCancelled = false;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = videoSource;

    const handleLoaded = () => {
      if (isCancelled) return;
      const width = video.videoWidth || 320;
      const height = video.videoHeight || 180;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setVideoThumbnail(null);
        return;
      }
      ctx.drawImage(video, 0, 0, width, height);
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        if (!isCancelled) {
          setVideoThumbnail(dataUrl);
        }
      } catch {
        if (!isCancelled) {
          setVideoThumbnail(null);
        }
      }
    };

    const handleError = () => {
      if (!isCancelled) {
        setVideoThumbnail(null);
      }
    };

    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("error", handleError);
    video.load();

    return () => {
      isCancelled = true;
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
  }, [videoSource]);

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
              ? item.thumbnail_url || videoThumbnail || null
              : item.url || PLACEHOLDER_IMAGE;
            const resolvedThumbnail = thumbnailSrc ? getImageSrc(thumbnailSrc) : null;
            const videoThumbnailSource = item.url || videoSource || undefined;

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
                ) : isVideo && videoThumbnailSource ? (
                  <video
                    className="h-full w-full object-cover"
                    src={videoThumbnailSource}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--muted)]/40 text-[color:var(--text-muted)]">
                    <i className="fa-solid fa-video" />
                  </div>
                )}
                {isVideo && (
                  <>
                    <span className="absolute right-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      Video
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center text-white">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55">
                        <i className="fa-solid fa-play text-xs" />
                      </span>
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
