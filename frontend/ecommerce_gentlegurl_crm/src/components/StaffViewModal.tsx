'use client'

import type { StaffRowData } from './staffUtils'
import { useEffect } from 'react'

interface StaffViewModalProps {
  staff: StaffRowData
  onClose: () => void
}

export default function StaffViewModal({ staff, onClose }: StaffViewModalProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/40 px-0 md:bg-transparent md:px-0"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="hidden flex-1 bg-black/40 md:block" />
      <aside
        className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Staff Details</h2>
            <p className="mt-0.5 text-xs text-slate-500">View staff profile and commission settings.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            type="button"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 px-5 py-4">
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-4 px-4 py-4">
                {staff.avatarUrl ? (
                  <img
                    src={staff.avatarUrl}
                    alt={staff.name}
                    className="h-16 w-16 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                    <i className="fa-solid fa-user text-xl" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold text-slate-900">{staff.name}</p>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        staff.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <i className="fa-solid fa-circle text-[6px]" />
                      {staff.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{staff.position || '—'}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Commission</p>
              </div>
              <div className="px-4 py-4">
                <dl className="grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Product Commission</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {(staff.commissionRate * 100).toFixed(2)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Service Commission</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {(staff.serviceCommissionRate * 100).toFixed(2)}%
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Contact & Description</p>
              </div>
              <div className="px-4 py-4">
                <dl className="grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="mt-1 font-medium text-slate-900 break-words">{staff.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="mt-1 font-medium text-slate-900">{staff.phone || '—'}</dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-medium text-slate-600">Description</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{staff.description || '—'}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  )
}
