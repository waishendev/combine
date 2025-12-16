import Link from "next/link";
import { fetchReturns } from "@/lib/shop-api";
import type { ReturnRequest } from "@/lib/shop-types";
import { requireCustomer } from "@/lib/require-auth";

export default async function ReturnsPage() {
  await requireCustomer("/account/returns");
  const res = await fetchReturns();
  const returns: ReturnRequest[] = res.data;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Return & refund requests</h2>
      {!returns.length ? (
        <p className="text-sm text-slate-600">You have no return requests.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret) => (
                <tr key={ret.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{ret.id}</td>
                  <td className="px-4 py-3">{ret.order_no}</td>
                  <td className="px-4 py-3 uppercase">{ret.type}</td>
                  <td className="px-4 py-3">{ret.status}</td>
                  <td className="px-4 py-3">{ret.created_at || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/account/returns/${ret.id}`} className="text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
