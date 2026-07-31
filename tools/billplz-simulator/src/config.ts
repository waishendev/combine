import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 4400),
  publicUrl: (process.env.SIMULATOR_PUBLIC_URL || "http://127.0.0.1:4400").replace(/\/$/, ""),
  apiKey: process.env.BILLPLZ_API_KEY || "local-api-key",
  signatureKey: process.env.BILLPLZ_X_SIGNATURE_KEY || "local-signature-key",
  callbackTimeoutMs: Number(process.env.CALLBACK_TIMEOUT_MS || 5000),
};
