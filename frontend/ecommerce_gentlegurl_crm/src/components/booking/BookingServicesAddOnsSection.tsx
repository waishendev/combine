'use client'

import { formatPosCurrentOrRangeDisplay } from '@/components/pos/settlementAmountUtils'
import { storedAddonLinePrice, storedAddonQuantity } from '@/components/pos/bookingAddonQuantity'
import { formatDateTime12Hour } from '@/lib/formatDateTime'
import { formatReportStaffSplitLabel } from '@/components/pos/staffSplitCore'

export type StaffSplit = {
  staff_id: number
  staff_name?: string | null
  name?: string | null
  share_percent: number
  share_amount?: number | null
}

export type BookingServiceAddOn = {
  id?: number | null
  linked_booking_service_id?: number | null
  name: string
  cn_name?: string | null
  extra_duration_min?: number | null
  extra_price: number
  quantity?: number | null
  line_gross_amount?: number | null
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  price_finalized?: boolean | null
  staff_splits?: StaffSplit[]
  staff_split_source?: 'explicit' | 'inherited' | string | null
  service_ref?: string | null
  item_kind?: string | null
  line_type?: string | null
  parent_service_ref?: string | null
}

export type BookingServiceBlock = {
  id?: number | null
  service_id?: number | null
  name: string
  cn_name?: string | null
  amount?: number | null
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  price_finalized?: boolean | null
  duration_min?: number | null
  start_at?: string | null
  end_at?: string | null
  staff_splits?: StaffSplit[]
  add_ons?: BookingServiceAddOn[]
}

export type BookingServicesAddOnsRow = {
  service?: {
    id: number
    name: string
    cn_name?: string | null
    duration_min?: number | null
    amount?: number | null
    staff_splits?: StaffSplit[]
  } | null
  services?: BookingServiceBlock[]
  service_blocks?: BookingServiceBlock[]
  add_ons?: BookingServiceAddOn[]
  staff?: { id: number; name: string } | null
  start_at?: string | null
  end_at?: string | null
  total_amount?: number
  package_claims?: Array<{ usage_id: number; customer_service_package_id: number; package_name: string; booking_service_id: number; status: string; used_qty: number }>
}

const formatDateTime = (value?: string | null) => formatDateTime12Hour(value) || '—'

const formatServiceAmount = (service: Pick<BookingServiceBlock, 'amount' | 'price_mode' | 'price_range_min' | 'price_range_max' | 'price_finalized'>) =>
  formatPosCurrentOrRangeDisplay({
    price_mode: service.price_mode,
    price_range_min: service.price_range_min,
    price_range_max: service.price_range_max,
    price_finalized: service.price_finalized,
    extra_price: service.amount,
  })

const formatAddonAmount = (addon: Pick<BookingServiceAddOn, 'extra_price' | 'price_mode' | 'price_range_min' | 'price_range_max' | 'price_finalized' | 'quantity' | 'line_gross_amount'>) => {
  const qty = storedAddonQuantity(addon)
  const lineTotal = storedAddonLinePrice(addon)
  const unitDisplay = formatPosCurrentOrRangeDisplay({
    price_mode: addon.price_mode,
    price_range_min: addon.price_range_min,
    price_range_max: addon.price_range_max,
    price_finalized: addon.price_finalized,
    extra_price: addon.extra_price,
  })

  if (qty > 1) {
    return `${unitDisplay} × ${qty} = RM ${lineTotal.toFixed(2)}`
  }

  return unitDisplay
}

const formatAddonDuration = (addon: Pick<BookingServiceAddOn, 'extra_duration_min' | 'quantity'>) => {
  const unitMinutes = Number(addon.extra_duration_min ?? 0)
  if (unitMinutes <= 0) return '—'
  const qty = storedAddonQuantity(addon)
  const totalMinutes = unitMinutes * qty
  return qty > 1 ? `${unitMinutes} min × ${qty} = ${totalMinutes} min` : `${unitMinutes} min`
}

const visibleAddOns = (row: Pick<BookingServicesAddOnsRow, 'add_ons'>) =>
  (row.add_ons ?? []).filter((item) => {
    const itemKind = String(item.item_kind ?? item.line_type ?? 'addon').toLowerCase()
    const serviceRef = String(item.service_ref ?? '').toLowerCase()
    return itemKind !== 'main_service' && serviceRef !== 'original'
  })

export const serviceBlocksForRow = (row: BookingServicesAddOnsRow): BookingServiceBlock[] => {
  const blocks = row.services?.length ? row.services : row.service_blocks
  if (blocks?.length) return blocks
  if (!row.service) return []
  return [{
    id: row.service.id,
    service_id: row.service.id,
    name: row.service.name,
    cn_name: row.service.cn_name,
    amount: row.service.amount ?? Math.max(0, Number(row.total_amount ?? 0) - visibleAddOns(row).reduce((sum, item) => sum + Number(item.extra_price ?? 0), 0)),
    duration_min: row.service.duration_min,
    start_at: row.start_at,
    end_at: row.end_at,
    staff_splits: row.service.staff_splits ?? (row.staff ? [{ staff_id: row.staff.id, staff_name: row.staff.name, share_percent: 100 }] : []),
    add_ons: visibleAddOns(row),
  }]
}

function StaffSplitList({ splits, inherited }: { splits?: StaffSplit[]; inherited?: boolean }) {
  if (!splits?.length) return <p className="text-sm text-slate-500">—</p>

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Staff Split:</p>
      <ul className="space-y-1 text-sm text-slate-700">
        {splits.map((split, index) => (
          <li key={`${split.staff_id}-${index}`}>
            <span>{formatReportStaffSplitLabel(split)}</span>
            {inherited && index === 0 ? <span className="ml-2 text-xs text-slate-500">Inherited from main service</span> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

type BookingServicesAddOnsSectionProps = {
  row: BookingServicesAddOnsRow
  className?: string
}

export default function BookingServicesAddOnsSection({ row, className }: BookingServicesAddOnsSectionProps) {
  const claims = row.package_claims ?? []
  const hasPackageClaim = (serviceId?: number | null) =>
    serviceId != null && claims.some((c) => c.booking_service_id === serviceId)
  const getPackageClaimName = (serviceId?: number | null) =>
    claims.find((c) => c.booking_service_id === serviceId)?.package_name ?? 'Package'

  return (
    <section className={className ?? 'rounded-xl border border-slate-200 p-4'}>
      <h4 className="font-semibold text-slate-900">Services + Add-ons</h4>
      <div className="mt-4 space-y-4">
        {serviceBlocksForRow(row).map((service, blockIndex) => (
          <div key={`${service.service_id ?? service.id ?? service.name}-${blockIndex}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">Service Block {blockIndex + 1}</p>
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Main Service</p>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {service.name || '—'}
                    {hasPackageClaim(service.service_id ?? service.id) && (
                      <span className="ml-2 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        PKG
                      </span>
                    )}
                  </p>
                  {service.cn_name ? <p className="text-xs text-slate-500">{service.cn_name}</p> : null}
                  {hasPackageClaim(service.service_id ?? service.id) && (
                    <p className="text-[11px] text-emerald-600">
                      Covered by {getPackageClaimName(service.service_id ?? service.id)}
                    </p>
                  )}
                </div>
                <p className="text-sm text-slate-700">Amount: {formatServiceAmount(service)}</p>
                <p className="text-sm text-slate-700">Duration: {service.duration_min != null ? `${service.duration_min} min` : '—'}</p>
                <p className="text-sm text-slate-700">
                  Schedule: {`${formatDateTime(service.start_at ?? row.start_at)} - ${formatDateTime(service.end_at ?? row.end_at)}`}
                </p>
                <StaffSplitList splits={service.staff_splits} />
              </div>
            </div>

            <div className="mt-3">
              <p className="text-sm font-semibold text-slate-900">Add-ons</p>
              {(service.add_ons ?? []).length > 0 ? (
                <div className="mt-2 space-y-3">
                  {service.add_ons?.map((item, index) => {
                    const addonServiceId = Number(item.linked_booking_service_id ?? item.id ?? 0)
                    const addonHasClaim = hasPackageClaim(addonServiceId > 0 ? addonServiceId : null)
                    return (
                      <div key={`${item.id ?? item.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {index + 1}. {item.name}
                          {addonHasClaim && (
                            <span className="ml-2 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              PKG
                            </span>
                          )}
                        </p>
                        {item.cn_name ? <p className="text-xs text-slate-500">{item.cn_name}</p> : null}
                        {addonHasClaim && (
                          <p className="text-[11px] text-emerald-600">
                            Covered by {getPackageClaimName(addonServiceId)}
                          </p>
                        )}
                        {storedAddonQuantity(item) > 1 ? (
                          <p className="mt-1 text-xs font-medium text-slate-600">Quantity: {storedAddonQuantity(item)}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-slate-700">Amount: {formatAddonAmount(item)}</p>
                        <p className="text-sm text-slate-700">Duration: {formatAddonDuration(item)}</p>
                        <div className="mt-2">
                          <StaffSplitList splits={item.staff_splits} inherited={item.staff_split_source === 'inherited'} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No add-ons.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
