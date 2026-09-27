import { apiFetch } from '@/lib/api'
export type PrintDevice={id:number;uuid:string;name:string;status:string;app_version?:string|null;last_seen_at?:string|null;online:boolean;paired_at?:string|null;store_location:{id:number;name:string};printers_count:number}
export type PrintJob={id:string;type:string;status:string;created_at:string;last_error_message?:string|null;attempts?:Array<{id:number;status:string;attempt_number:number}>}
type Response<T>={data:T;message?:string}
const branch=(id:number|null)=>id?`?store_location_id=${id}`:''
export const listPrintDevices=(id:number|null)=>apiFetch<Response<PrintDevice[]>>(`/api/proxy/print/devices${branch(id)}`)
export const createPrintDevice=(id:number,name:string)=>apiFetch<Response<{device:PrintDevice;pairing_code:string;expires_at:string}>>('/api/proxy/print/devices',{method:'POST',body:JSON.stringify({store_location_id:id,name})})
export const regeneratePairingCode=(id:number)=>apiFetch<Response<{pairing_code:string;expires_at:string}>>(`/api/proxy/print/devices/${id}/pairing-code`,{method:'POST'})
export const revokePrintDevice=(id:number)=>apiFetch<Response<PrintDevice>>(`/api/proxy/print/devices/${id}/revoke`,{method:'POST'})
export const testPrint=(id:number)=>apiFetch<Response<PrintJob>>(`/api/proxy/print/devices/${id}/test-jobs`,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()}})
export const listPrintJobs=(id:number)=>apiFetch<Response<PrintJob[]>>(`/api/proxy/print/devices/${id}/jobs`)
export const retryPrintJob=(id:string)=>apiFetch<Response<PrintJob>>(`/api/proxy/print/jobs/${id}/retry`,{method:'POST'})
