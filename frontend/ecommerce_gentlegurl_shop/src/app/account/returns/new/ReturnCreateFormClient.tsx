"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OrderDetail } from "@/lib/server/getOrderDetail";

type ReturnCreateFormClientProps = {
  order: OrderDetail;
};

type ItemSelection = Record<number, number>;

const reasons = [
  "Damaged item",
  "Wrong item",
  "Size issue",
  "Changed mind",
  "Other",
];

export function ReturnCreateFormClient({ order }: ReturnCreateFormClientProps) {
  const router = useRouter();
  const [reason, setReason] = useState(reasons[0]);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [selection, setSelection] = useState<ItemSelection>(() => {
    const initial: ItemSelection = {};
    order.items.forEach((item) => {
      initial[item.id] = 0;
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageReplaceInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoReplaceInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const [replacingImageIndex, setReplacingImageIndex] = useState<number | null>(null);

  const selectedItems = useMemo(() => {
    return order.items
      .map((item) => ({
        order_item_id: item.id,
        quantity: selection[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
  }, [order.items, selection]);

  const handleQuantityChange = (itemId: number, qty: number) => {
    setSelection((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handleImagesChange = (files: FileList | null) => {
    if (!files) {
      setImages([]);
      return;
    }
    const selected = Array.from(files);
    const merged = [...images, ...selected];
    if (merged.length > 5) {
      setError("Please upload up to 5 photos.");
      setImages(merged.slice(0, 5));
      return;
    }
    setError(null);
    setImages(merged);
  };

  const handleVideoChange = (files: FileList | null) => {
    if (!files || files.length === 0) {
      setVideo(null);
      return;
    }
    setError(null);
    setVideo(files[0]);
  };

  const handleReplaceImageChange = (files: FileList | null) => {
    if (replacingImageIndex === null) return;
    if (!files || files.length === 0) return;
    const file = files[0];
    setImages((prev) => {
      const next = [...prev];
      next[replacingImageIndex] = file;
      return next;
    });
    setReplacingImageIndex(null);
  };

  const handleReplaceVideoChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setVideo(files[0]);
  };

  const imagePreviews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [imagePreviews]);

  const videoPreview = useMemo(() => (video ? URL.createObjectURL(video) : null), [video]);

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (selectedItems.length === 0) {
      setError("Please select at least one item to return.");
      setSubmitting(false);
      return;
    }

    if (images.length === 0) {
      setError("Please upload at least 1 photo.");
      setSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("order_id", String(order.id));
      formData.append("request_type", "return");
      formData.append("reason", reason);
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      selectedItems.forEach((item, index) => {
        formData.append(`items[${index}][order_item_id]`, String(item.order_item_id));
        formData.append(`items[${index}][quantity]`, String(item.quantity));
      });
      images.forEach((file) => {
        formData.append("initial_images[]", file);
      });
      if (video) {
        formData.append("initial_video", video);
      }

      const res = await fetch("/api/proxy/public/shop/returns", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(json?.message ?? "Unable to submit return request.");
        return;
      }

      const returnId = json?.data?.id;
      if (returnId) {
        router.push(`/account/returns/${returnId}`);
      } else {
        router.push("/account/returns");
      }
    } catch (err) {
      setError((err as Error).message ?? "Unable to submit return request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Select Items</h3>
        <div className="mt-3 space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                <p className="text-xs text-[var(--foreground)]/70">Ordered qty: {item.quantity}</p>
                {(item.product_type === "variant" || item.product_variant_id) && (
                  <p className="text-xs text-[var(--foreground)]/60">
                    Variant: {item.variant_name ?? "—"}
                    {item.variant_sku ? ` (${item.variant_sku})` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--foreground)]/70">
                <label htmlFor={`qty-${item.id}`} className="sr-only">
                  Quantity
                </label>
                <select
                  id={`qty-${item.id}`}
                  className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-sm"
                  value={selection[item.id] ?? 0}
                  onChange={(event) => handleQuantityChange(item.id, Number(event.target.value))}
                >
                  {Array.from({ length: item.quantity + 1 }, (_, idx) => idx).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Reason</h3>
        <div className="mt-3 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Reason</label>
            <select
              className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {reasons.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Description</label>
            <textarea
              className="w-full rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add more details (optional)"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">
            Photos (required, up to 5)
          </label>
          <input
            ref={imageInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleImagesChange(event.target.files)}
          />
          <input
            ref={imageReplaceInputRef}
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => handleReplaceImageChange(event.target.files)}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* Photo slots (5) */}
            {Array.from({ length: 5 }).map((_, index) => {
              const preview = imagePreviews[index];
              return (
                <div
                  key={`image-slot-${index}`}
                  className="relative aspect-square rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--background-soft)]/60 overflow-hidden cursor-pointer group"
                  onClick={() => {
                    if (!preview) {
                      imageInputRef.current?.click();
                    }
                  }}
                >
                  {preview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview.url}
                        alt={`Return photo ${index + 1}`}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-200"
                      />
                      {/* Replace & Delete Buttons - Only show on hover */}
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplacingImageIndex(index);
                            imageReplaceInputRef.current?.click();
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Replace image"
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImages((prev) => prev.filter((_, imgIndex) => imgIndex !== index));
                          }}
                          className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Delete image"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2 group-hover:bg-blue-50/50 transition-colors duration-200">
                      <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-all duration-200 group-hover:scale-110">
                        <i className="fa-solid fa-cloud-arrow-up text-gray-400 group-hover:text-blue-500 text-lg transition-colors duration-200" />
                      </div>
                      <span className="text-[10px] text-gray-500 group-hover:text-blue-600 text-center font-medium transition-colors duration-200">Click to upload</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-[var(--foreground)]">
            Video (optional, max 1)
          </label>
          <input
            ref={videoInputRef}
            className="hidden"
            type="file"
            accept="video/*"
            onChange={(event) => handleVideoChange(event.target.files)}
          />
          <input
            ref={videoReplaceInputRef}
            className="hidden"
            type="file"
            accept="video/*"
            onChange={(event) => handleReplaceVideoChange(event.target.files)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-md">
            {/* Video slot (1) */}
            <div
              className="relative aspect-square rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--background-soft)]/60 overflow-hidden cursor-pointer group"
              onClick={(e) => {
                if (!videoPreview) {
                  videoInputRef.current?.click();
                } else {
                  // Toggle video play/pause when clicking on video
                  if (videoPlayerRef.current) {
                    if (videoPlayerRef.current.paused) {
                      videoPlayerRef.current.play();
                    } else {
                      videoPlayerRef.current.pause();
                    }
                  }
                }
              }}
            >
              {videoPreview ? (
                <>
                  <video
                    ref={videoPlayerRef}
                    src={videoPreview}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-200"
                    controls={false}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* Replace & Delete Buttons - Only show on hover */}
                  <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        videoReplaceInputRef.current?.click();
                      }}
                      className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                      aria-label="Replace video"
                    >
                      <i className="fa-solid fa-image text-xs" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideo(null);
                      }}
                      className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                      aria-label="Delete video"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </div>
                  {/* Video play icon overlay - only show when paused */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors duration-200 pointer-events-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <i className="fa-solid fa-play text-white text-2xl opacity-80" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 group-hover:bg-blue-50/50 transition-colors duration-200">
                  <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-all duration-200 group-hover:scale-110">
                    <i className="fa-solid fa-cloud-arrow-up text-gray-400 group-hover:text-blue-500 text-lg transition-colors duration-200" />
                  </div>
                  <span className="text-[10px] text-gray-500 group-hover:text-blue-600 text-center font-medium transition-colors duration-200">Click to upload</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Return"}
        </button>
        <span className="text-sm text-[var(--foreground)]/70">
          Return requests are reviewed by our team before approval.
        </span>
      </div>
    </form>
  );
}
