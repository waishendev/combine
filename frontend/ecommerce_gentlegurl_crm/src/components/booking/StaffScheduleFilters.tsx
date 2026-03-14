'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface StaffScheduleFilterValues {
  staff_id: string
  day_of_week: string
}

export const staffScheduleFiltersFormId = 'staff-schedule-filters-form'

export const emptyStaffScheduleFilters: StaffScheduleFilterValues = {
  staff_id: '',
  day_of_week: '',
}

interface StaffScheduleFiltersProps {
  values: StaffScheduleFilterValues
  onChange: (values: StaffScheduleFilterValues) => void
  onSubmit: (values: StaffScheduleFilterValues) => void
  onReset: () => void
  staffs: Array<{ id: number; name: string }>
}

const DAYS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function StaffScheduleFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  staffs,
}: StaffScheduleFiltersProps) {
  const { t } = useI18n()

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    onChange({ ...values, [name]: value })
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(values)
  }

  const handleReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onChange({ ...emptyStaffScheduleFilters })
    onReset()
  }

  return (
    <form id={staffScheduleFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="staff_id"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Staff
          </label>
          <select
            id="staff_id"
            name="staff_id"
            value={values.staff_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('common.all')}</option>
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="day_of_week"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Day of Week
          </label>
          <select
            id="day_of_week"
            name="day_of_week"
            value={values.day_of_week}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('common.all')}</option>
            {DAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  )
}
