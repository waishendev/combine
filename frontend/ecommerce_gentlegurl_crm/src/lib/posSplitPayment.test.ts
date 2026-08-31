import assert from 'node:assert/strict'
import test from 'node:test'
import { applyAutoSplitEdit, type PosSplitPaymentAmounts } from './posSplitPayment'

const amounts = (values: Partial<PosSplitPaymentAmounts> = {}): PosSplitPaymentAmounts => ({ cash: '', qrpay: '', credit_card: '', customer_balance: '', ...values })

test('auto split assigns the remainder to the existing method', () => {
  assert.deepEqual(applyAutoSplitEdit(amounts({ qrpay: '100.00' }), 'cash', '20', 10_000), amounts({ cash: '20', qrpay: '80.00' }))
})

test('auto split distributes remainder proportionally across existing methods', () => {
  assert.deepEqual(applyAutoSplitEdit(amounts({ cash: '20', qrpay: '30', credit_card: '50' }), 'cash', '10', 10_000), amounts({ cash: '10', qrpay: '33.75', credit_card: '56.25' }))
})

test('available methods prevent allocation into a Branch-disabled method', () => {
  assert.deepEqual(applyAutoSplitEdit(amounts({ cash: '100' }), 'cash', '', 10_000, ['cash', 'qrpay']), amounts({ qrpay: '100.00' }))
})
