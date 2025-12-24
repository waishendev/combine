"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { uploadPaymentSlip } from "@/lib/apiClient";

type UploadReceiptModalProps = {
  isOpen: boolean;
  orderId: number;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function UploadReceiptModal({ isOpen, orderId, onClose, onSuccess }: UploadReceiptModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const isImage = useMemo(() => {
    if (!selectedFile) return false;
    return selectedFile.type.startsWith("image/");
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile || !isImage) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile, isImage]);

  const handleFileChange = (file: File | null) => {
    setUploadError(null);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadPaymentSlip(orderId, selectedFile, note.trim() || undefined);
      setSelectedFile(null);
      setNote("");
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "data" in (error as { data?: { message?: string } })
          ? (error as { data?: { message?: string } }).data?.message || "Failed to upload slip."
          : error instanceof Error
            ? error.message
            : "Failed to upload slip.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-pink-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-pink-700">Upload Payment Slip</h3>
            <p className="text-xs text-gray-500">Order #{orderId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-pink-600 transition hover:bg-pink-50"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="flex flex-col gap-6 md:flex-row">
            {/* Left side - Preview */}
            <div className="w-full md:w-1/2">
              <div className="space-y-3">
                <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-lg border border-pink-200 bg-pink-50">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Slip preview"
                      width={192}
                      height={192}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  ) : selectedFile && !previewUrl ? (
                    <div className="p-4 text-center">
                      <p className="break-words break-all text-sm font-medium text-pink-700">{selectedFile.name}</p>
                      <p className="mt-1 text-xs text-pink-600">PDF file selected</p>
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <svg className="mx-auto h-12 w-12 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="mt-2 text-sm text-pink-600">No file chosen</p>
                    </div>
                  )}
                </div>

                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <div className="w-full rounded-lg border border-pink-300 bg-pink-50 px-4 py-2 text-center text-sm font-semibold text-pink-700 transition hover:bg-pink-100">
                    {selectedFile ? "Choose Different File" : "Choose File"}
                  </div>
                </label>
                {selectedFile && (
                  <p className="break-words break-all px-2 text-center text-xs text-gray-600">{selectedFile.name}</p>
                )}
                <p className="text-center text-xs text-[#FF0000]/70">
                  * Accepted: jpg, jpeg, png, webp, pdf (max 5MB)
                </p>
              </div>
            </div>

            {/* Right side - Form */}
            <div className="w-full space-y-4 md:w-1/2">
              <div>
                <label className="block text-left text-sm">
                  <span className="mb-2 block font-medium text-pink-800">Note (Optional)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add any additional notes about your payment..."
                    className="mt-1 h-32 w-full resize-none rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm leading-relaxed focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                  />
                </label>
              </div>

              {uploadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs text-red-600">{uploadError}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-pink-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="rounded-md bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUploading ? "Uploading..." : "Confirm Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
