import { ReturnTrackingForm } from "@/components/account/ReturnTrackingForm";
import { requireCustomer } from "@/lib/require-auth";
import { fetchReturnDetail } from "@/lib/shop-api";
import type { ReturnRequest } from "@/lib/shop-types";

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomer(`/account/returns/${id}`);
  const res = await fetchReturnDetail(id);
  const ret: ReturnRequest = res.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-blue-700">Return / Refund</p>
          <h2 className="text-2xl font-semibold">Request #{ret.id}</h2>
          <p className="text-sm text-slate-600">Order {ret.order_no}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Type:</span>
            <span className="font-semibold uppercase">{ret.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <span className="font-semibold">{ret.status}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Details</h3>
          {ret.reason && <p className="text-sm text-slate-700">Reason: {ret.reason}</p>}
          {ret.description && <p className="text-sm text-slate-700">Description: {ret.description}</p>}
          {ret.admin_note && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Admin note: {ret.admin_note}</div>
          )}
          {ret.items?.length ? (
            <div className="overflow-hidden rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {ret.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.product_name}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        <div>
          <ReturnTrackingForm returnId={String(ret.id)} />
        </div>
      </div>
    </div>
  );
}
