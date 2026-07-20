import { d } from './decimal'
import type { AllocationKind, Transaction, TransactionAllocation } from '@/types'

export interface LedgerSummary {
  taxableIncome: string
  incomeReturns: string
  netIncome: string
  businessExpenses: string
  expenseRefunds: string
  netExpenses: string
  taxPayments: string
  nonTaxable: string
  personal: string
  transfers: string
  needsReview: string
}

export const ALLOCATION_LABELS: Record<AllocationKind, string> = {
  taxable_income: 'Доход УСН',
  income_return: 'Возврат дохода',
  business_expense: 'Расход ИП',
  business_expense_refund: 'Возврат расхода',
  tax_payment: 'Налог или взнос',
  non_taxable: 'Необлагаемое поступление',
  personal: 'Личное',
  transfer: 'Перевод между своими счетами',
  needs_review: 'Требует проверки',
}

export function legacyAllocationKind(transaction: Transaction): AllocationKind {
  if (transaction.status === 'needs_review') return 'needs_review'
  if (transaction.status === 'not_accounted') return transaction.type === 'income' ? 'non_taxable' : 'personal'
  if (transaction.type === 'return_income') return 'income_return'
  if (transaction.type === 'return_expense') return 'business_expense_refund'
  if (transaction.type === 'expense') return 'business_expense'
  return transaction.usnRelevant ? 'taxable_income' : 'non_taxable'
}

export function validateAllocationTotal(amount: string, allocations: Pick<TransactionAllocation, 'amount'>[]): boolean {
  const allocated = allocations.reduce((sum, item) => sum.plus(d(item.amount || 0)), d(0))
  return allocated.eq(d(amount || 0))
}

export function summarizeLedger(
  transactions: Transaction[],
  allocations: TransactionAllocation[],
): LedgerSummary {
  const byTransaction = new Map<number, TransactionAllocation[]>()
  for (const allocation of allocations) {
    const current = byTransaction.get(allocation.transactionId) ?? []
    current.push(allocation)
    byTransaction.set(allocation.transactionId, current)
  }

  const totals: Record<AllocationKind, ReturnType<typeof d>> = {
    taxable_income: d(0),
    income_return: d(0),
    business_expense: d(0),
    business_expense_refund: d(0),
    tax_payment: d(0),
    non_taxable: d(0),
    personal: d(0),
    transfer: d(0),
    needs_review: d(0),
  }

  for (const transaction of transactions) {
    const explicit = transaction.id ? byTransaction.get(transaction.id) : undefined
    if (explicit?.length) {
      for (const allocation of explicit) {
        totals[allocation.kind] = totals[allocation.kind].plus(d(allocation.amount))
      }
      continue
    }
    const kind = legacyAllocationKind(transaction)
    totals[kind] = totals[kind].plus(d(transaction.amount))
  }

  return {
    taxableIncome: totals.taxable_income.toFixed(2),
    incomeReturns: totals.income_return.toFixed(2),
    netIncome: totals.taxable_income.minus(totals.income_return).toFixed(2),
    businessExpenses: totals.business_expense.toFixed(2),
    expenseRefunds: totals.business_expense_refund.toFixed(2),
    netExpenses: totals.business_expense.minus(totals.business_expense_refund).toFixed(2),
    taxPayments: totals.tax_payment.toFixed(2),
    nonTaxable: totals.non_taxable.toFixed(2),
    personal: totals.personal.toFixed(2),
    transfers: totals.transfer.toFixed(2),
    needsReview: totals.needs_review.toFixed(2),
  }
}

