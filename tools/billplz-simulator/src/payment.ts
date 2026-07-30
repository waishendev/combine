import { config } from "./config.js";
import { sign } from "./signature.js";
import type { Bill, CallbackAttempt } from "./types.js";

export function paymentPayload(bill:Bill, paid:boolean, overrides:Record<string,string>={}):Record<string,string> {
  const payload:Record<string,string> = { id:bill.id, collection_id:bill.collectionId, paid:String(paid), state:paid ? "paid" : "due", amount:String(bill.amount), paid_amount:String(paid ? bill.amount : 0), paid_at:paid ? new Date().toISOString() : "", reference_1:bill.reference1 || "", reference_2:bill.reference2 || "", ...overrides };
  payload.x_signature = sign(payload, config.signatureKey);
  return payload;
}
export function redirectUrl(bill:Bill, paid:boolean, invalid=false):string {
  const payload = paymentPayload(bill, paid); delete payload.x_signature; payload.x_signature = sign(payload, config.signatureKey, true); if(invalid) payload.x_signature = `invalid${payload.x_signature.slice(7)}`;
  const url = new URL(bill.redirectUrl); Object.entries(payload).forEach(([k,v]) => url.searchParams.set(`billplz[${k}]`,v)); return url.toString();
}
export async function deliver(bill:Bill, payload:Record<string,string>, timeoutMs=config.callbackTimeoutMs):Promise<CallbackAttempt> {
  const started=Date.now(); let status:number|undefined, bodyPreview:string|undefined, error:string|undefined, timeout=false;
  try { const response=await fetch(bill.callbackUrl,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(payload),signal:AbortSignal.timeout(timeoutMs)}); status=response.status; bodyPreview=(await response.text()).slice(0,500); }
  catch(e){ error=e instanceof Error ? e.message : String(e); timeout=(e instanceof Error && (e.name==="TimeoutError" || e.name==="AbortError")); }
  const attempt:CallbackAttempt={attempt:bill.attempts.length+1,targetUrl:bill.callbackUrl,timestamp:new Date().toISOString(),payload,status,bodyPreview,durationMs:Date.now()-started,error,timeout,delivered:status!==undefined&&status>=200&&status<300}; bill.attempts.push(attempt); bill.lastPayload=payload; bill.updatedAt=new Date().toISOString(); return attempt;
}
