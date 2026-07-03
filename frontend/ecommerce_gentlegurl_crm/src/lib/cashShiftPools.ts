export type CashShiftPoolBalances = {
  total_initial_cash: number
  total_withdraw: number
}

export type CashShiftPoolChanges = {
  refillPacket?: number | null
  atm?: number | null
  withdraw?: number | null
  refillCash?: number | null
}

export function parseCashShiftAmount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return 0
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function applyPoolChanges(
  base: CashShiftPoolBalances,
  changes: CashShiftPoolChanges,
): CashShiftPoolBalances {
  const refillPacket = Number(changes.refillPacket ?? 0)
  const atm = Number(changes.atm ?? 0)
  const withdraw = Number(changes.withdraw ?? 0)
  const refillCash = Number(changes.refillCash ?? 0)

  return {
    total_initial_cash: roundMoney(base.total_initial_cash + refillPacket - refillCash),
    total_withdraw: roundMoney(base.total_withdraw + withdraw - atm),
  }
}

export function canUseAtm(poolBalances: CashShiftPoolBalances, atmAmount: number): boolean {
  if (atmAmount <= 0) return true
  return poolBalances.total_withdraw > 0 && atmAmount <= poolBalances.total_withdraw
}

export function computeExpectedCash(input: {
  opening_amount?: number | null
  cash_sales?: number | null
}): number {
  const openingAmount = Number(input.opening_amount ?? 0)
  const cashSales = Number(input.cash_sales ?? 0)

  return roundMoney(openingAmount + cashSales)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}
