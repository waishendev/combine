'use client'

import { useEffect, useMemo, useState } from 'react'

import { NameStack } from '@/components/NameStack'
import { ReportViewDetailsButton } from '@/components/reports/ReportActions'
import { resolveImageUrl } from '@/utils/resolveImageUrl'

type WishlistRow = {
  product_id: number; product_name: string; product_cn_name?: string | null; sku: string | null
  image_url: string | null; category_name: string | null; customer_wishlist_count: number
  guest_wishlist_count: number; total_wishlist_count: number; current_stock: number | null
  product_status: string; last_wishlisted_at: string | null; stock_status_code: 'in_stock' | 'partial' | 'out_of_stock'
  stock_status: string; recommendation: string; recommendation_detail: string
}
type TopWishlist = { state: 'none' | 'unique' | 'tie'; label: string; count: number; product_count: number }
type WishlistResponse = { data: WishlistRow[]; current_page: number; last_page: number; per_page: number; total: number; summary?: {
  total_wishlisted_products: number; total_wishlist_adds: number; top_wishlist: TopWishlist; out_of_stock_products_with_demand: number
} }
type VariantDetail = { variant_id: number; variant_name: string; variant_cn_name?: string | null; sku: string | null
  wishlist_count: null; customer_wishlist_count: null; guest_wishlist_count: null; current_stock: number | null
  availability: string; last_wishlisted_at: null; is_active: boolean }
type Detail = { product: WishlistRow; wishlist_identity: 'product'; variants: VariantDetail[] }
type Props = { initialDateFrom?: string; initialDateTo?: string; initialSearch?: string }

export default function WishlistReportPage({ initialDateFrom = '', initialDateTo = '', initialSearch = '' }: Props) {
  const [rows, setRows] = useState<WishlistRow[]>([])
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1); const [perPage, setPerPage] = useState(15)
  const [search, setSearch] = useState(initialSearch); const [searchInput, setSearchInput] = useState(initialSearch)
  const [dateFrom, setDateFrom] = useState(initialDateFrom); const [dateTo, setDateTo] = useState(initialDateTo)
  const [total, setTotal] = useState(0); const [lastPage, setLastPage] = useState(1)
  const [summary, setSummary] = useState<WishlistResponse['summary']>()
  const [detail, setDetail] = useState<Detail | null>(null); const [detailLoading, setDetailLoading] = useState(false)

  const filterQuery = () => { const qs = new URLSearchParams(); if (search) qs.set('search', search); if (dateFrom) qs.set('date_from', dateFrom); if (dateTo) qs.set('date_to', dateTo); return qs }
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const qs = filterQuery(); qs.set('page', String(page)); qs.set('per_page', String(perPage))
        const res = await fetch(`/api/proxy/ecommerce/reports/wishlist?${qs}`, { cache: 'no-store', signal: controller.signal })
        if (!res.ok) throw new Error(`Failed to load wishlist report (${res.status})`)
        const payload: WishlistResponse = await res.json()
        setRows(payload.data ?? []); setTotal(payload.total ?? 0); setLastPage(Math.max(payload.last_page ?? 1, 1)); setSummary(payload.summary)
      } catch (err) { if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : 'Failed to load wishlist report.') }
      finally { setLoading(false) }
    }
    load(); return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, search, dateFrom, dateTo])

  const openDetail = async (productId: number) => {
    setDetailLoading(true); setError(null)
    try {
      const res = await fetch(`/api/proxy/ecommerce/reports/wishlist/${productId}/detail?${filterQuery()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load wishlist details (${res.status})`)
      const payload = await res.json(); setDetail(payload.data)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load wishlist details.') }
    finally { setDetailLoading(false) }
  }
  const startItem = useMemo(() => total === 0 ? 0 : (page - 1) * perPage + 1, [page, perPage, total])
  const endItem = useMemo(() => Math.min(page * perPage, total), [page, perPage, total])

  return <div className="space-y-5">
    <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Global customer/Ecommerce metric — wishlist intent is not Branch-attributed.</p>
    {summary && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Total Wishlist Adds" value={summary.total_wishlist_adds} accent="blue" />
      <SummaryCard label="Total Wishlisted Products" value={summary.total_wishlisted_products} accent="indigo" />
      <SummaryCard label={summary.top_wishlist.state === 'tie' ? 'Top Wishlisted Products' : 'Top Wishlisted Product'} value={summary.top_wishlist.label} accent="emerald" />
      <SummaryCard label="Out-of-stock Products With Wishlist Demand" value={summary.out_of_stock_products_with_demand} accent="rose" />
    </div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
      <label className="text-xs text-gray-500 md:col-span-5">Product Search<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search product name, Chinese name or SKU" /></label>
      <label className="text-xs text-gray-500 md:col-span-2">Date From<input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
      <label className="text-xs text-gray-500 md:col-span-2">Date To<input type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
      <div className="flex gap-2 md:col-span-3 md:justify-end"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" onClick={() => { setPage(1); setSearch(searchInput.trim()) }}>Apply</button>
        <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => { setSearchInput(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1) }}>Reset</button></div>
    </div></div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-50 text-slate-600"><tr>{['Product','SKU','Category','Customer Wishlist Count','Guest Wishlist Count','Total Wishlist Count','Stock Status','Recommendation','Last Wishlisted At','Actions'].map((h, i) => <th key={h} className={`px-4 py-3 ${i >= 3 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
      <tbody>{loading ? <Empty text="Loading wishlist report..." /> : rows.length === 0 ? <Empty text="No wishlist data found." /> : rows.map(row => <tr className={`border-t ${row.stock_status_code === 'out_of_stock' ? 'bg-rose-50/80' : ''}`} key={row.product_id}>
        <td className="px-4 py-3"><div className="flex min-w-[240px] items-center gap-3">{row.image_url ? <img src={resolveImageUrl(row.image_url)} alt="" className="h-10 w-10 rounded border object-cover" /> : <div className="h-10 w-10 rounded border bg-gray-100" />}<div><NameStack name={row.product_name} cnName={row.product_cn_name} primaryClassName="font-medium" secondaryClassName="text-xs text-slate-500" /><span className="text-xs text-slate-500">{row.product_status}</span></div></div></td>
        <td className="px-4 py-3">{row.sku || '-'}</td><td className="px-4 py-3">{row.category_name || '-'}</td>
        <td className="px-4 py-3 text-right">{row.customer_wishlist_count}</td><td className="px-4 py-3 text-right">{row.guest_wishlist_count}</td><td className="px-4 py-3 text-right font-semibold">{row.total_wishlist_count}</td>
        <td className="px-4 py-3"><StockBadge row={row} /></td><td className="px-4 py-3 font-medium">{row.recommendation}</td><td className="px-4 py-3 whitespace-nowrap">{row.last_wishlisted_at || '-'}</td>
        <td className="px-4 py-3"><ReportViewDetailsButton title={`View ${row.product_name} wishlist details`} disabled={detailLoading} onClick={() => openDetail(row.product_id)} /></td>
      </tr>)}</tbody>
    </table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"><span>Showing {startItem} - {endItem} of {total}</span><div className="flex items-center gap-2"><select className="rounded-md border px-2 py-1" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}>{[15,30,50].map(n => <option key={n}>{n}</option>)}</select><button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Prev</button><span>Page {page} / {lastPage}</span><button className="rounded-md border px-3 py-1 disabled:opacity-50" disabled={page >= lastPage || loading} onClick={() => setPage(p => p + 1)}>Next</button></div></div></div>
    {detail && <DetailModal detail={detail} onClose={() => setDetail(null)} />}
  </div>
}

function Empty({ text }: { text: string }) { return <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={10}>{text}</td></tr> }
function StockBadge({ row }: { row: WishlistRow }) { const cls = row.stock_status_code === 'out_of_stock' ? 'bg-rose-100 text-rose-700' : row.stock_status_code === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'; return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{row.stock_status}</span> }
function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent: 'blue'|'indigo'|'emerald'|'rose' }) { const cls = { blue:'border-blue-200 bg-blue-50 text-blue-900', indigo:'border-indigo-200 bg-indigo-50 text-indigo-900', emerald:'border-emerald-200 bg-emerald-50 text-emerald-900', rose:'border-rose-200 bg-rose-50 text-rose-900' }[accent]; return <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}><div className="text-xs opacity-80">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div> }
function DetailModal({ detail, onClose }: { detail: Detail; onClose: () => void }) { const p = detail.product; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-labelledby="wishlist-detail-title" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><h3 id="wishlist-detail-title" className="text-lg font-semibold">Wishlist Demand Details</h3><button type="button" aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose}><i className="fa-solid fa-xmark" aria-hidden="true" /></button></div><div className="space-y-5 p-5">
    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Product Name" value={p.product_name} /><Fact label="Chinese Name" value={p.product_cn_name || '-'} /><Fact label="SKU" value={p.sku || '-'} /><Fact label="Category" value={p.category_name || '-'} /><Fact label="Status" value={p.product_status} /><Fact label="Total Wishlist Count" value={p.total_wishlist_count} /><Fact label="Customer Wishlist Count" value={p.customer_wishlist_count} /><Fact label="Guest Wishlist Count" value={p.guest_wishlist_count} /><Fact label="Last Wishlisted At" value={p.last_wishlisted_at || '-'} /><Fact label="Overall Stock Status" value={p.stock_status} /><Fact label="Recommendation" value={p.recommendation} /></div>
    <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{p.recommendation_detail}</p>
    {detail.variants.length > 0 ? <><div><h4 className="font-semibold">Variant stock</h4><p className="text-sm text-slate-500">Wishlist demand is stored at Product level. It is not tracked or allocated per Variant.</p></div><div className="overflow-x-auto rounded-xl border"><table className="min-w-[900px] w-full text-sm"><thead className="bg-slate-50"><tr>{['Variant','SKU','Wishlist Count','Customer Wishlist Count','Guest Wishlist Count','Current Stock','Availability','Last Wishlisted At'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead><tbody>{detail.variants.map(v => <tr className="border-t" key={v.variant_id}><td className="px-3 py-2"><NameStack name={v.variant_name} cnName={v.variant_cn_name} /></td><td className="px-3 py-2">{v.sku || '-'}</td><td className="px-3 py-2 text-slate-500" colSpan={3}>Not tracked per variant</td><td className="px-3 py-2">{v.current_stock ?? 'Not tracked'}</td><td className="px-3 py-2">{v.availability}</td><td className="px-3 py-2">—</td></tr>)}</tbody></table></div></> : <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">This Product has no Variants. Current availability is shown in the Product summary.</p>}
  </div></div></div> }
function Fact({ label, value }: { label: string; value: string | number }) { return <div><div className="text-xs text-slate-500">{label}</div><div className="mt-0.5 font-medium text-slate-900">{value}</div></div> }
