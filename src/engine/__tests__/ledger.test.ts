import { describe, expect, it } from 'vitest'
import { summarizeLedger, validateAllocationTotal } from '../ledger'
import type { Transaction, TransactionAllocation } from '@/types'

function tx(id: number, type: Transaction['type'], amount: string): Transaction {
  return {
    id,
    ipId: 1,
    date: '2026-04-10',
    type,
    amount,
    category: '',
    counterparty: '',
    comment: '',
    usnRelevant: true,
    ndsRelevant: false,
    period: '2026-04',
    importSource: null,
    importBatchId: null,
    status: 'accounted',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  }
}

function part(id: number, transactionId: number, kind: TransactionAllocation['kind'], amount: string): TransactionAllocation {
  return {
    id,
    ipId: 1,
    transactionId,
    kind,
    amount,
    category: '',
    taxPaymentKind: kind === 'tax_payment' ? 'usn' : null,
    taxPeriod: null,
    obligationId: null,
    comment: '',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  }
}

describe('ledger allocations', () => {
  it('subtracts a legacy income return instead of adding it', () => {
    const result = summarizeLedger([tx(1, 'income', '500000'), tx(2, 'return_income', '50000')], [])
    expect(result.netIncome).toBe('450000.00')
  })

  it('separates tax payment from an ordinary business expense', () => {
    const operation = tx(1, 'expense', '100000')
    const result = summarizeLedger([operation], [
      part(1, 1, 'business_expense', '40000'),
      part(2, 1, 'tax_payment', '60000'),
    ])
    expect(result.netExpenses).toBe('40000.00')
    expect(result.taxPayments).toBe('60000.00')
    expect(result.netIncome).toBe('0.00')
  })

  it('requires split parts to equal the original operation', () => {
    expect(validateAllocationTotal('100000', [{ amount: '40000' }, { amount: '60000' }])).toBe(true)
    expect(validateAllocationTotal('100000', [{ amount: '40000' }, { amount: '59000' }])).toBe(false)
  })
})

