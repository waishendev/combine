export type PosSplitPaymentMethod = 'cash' | 'qrpay' | 'credit_card' | 'customer_balance'
export type PosSplitPaymentAmounts = Record<PosSplitPaymentMethod, string>

const cents = (value: string | number | null | undefined) => {
  const numeric = Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0
}

const amount = (value: number) => (value > 0 ? (value / 100).toFixed(2) : '')

/** Shared transaction-local remainder distribution used by POS checkout and appointment settlement. */
export function applyAutoSplitEdit(
  previous: PosSplitPaymentAmounts,
  editedMethod: PosSplitPaymentMethod,
  rawValue: string,
  totalCents: number,
  availableMethods: PosSplitPaymentMethod[] = ['qrpay', 'cash', 'credit_card', 'customer_balance'],
): PosSplitPaymentAmounts {
  const next = { ...previous, [editedMethod]: rawValue }
  const editedCents = cents(rawValue)
  const remainingCents = Math.max(0, totalCents - editedCents)
  const otherMethods = availableMethods.filter((method) => method !== editedMethod)
  const othersWithValues = otherMethods.filter((method) => cents(previous[method]) > 0)

  if (othersWithValues.length === 0) {
    if (editedCents === 0 && remainingCents > 0 && otherMethods.length > 0) {
      const restoreMethod = otherMethods.includes('qrpay') ? 'qrpay' : otherMethods[0]
      next[restoreMethod] = amount(remainingCents)
    }
    return next
  }
  if (othersWithValues.length === 1) {
    next[othersWithValues[0]] = amount(remainingCents)
    return next
  }

  const otherTotalCents = othersWithValues.reduce((sum, method) => sum + cents(previous[method]), 0)
  let allocatedCents = 0
  othersWithValues.forEach((method, index) => {
    const shareCents = index === othersWithValues.length - 1
      ? Math.max(0, remainingCents - allocatedCents)
      : Math.round((cents(previous[method]) / otherTotalCents) * remainingCents)
    next[method] = amount(shareCents)
    allocatedCents += shareCents
  })
  return next
}
