'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ALL_BRANCHES, parsePersistedBranchSelection, resolveBranchSelection } from '@/contexts/branch-selection'
import type { StoreLocation } from '@/types/storeLocation'

type BranchContextValue = {
  accessibleBranches: StoreLocation[]
  selectedBranchId: number | null
  selectedBranch: StoreLocation | null
  isAllBranches: boolean
  loading: boolean
  error: string | null
  setSelectedBranch: (branchId: number | null) => void
  refreshBranches: () => Promise<void>
  resetBranch: () => void
}

type BranchResponse = { data?: StoreLocation[] }

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ userId, children }: { userId: number; children: ReactNode }) {
  const [accessibleBranches, setAccessibleBranches] = useState<StoreLocation[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestNumber = useRef(0)
  const storageKey = `gentlegurls:selected-branch:${userId}`

  const resetBranch = useCallback(() => {
    requestNumber.current += 1
    setAccessibleBranches([])
    setSelectedBranchId(null)
    setError(null)
    setLoading(false)
  }, [])

  const refreshBranches = useCallback(async () => {
    const request = ++requestNumber.current
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/me/store-locations', {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Unable to load branches')

      const payload = (await response.json()) as BranchResponse
      const activeBranches = Array.isArray(payload.data)
        ? payload.data.filter((branch) => branch.is_active === true)
        : []
      if (request !== requestNumber.current) return

      // localStorage is a preference, not authorization: validate it against every fresh response.
      const persisted = parsePersistedBranchSelection(window.localStorage.getItem(storageKey))
      const nextSelection = resolveBranchSelection(activeBranches, persisted)
      setAccessibleBranches(activeBranches)
      setSelectedBranchId(nextSelection)

      if (activeBranches.length === 0) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, nextSelection === null ? ALL_BRANCHES : String(nextSelection))
    } catch (loadError) {
      if (request !== requestNumber.current) return
      // Never continue displaying a selection whose access could not be revalidated.
      setAccessibleBranches([])
      setSelectedBranchId(null)
      setError(loadError instanceof Error ? loadError.message : 'Unable to load branches')
    } finally {
      if (request === requestNumber.current) setLoading(false)
    }
  }, [storageKey])

  useEffect(() => {
    setAccessibleBranches([])
    setSelectedBranchId(null)
    void refreshBranches()
    return () => { requestNumber.current += 1 }
  }, [refreshBranches])

  const setSelectedBranch = useCallback((branchId: number | null) => {
    if (branchId !== null && !accessibleBranches.some((branch) => branch.id === branchId)) return
    if (branchId === null && accessibleBranches.length < 2) return

    setSelectedBranchId(branchId)
    window.localStorage.setItem(storageKey, branchId === null ? ALL_BRANCHES : String(branchId))
  }, [accessibleBranches, storageKey])

  const selectedBranch = useMemo(
    () => accessibleBranches.find((branch) => branch.id === selectedBranchId) ?? null,
    [accessibleBranches, selectedBranchId],
  )

  const value = useMemo<BranchContextValue>(() => ({
    accessibleBranches,
    selectedBranchId,
    selectedBranch,
    isAllBranches: accessibleBranches.length > 1 && selectedBranchId === null,
    loading,
    error,
    setSelectedBranch,
    refreshBranches,
    resetBranch,
  }), [accessibleBranches, selectedBranchId, selectedBranch, loading, error, setSelectedBranch, refreshBranches, resetBranch])

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) throw new Error('useBranch must be used within a BranchProvider')
  return context
}
