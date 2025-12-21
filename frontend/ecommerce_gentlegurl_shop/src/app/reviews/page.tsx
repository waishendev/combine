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
        <p className="text-center text-sm text-gray-600">Loading reviews...</p>
      </main>
    );
  }

  if (settings && !settings.enabled) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Reviews</h1>
          <p className="mt-4 text-sm text-gray-600">Reviews is currently disabled.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-500">Community</p>
          <h1 className="text-3xl font-semibold text-gray-900">Store Reviews</h1>
          <p className="mt-2 text-sm text-gray-600">
            Read what other customers say and share your experience for each location.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
          <div className="mb-4 flex h-48 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">
            {loadingStoreDetail ? "Loading store photos..." : "No store photos available"}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700">
          Select Store Location
          <select
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
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
          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {storeDetail.name} {storeDetail.code ? `(${storeDetail.code})` : ""}
                </h3>
              </div>
              <p className="text-sm text-gray-700">
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
              {storeDetail.phone && <p className="text-sm text-gray-700">📞 {storeDetail.phone}</p>}
              {storeDetail.opening_hours && (
                <div className="text-sm text-gray-700">
                  <p className="font-medium">Opening Hours</p>
                  <ul className="mt-1 space-y-1 text-gray-600">
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

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Recent Reviews</h2>
            {pagination && (
              <p className="text-xs text-gray-500">
                Page {pagination.page} • {pagination.total} reviews total
              </p>
            )}
          </div>

          {loadingReviews ? (
            <p className="mt-4 text-sm text-gray-500">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No reviews yet for this store.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{review.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(review.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span key={index} className={index < review.rating ? "text-yellow-400" : "text-gray-300"}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  {review.title && <p className="mt-2 text-sm font-medium text-gray-900">{review.title}</p>}
                  <p className="mt-1 text-sm text-gray-700">{review.body}</p>
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

          {pagination && pagination.total > pagination.per_page && (
            <div className="mt-4 flex items-center gap-3">
              <button
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                disabled={loadingReviews || (pagination?.page ?? 1) <= 1}
                onClick={() => handlePageChange((pagination?.page ?? 1) - 1)}
              >
                Previous
              </button>
              <button
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
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

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Add a Review</h2>
          <p className="mt-1 text-sm text-gray-600">Share your experience with this store.</p>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            {!customer && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  Name
                  <input
                    type="text"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="Your name"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Email (optional)
                  <input
                    type="email"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </label>
              </div>
            )}

            <label className="text-sm font-medium text-gray-700">
              Rating
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, rating: Number(e.target.value) }))
                  }
                  className="w-full accent-pink-500"
                />
                <span className="w-10 text-right text-sm font-semibold text-gray-900">{form.rating}★</span>
              </div>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Title (optional)
              <input
                type="text"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Great service!"
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Your Review
              <textarea
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                rows={4}
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                required
                minLength={5}
                placeholder="Tell us about your visit..."
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Upload photos (optional)
              <input
                type="file"
                multiple
                accept="image/*"
                className="mt-2 block w-full text-sm text-gray-700"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, photos: e.target.files ? Array.from(e.target.files) : [] }))
                }
              />
            </label>

            <button
              type="submit"
              disabled={submitting || loadingReviews}
              className="w-full rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-pink-300"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
