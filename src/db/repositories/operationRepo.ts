import { db } from '../schema'
import { d } from '@/engine/decimal'
import { validateAllocationTotal } from '@/engine/ledger'
import { refreshObligationPaymentState } from './paymentRepo'
import { scheduleSync, syncDelete } from '@/firebase/syncManager'
import type { Transaction, TransactionAllocation } from '@/types'

export type AllocationDraft = Omit<
  TransactionAllocation,
  'id' | 'ipId' | 'transactionId' | 'createdAt' | 'updatedAt'
>

export type OperationDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }

async function removeGeneratedPayments(transactionId: number): Promise<Set<number>> {
  const payments = await db.payments.where('sourceTransactionId').equals(transactionId).toArray()
  const affected = new Set<number>()
  for (const payment of payments) {
    if (!payment.id) continue
    const links = await db.paymentAllocations.where('paymentId').equals(payment.id).toArray()
    links.forEach(link => affected.add(link.obligationId))
    await db.paymentAllocations.where('paymentId').equals(payment.id).delete()
    await db.payments.delete(payment.id)
  }
  return affected
}

async function addGeneratedPayments(
  operation: Transaction,
  transactionId: number,
  allocations: AllocationDraft[],
  now: string,
): Promise<Set<number>> {
  const affected = new Set<number>()
  for (const allocation of allocations.filter(item => item.kind === 'tax_payment')) {
    const obligationId = allocation.obligationId ?? null
    const paymentId = await db.payments.add({
      ipId: operation.ipId,
      obligationId,
      date: operation.date,
      amount: d(allocation.amount).toFixed(2),
      description: allocation.category || 'Налоговая часть операции',
      kind: allocation.taxPaymentKind ?? 'other_tax',
      period: allocation.taxPeriod,
      documentNumber: '',
      comment: allocation.comment || operation.comment,
      source: 'transaction',
      sourceTransactionId: transactionId,
      createdAt: now,
      updatedAt: now,
    })
    if (obligationId) {
      await db.paymentAllocations.add({
        ipId: operation.ipId,
        paymentId,
        obligationId,
        amount: d(allocation.amount).toFixed(2),
        createdAt: now,
      })
      affected.add(obligationId)
    }
  }
  return affected
}

export const operationRepo = {
  async save(operation: OperationDraft, allocations: AllocationDraft[]): Promise<number> {
    if (!d(operation.amount).gt(0)) throw new Error('Сумма операции должна быть больше нуля')
    if (!allocations.length || !validateAllocationTotal(operation.amount, allocations)) {
      throw new Error('Сумма частей должна совпадать с суммой операции')
    }

    const now = new Date().toISOString()
    let transactionId = operation.id ?? 0
    const affectedObligations = new Set<number>()
    const staleAllocations = operation.id
      ? await db.transactionAllocations.where('transactionId').equals(operation.id).toArray()
      : []
    const stalePayments = operation.id
      ? await db.payments.where('sourceTransactionId').equals(operation.id).toArray()
      : []
    const stalePaymentLinks = (
      await Promise.all(stalePayments.filter(item => item.id).map(item => db.paymentAllocations.where('paymentId').equals(item.id!).toArray()))
    ).flat()

    await db.transaction(
      'rw',
      db.transactions,
      db.transactionAllocations,
      db.payments,
      db.paymentAllocations,
      async () => {
        const { id, ...draft } = operation
        const accounted = allocations.every(item => item.kind !== 'needs_review')
        const tx: Omit<Transaction, 'id'> = {
          ...draft,
          usnRelevant: allocations.some(item => item.kind === 'taxable_income' || item.kind === 'income_return'),
          ndsRelevant: false,
          status: accounted ? 'accounted' : 'needs_review',
          period: operation.date.slice(0, 7),
          createdAt: id ? (await db.transactions.get(id))?.createdAt ?? now : now,
          updatedAt: now,
        }

        if (id) {
          await db.transactions.put({ ...tx, id })
          ;(await removeGeneratedPayments(id)).forEach(value => affectedObligations.add(value))
          await db.transactionAllocations.where('transactionId').equals(id).delete()
          transactionId = id
        } else {
          transactionId = await db.transactions.add(tx as Transaction)
        }

        await db.transactionAllocations.bulkAdd(allocations.map(allocation => ({
          ...allocation,
          amount: d(allocation.amount).toFixed(2),
          ipId: operation.ipId,
          transactionId,
          createdAt: now,
          updatedAt: now,
        })))
        ;(await addGeneratedPayments(tx as Transaction, transactionId, allocations, now))
          .forEach(value => affectedObligations.add(value))
      },
    )

    for (const obligationId of affectedObligations) {
      await refreshObligationPaymentState(obligationId)
    }
    for (const item of stalePaymentLinks) if (item.id) await syncDelete(undefined, db.paymentAllocations, item.id)
    for (const item of stalePayments) if (item.id) await syncDelete(undefined, db.payments, item.id)
    for (const item of staleAllocations) if (item.id) await syncDelete(undefined, db.transactionAllocations, item.id)
    scheduleSync()
    return transactionId
  },

  async remove(transactionId: number): Promise<void> {
    const affected = new Set<number>()
    const staleAllocations = await db.transactionAllocations.where('transactionId').equals(transactionId).toArray()
    const stalePayments = await db.payments.where('sourceTransactionId').equals(transactionId).toArray()
    const stalePaymentLinks = (
      await Promise.all(stalePayments.filter(item => item.id).map(item => db.paymentAllocations.where('paymentId').equals(item.id!).toArray()))
    ).flat()
    await db.transaction(
      'rw',
      db.transactions,
      db.transactionAllocations,
      db.payments,
      db.paymentAllocations,
      async () => {
        ;(await removeGeneratedPayments(transactionId)).forEach(value => affected.add(value))
        await db.transactionAllocations.where('transactionId').equals(transactionId).delete()
        await db.transactions.delete(transactionId)
      },
    )
    for (const obligationId of affected) await refreshObligationPaymentState(obligationId)
    for (const item of stalePaymentLinks) if (item.id) await syncDelete(undefined, db.paymentAllocations, item.id)
    for (const item of stalePayments) if (item.id) await syncDelete(undefined, db.payments, item.id)
    for (const item of staleAllocations) if (item.id) await syncDelete(undefined, db.transactionAllocations, item.id)
    await syncDelete(undefined, db.transactions, transactionId)
    scheduleSync()
  },
}
