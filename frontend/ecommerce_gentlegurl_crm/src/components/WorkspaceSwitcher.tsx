'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { getWorkspace, getWorkspaceLanding, setWorkspace, type Workspace } from '@/lib/workspace'

const OPTIONS: Array<{ label: string; value: Workspace }> = [
  { label: 'Ecommerce', value: 'ecommerce' },
  { label: 'Booking', value: 'booking' },
]

export default function WorkspaceSwitcher() {
  const router = useRouter()
  const [workspace, setWorkspaceState] = useState<Workspace>(() => getWorkspace())

  useEffect(() => {
    const handleWorkspaceChanged = () => {
      setWorkspaceState(getWorkspace())
    }

    window.addEventListener('crm_workspace_changed', handleWorkspaceChanged)
    return () => window.removeEventListener('crm_workspace_changed', handleWorkspaceChanged)
  }, [])

  const handleSwitch = (ws: Workspace) => {
    if (ws === workspace) return

    setWorkspace(ws)
    setWorkspaceState(ws)
    router.push(getWorkspaceLanding(ws))
  }

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {OPTIONS.map((option) => {
        const isActive = option.value === workspace

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSwitch(option.value)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
