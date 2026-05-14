"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type Props = {
  canEdit: boolean;
};

type DepositTermsSetting = {
  enabled: boolean;
  text: string;
  image: string | null;
};

const DEPOSIT_TNC_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

const defaultSetting: DepositTermsSetting = {
  enabled: true,
  text: "Deposit rules and confirmation become necessary to agree deposit T&C",
  image: null,
};

export default function BookingDepositTermsSettingsCard({ canEdit }: Props) {
  const [setting, setSetting] = useState<DepositTermsSetting>(defaultSetting);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const previewImage = imagePreview ?? (removeImage ? null : setting.image);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        const res = await fetch("/api/ecommerce/shop-settings?type=booking", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const payload = await res.json();
        setSetting({
          enabled: Boolean(
            payload?.data?.booking_deposit_tnc_enabled ??
            defaultSetting.enabled,
          ),
          text: String(
            payload?.data?.booking_deposit_tnc_text ?? defaultSetting.text,
          ),
          image:
            typeof payload?.data?.booking_deposit_tnc_image === "string" &&
            payload.data.booking_deposit_tnc_image.trim() !== ""
              ? payload.data.booking_deposit_tnc_image
              : null,
        });
      } catch (e) {
        console.error(e);
        setError("Unable to load booking deposit terms settings.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setRemoveImage(false);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const [enabledRes, textRes] = await Promise.all([
        fetch(
          "/api/ecommerce/shop-settings/booking_deposit_tnc_enabled?type=booking",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "booking", value: setting.enabled }),
          },
        ),
        fetch(
          "/api/ecommerce/shop-settings/booking_deposit_tnc_text?type=booking",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "booking", value: setting.text }),
          },
        ),
      ]);

      if (!enabledRes.ok || !textRes.ok) throw new Error("Failed to save");

      if (imageFile || removeImage) {
        const formData = new FormData();
        formData.append("type", "booking");
        if (imageFile) {
          formData.append("image_file", imageFile);
        }
        if (removeImage) {
          formData.append("remove", "1");
        }

        const imageRes = await fetch(
          "/api/proxy/ecommerce/shop-settings/booking_deposit_tnc_image?type=booking",
          {
            method: "POST",
            body: formData,
          },
        );
        const imagePayload = await imageRes.json().catch(() => null);
        if (!imageRes.ok) {
          throw new Error(
            imagePayload?.message || "Failed to save deposit T&C image",
          );
        }

        const updatedImage =
          typeof imagePayload?.data?.value === "string" &&
          imagePayload.data.value.trim() !== ""
            ? imagePayload.data.value
            : null;
        setSetting((prev) => ({ ...prev, image: updatedImage }));
        setImageFile(null);
        setImagePreview(null);
        setRemoveImage(false);
        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }
      }

      setMessage("Booking deposit terms settings saved.");
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save booking deposit terms settings.",
      );
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 2500);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        Loading booking deposit terms settings...
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-2xl font-semibold text-slate-900 mt-1">
        Booking Deposit Terms
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        Configure deposit terms text and the optional image shown in the booking
        checkout drawer.
      </p>

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-700">
                Enable Deposit T&amp;C image
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Show the configured deposit T&amp;C image above the terms text.
              </p>
            </div>
            <input
              type="checkbox"
              checked={setting.enabled}
              disabled={!canEdit}
              onChange={(e) =>
                setSetting((prev) => ({ ...prev, enabled: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Deposit T&amp;C Text
            </span>
            <textarea
              rows={4}
              value={setting.text}
              disabled={!canEdit}
              onChange={(event) =>
                setSetting((prev) => ({ ...prev, text: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div>
            <h4 className="text-base font-semibold text-slate-900">
              Deposit T&amp;C Image
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Upload a PNG, JPG, or WEBP for the booking cart deposit T&amp;C (fits the drawer; use safe margins on
              narrow screens).
            </p>
            <p className="mt-1 text-xs font-semibold text-red-600">Suggested size: 330 × 320 px</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white p-2">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Deposit T&C preview"
                  className="max-h-96 w-full rounded-xl object-contain"
                />
              ) : (
                <div className="px-6 text-center text-xs text-slate-400">
                  No Deposit T&amp;C image uploaded yet
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Upload image
              </label>
              <input
                ref={imageInputRef}
                type="file"
                accept={DEPOSIT_TNC_IMAGE_ACCEPT}
                disabled={!canEdit}
                onChange={handleImageChange}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="text-xs text-slate-400">
                Accepted formats: PNG, JPG, WEBP. Portrait or mobile-friendly artwork with safe margins works best.
              </p>
              {previewImage ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={handleRemoveImage}
                  className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove image
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canEdit || saving}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
