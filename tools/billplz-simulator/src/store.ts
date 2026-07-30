import type { Bill } from "./types.js";
const bills = new Map<string, Bill>();
export const store = { save: (bill: Bill) => (bills.set(bill.id, bill), bill), get: (id:string) => bills.get(id), clear: () => bills.clear() };
