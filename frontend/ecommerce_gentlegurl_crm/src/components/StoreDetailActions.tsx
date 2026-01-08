'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import StoreEditModal from './StoreEditModal'

interface StoreDetailActionsProps {
  storeId: number
  canUpdate: boolean
}

export default function StoreDetailActions({
  storeId,
  canUpdate,
}: StoreDetailActionsProps) {
  const [editing, setEditing] = useState(false)
  const router = useRouter()

  if (!canUpdate) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        <i className="fa-solid fa-pen-to-square" />
        Edit
      </button>
      {editing && (
        <StoreEditModal
          storeId={storeId}
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
