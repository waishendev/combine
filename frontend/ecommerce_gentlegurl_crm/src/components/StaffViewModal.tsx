'use client'

import type { StaffRowData } from './staffUtils'

interface StaffViewModalProps {
  staff: StaffRowData
  onClose: () => void
}

export default function StaffViewModal({ staff, onClose }: StaffViewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Staff Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none" type="button">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm">
          <div className="flex items-center gap-4">
            {staff.avatarUrl ? (
              <img src={staff.avatarUrl} alt={staff.name} className="h-20 w-20 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                <i className="fa-solid fa-user text-2xl" />
              </div>
            )}
            <div>
              <p className="text-xl font-semibold">{staff.name}</p>
              <p className="text-gray-500">{staff.position || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><span className="font-medium">Code:</span> {staff.code}</div>
            <div><span className="font-medium">Phone:</span> {staff.phone}</div>
            <div><span className="font-medium">Email:</span> {staff.email}</div>
            <div><span className="font-medium">Status:</span> {staff.isActive ? 'Active' : 'Inactive'}</div>
            <div><span className="font-medium">Product Commission:</span> {(staff.commissionRate * 100).toFixed(2)}%</div>
            <div><span className="font-medium">Service Commission:</span> {(staff.serviceCommissionRate * 100).toFixed(2)}%</div>
          </div>

          <div>
            <p className="font-medium mb-1">Description</p>
            <p className="text-gray-600">{staff.description || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
