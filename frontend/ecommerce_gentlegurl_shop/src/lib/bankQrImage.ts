/** Standard bank transfer QR upload size (portrait). */
export const BANK_QR_IMAGE_WIDTH = 834;
export const BANK_QR_IMAGE_HEIGHT = 1280;

/** Compact display (checkout bank list). */
export const bankQrImageCompactClass =
  "w-full max-w-[140px] aspect-[834/1280] rounded border border-[var(--card-border)] object-contain bg-[var(--card)]";

/** Standard display (thank-you / order detail). */
export const bankQrImageStandardClass =
  "w-full max-w-[200px] aspect-[834/1280] rounded border border-[var(--card-border)] object-contain bg-[var(--card)]";
