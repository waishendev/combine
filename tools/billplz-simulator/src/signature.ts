import { createHmac } from "node:crypto";
const scalar = (value: unknown) => value == null ? "" : String(value);
export function sourceString(payload: Record<string, unknown>, redirect = false): string {
  const parts = Object.entries(payload).filter(([key]) => key !== "x_signature").map(([key,value]) => `${redirect ? "billplz" : ""}${key}${scalar(value)}`);
  parts.sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return parts.join("|");
}
export function sign(payload: Record<string,unknown>, key:string, redirect=false): string { return createHmac("sha256", key).update(sourceString(payload, redirect)).digest("hex"); }
