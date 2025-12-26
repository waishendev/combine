"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ApiError,
  PageReview,
  PageReviewList,
  PageReviewSetting,
  PublicStoreLocation,
  getPageReviewSettings,
  getPageReviews,
  getStoreLocations,
  getStoreLocationDetail,
  submitPageReview,
} from "@/lib/apiClient";

type Pagination = PageReviewList["pagination"];

function getErrorMessage(error: unknown): string {
  if (!error) return "Something went wrong.";

  const apiError = error as ApiError;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = apiError?.data as any;

  if (data?.message && typeof data.message === "string") {
    return data.message;
  }

  if (apiError?.message) {
    return apiError.message;
  }

  return "Something went wrong.";
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}

export default function ReviewsPage() {
  const { customer } = useAuth();

  const [settings, setSettings] = useState<PageReviewSetting | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [locations, setLocations] = useState<PublicStoreLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [storeDetail, setStoreDetail] = useState<PublicStoreLocation | null>(null);
  const [loadingStoreDetail, setLoadingStoreDetail] = useState(false);

  const [reviews, setReviews] = useState<PageReview[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    rating: 5,
    title: "",
    body: "",
    photos: [] as File[],
  });
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getPageReviewSettings();
        setSettings(data);
      } catch (err) {
        setError(getErrorMessage(err));
        setSettings({ enabled: false });
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const loadLocations = async () => {
      setLoadingLocations(true);
      try {
        const data = await getStoreLocations();
        setLocations(data);
        setSelectedLocationId((current) => current ?? (data[0]?.id ?? null));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingLocations(false);
      }
    };

    loadLocations();
  }, []);

  useEffect(() => {
    const loadStoreDetail = async () => {
      if (!selectedLocationId) return;
      setLoadingStoreDetail(true);
      try {
        const data = await getStoreLocationDetail(selectedLocationId);
        setStoreDetail(data);
      } catch (err) {
        setError(getErrorMessage(err));
        setStoreDetail(null);
      } finally {
        setLoadingStoreDetail(false);
      }
    };

    loadStoreDetail();
  }, [selectedLocationId]);

  useEffect(() => {
    if (!customer) return;

    setForm((prev) => ({
      ...prev,
      name: prev.name || customer.profile.name || "",
      email: prev.email || customer.profile.email || "",
    }));
  }, [customer]);

  const fetchReviews = useCallback(
    async (page?: number) => {
      if (!selectedLocationId) return;

      setLoadingReviews(true);
      setError(null);
      try {
        const data = await getPageReviews({
          store_location_id: selectedLocationId,
          page,
        });
        setReviews(data.items);
        setPagination(data.pagination);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingReviews(false);
      }
    },
    [selectedLocationId],
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocationId) {
      setError("Please select a store location.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await submitPageReview({
        store_location_id: selectedLocationId,
        name: customer ? customer.profile.name : form.name,
        email: customer ? customer.profile.email : form.email || undefined,
        rating: form.rating,
        title: form.title || undefined,
        content: form.body,
        photos: form.photos,
      });

      setMessage("Thank you for your review!");
      setForm((prev) => ({
        ...prev,
        title: "",
        body: "",
        rating: 5,
        photos: [],
      }));
      setPhotoPreviews([]);
      await fetchReviews(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePageChange = async (page: number) => {
    await fetchReviews(page);
  };

  if (loadingSettings) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-center text-sm text-[color:var(--text-muted)]">Loading reviews...</p>
      </main>
    );
  }

  if (settings && !settings.enabled) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Reviews</h1>
          <p className="mt-4 text-sm text-[color:var(--text-muted)]">Reviews is currently disabled.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Community</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Store Reviews</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Read what other customers say and share your experience for each location.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm">
        {storeDetail?.images && storeDetail.images.length > 0 ? (
          <div className="mb-4 overflow-hidden rounded-lg">
            <div className="flex gap-3 overflow-x-auto">
              {storeDetail.images.map((image) => (
                <img
                  key={image.id}
                  src={image.image_url || image.image_path}
                  alt={storeDetail.name}
                  className="h-48 min-w-[240px] rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4 flex h-48 items-center justify-center rounded-lg bg-[var(--muted)]/40 text-sm text-[color:var(--text-muted)]">
            {loadingStoreDetail ? "Loading store photos..." : "No store photos available"}
          </div>
        )}

        <label className="block text-sm font-medium text-[color:var(--text-muted)]">
          Select Store Location
          <select
            className="mt-2 w-full rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm focus:border-[var(--accent-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
            value={selectedLocationId ?? ""}
            onChange={(e) => setSelectedLocationId(Number(e.target.value))}
            disabled={loadingLocations}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} {location.code ? `(${location.code})` : ""}
              </option>
            ))}
          </select>
        </label>

        {storeDetail && (
          <div className="mt-4 rounded-lg border border-[var(--card-border)]/60 bg-[var(--muted)]/40 p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {storeDetail.name} {storeDetail.code ? `(${storeDetail.code})` : ""}
                </h3>
              </div>
              <p className="text-sm text-[color:var(--text-muted)]">
                {[
                  storeDetail.address_line1,
                  storeDetail.address_line2,
                  storeDetail.city,
                  storeDetail.state,
                  storeDetail.postcode,
                  storeDetail.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {storeDetail.phone && <p className="text-sm text-[color:var(--text-muted)]">📞 {storeDetail.phone}</p>}
              {storeDetail.opening_hours && (
                <div className="text-sm text-[color:var(--text-muted)]">
                  <p className="font-medium">Opening Hours</p>
                  <ul className="mt-1 space-y-1 text-[color:var(--text-muted)]">
                    {Object.entries(storeDetail.opening_hours).map(([key, value]) => (
                      <li key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace("_", " ")}:</span>
                        <span>{value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>



      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex max-h-[600px] flex-col rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Recent Reviews</h2>
            {pagination && (
              <p className="text-xs text-[color:var(--text-muted)]">
                Page {pagination.page} • {pagination.total} reviews total
              </p>
            )}
          </div>

          <div className="mt-4 max-h-[550px] flex-1 overflow-y-auto pr-2">
            {loadingReviews ? (
              <p className="text-sm text-[color:var(--text-muted)]">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-[color:var(--text-muted)]">No reviews yet for this store.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <article key={review.id} className="rounded-lg border border-[var(--card-border)]/60 bg-[var(--muted)]/40/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{review.name}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">{formatDate(review.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[color:var(--status-warning)]">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <span key={index} className={index < review.rating ? "text-[color:var(--status-warning)]" : "text-[var(--muted)]"}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    {review.title && <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{review.title}</p>}
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{review.body}</p>
                    {review.photos && review.photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {review.photos.map((photo) => (
                          <img
                            key={photo.id}
                            src={photo.file_url || photo.file_path}
                            alt="Review photo"
                            className="h-24 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          {pagination && pagination.total > pagination.per_page && (
            <div className="mt-4 flex items-center gap-3 border-t border-[var(--card-border)]/60 pt-4">
              <button
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[color:var(--text-muted)] hover:bg-[var(--muted)]/40 disabled:cursor-not-allowed disabled:text-[color:var(--text-muted)]"
                disabled={loadingReviews || (pagination?.page ?? 1) <= 1}
                onClick={() => handlePageChange((pagination?.page ?? 1) - 1)}
              >
                Previous
              </button>
              <button
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm text-[color:var(--text-muted)] hover:bg-[var(--muted)]/40 disabled:cursor-not-allowed disabled:text-[color:var(--text-muted)]"
                disabled={
                  loadingReviews ||
                  !pagination ||
                  pagination.page * pagination.per_page >= pagination.total
                }
                onClick={() => handlePageChange((pagination?.page ?? 1) + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Add a Review</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">Share your experience with this store.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {message}
            </div>
          )}
          
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            {!customer && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-[color:var(--text-muted)]">
                  Name
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-[var(--input-border)] px-3 py-2.5 text-sm transition focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]/20"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="Your name"
                  />
                </label>
                <label className="text-sm font-medium text-[color:var(--text-muted)]">
                  Email (optional)
                  <input
                    type="email"
                    className="mt-2 w-full rounded-lg border border-[var(--input-border)] px-3 py-2.5 text-sm transition focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]/20"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </label>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-[color:var(--text-muted)]">Rating</label>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, rating: index + 1 }))}
                      className={`text-2xl transition hover:scale-110 ${
                        index < form.rating ? "text-[color:var(--status-warning)]" : "text-[var(--muted)]"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <span className="text-sm font-semibold text-[color:var(--text-muted)]">{form.rating} out of 5</span>
              </div>
            </div>

            <label className="text-sm font-medium text-[color:var(--text-muted)]">
              Title (optional)
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-[var(--input-border)] px-3 py-2.5 text-sm transition focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]/20"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Great service!"
              />
            </label>

            <label className="text-sm font-medium text-[color:var(--text-muted)]">
              Your Review
              <textarea
                className="mt-2 w-full rounded-lg border border-[var(--input-border)] px-3 py-2.5 text-sm transition focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]/20"
                rows={4}
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                required
                minLength={5}
                placeholder="Tell us about your visit..."
              />
            </label>

            <div>
              <label className="text-sm font-medium text-[color:var(--text-muted)]">Upload photos (optional)</label>
              <div className="mt-2 flex flex-wrap items-start gap-3">
                {/* Add button - only show if less than 3 photos */}
                {form.photos.length < 3 && (
                  <label className="group relative flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--input-border)] bg-[var(--muted)]/40 transition hover:border-[var(--accent-strong)] hover:bg-[var(--background-soft)]/30">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={async (e) => {
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        if (files.length === 0) return;
                        
                        // Limit to 3 photos total
                        const remainingSlots = 3 - form.photos.length;
                        const filesToAdd = files.slice(0, remainingSlots);
                        
                        if (filesToAdd.length === 0) return;
                        
                        setForm((prev) => ({ ...prev, photos: [...prev.photos, ...filesToAdd] }));
                        
                        // Create previews for new files
                        const previewPromises = filesToAdd.map((file) => {
                          return new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(file);
                          });
                        });
                        
                        const newPreviews = await Promise.all(previewPromises);
                        setPhotoPreviews((prev) => [...prev, ...newPreviews]);
                      }}
                    />
                    <svg
                      className="h-8 w-8 text-[color:var(--text-muted)] transition group-hover:text-[var(--accent-strong)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">Add</span>
                  </label>
                )}

                {/* Photo previews */}
                {form.photos.map((photo, index) => (
                  <div key={index} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--muted)]/40">
                    <img
                      src={photoPreviews[index] || URL.createObjectURL(photo)}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          photos: prev.photos.filter((_, i) => i !== index),
                        }));
                        setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
                      }}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition hover:bg-black/90 group-hover:opacity-100"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {form.photos.length > 0 && (
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  {form.photos.length} of 3 photos selected
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || loadingReviews}
              className="w-full rounded-lg bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent-stronger)] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:from-[var(--accent-stronger)] hover:to-[var(--accent-stronger)] hover:shadow-lg disabled:cursor-not-allowed disabled:from-[var(--muted)] disabled:to-[var(--muted)] disabled:shadow-none"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
