"use client";

import { useEffect, useState, useRef } from "react";
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
  const [videoThumbnails, setVideoThumbnails] = useState<Map<string, string>>(new Map());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const handleImageError = (src: string) => {
    setImageErrors((prev) => new Set(prev).add(src));
  };

  const getImageSrc = (src: string) => (imageErrors.has(src) ? PLACEHOLDER_IMAGE : src);

  const activeMedia = safeMedia[activeIndex] ?? safeMedia[0];

  if (!safeMedia.length || !activeMedia) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-[var(--muted)]/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PLACEHOLDER_IMAGE}
          alt="No media available"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const isVideoActive = activeMedia.type === "video";
  const poster = activeMedia.thumbnail_url
    ? getImageSrc(activeMedia.thumbnail_url)
    : videoPoster || undefined;

  // Generate thumbnails for all video items
  useEffect(() => {
    const videoItems = safeMedia.filter((item) => item.type === "video" && item.url);
    if (videoItems.length === 0) return;

    const thumbnails = new Map<string, string>();
    let isCancelled = false;
    const cleanupFunctions: Array<() => void> = [];

    const generateThumbnail = (videoUrl: string) => {
      return new Promise<void>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.src = videoUrl;

        const handleSeeked = () => {
          if (isCancelled) {
            resolve();
            return;
          }
          try {
            const width = video.videoWidth || 320;
            const height = video.videoHeight || 180;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
              if (!isCancelled) {
                thumbnails.set(videoUrl, dataUrl);
              }
            }
          } catch (error) {
            // Silently fail
          }
          resolve();
        };

        const handleError = () => {
          resolve();
        };

        const handleLoadedMetadata = () => {
          if (isCancelled) {
            resolve();
            return;
          }
          video.currentTime = 0.1; // Seek to first frame
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("seeked", handleSeeked);
        video.addEventListener("error", handleError);
        video.load();

        // Store cleanup function
        cleanupFunctions.push(() => {
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          video.removeEventListener("seeked", handleSeeked);
          video.removeEventListener("error", handleError);
        });
      });
    };

    Promise.all(videoItems.map((item) => generateThumbnail(item.url!))).then(() => {
      if (!isCancelled) {
        setVideoThumbnails(thumbnails);
      }
    });

    return () => {
      isCancelled = true;
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [safeMedia]);

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
            let thumbnailSrc: string | null = null;

            if (isVideo) {
              // Priority: 1. item.thumbnail_url, 2. generated thumbnail, 3. null (will show video element)
              thumbnailSrc = item.thumbnail_url
                ? getImageSrc(item.thumbnail_url)
                : (item.url ? videoThumbnails.get(item.url) || null : null);
            } else {
              thumbnailSrc = item.url || PLACEHOLDER_IMAGE;
            }

            const resolvedThumbnail = thumbnailSrc ? getImageSrc(thumbnailSrc) : null;
            const videoUrl = isVideo && item.url ? item.url : undefined;

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
                ) : isVideo && videoUrl ? (
                  <video
                    ref={(el) => {
                      if (el && !videoRefs.current.has(videoUrl)) {
                        videoRefs.current.set(videoUrl, el);
                        // Ensure video shows first frame
                        el.currentTime = 0.1;
                        el.addEventListener("loadedmetadata", () => {
                          el.currentTime = 0.1;
                        });
                      }
                    }}
                    className="h-full w-full object-cover"
                    src={videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      video.currentTime = 0.1;
                    }}
                    onSeeked={(e) => {
                      const video = e.currentTarget;
                      video.pause();
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--muted)]/40 text-[color:var(--text-muted)]">
                    <i className="fa-solid fa-video" />
                  </div>
                )}
                {isVideo && (
                  <>
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
