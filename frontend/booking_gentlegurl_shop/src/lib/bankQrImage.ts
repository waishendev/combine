/** Standard bank transfer QR upload size (portrait). */
export const BANK_QR_IMAGE_WIDTH = 834;
export const BANK_QR_IMAGE_HEIGHT = 1280;

/** Compact display (cart drawer, bank list). */
export const bankQrImageCompactClass =
  "mt-3 w-full max-w-[156px] aspect-[834/1280] rounded-lg border border-[var(--card-border)] object-contain bg-white";

/** Standard display (thank-you / order detail). */
export const bankQrImageStandardClass =
  "w-full max-w-[200px] aspect-[834/1280] rounded-lg border border-[var(--card-border)] object-contain bg-white";
