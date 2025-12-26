"use client"

export default function StatusBadge({
  status,
  label,
}: {
  status: string
  label?: string
}) {
  const key = (status || '').toLowerCase()
  const statusMap: Record<
    string,
    { textColor: string; bgColor: string; dotColor: string }
  > = {
    active: {
      textColor: 'text-green-600',
      bgColor: 'bg-green-100',
      dotColor: 'bg-green-500',
    },
    inactive: {
      textColor: 'text-gray-800',
      bgColor: 'bg-gray-100',
      dotColor: 'bg-gray-500',
    },

  }

  const { textColor, bgColor, dotColor } = statusMap[key] ?? {
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
    dotColor: 'bg-gray-400',
  }

  const displayText = label ?? (status?.trim() ? status : '-')

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {displayText}
    </span>
  )
}
