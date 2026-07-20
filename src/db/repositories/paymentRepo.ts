import { db } from '../schema'
import { d } from '@/engine/decimal'
import type { Payment, PaymentAllocation, TaxObligation } from '@/types'
import { scheduleSync, syncDelete } from '@/firebase/syncManager'

export interface NewPayment extends Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'obligationId'> {
  obligationId?: number | null
  allocateAmount?: string
}

function obligationStatus(obligation: TaxObligation, paidAmount: string): TaxObligation['status'] {
  const paid = d(paidAmount)
  const amount = d(obligation.amount)
  if (amount.gt(0) && paid.gte(amount)) return 'paid'
  if (amount.gt(0) && obligation.dueDate < new Date().toISOString().slice(0, 10)) return 'overdue'
  return amount.gt(0) ? 'due' : 'calculated'
}

export async function refreshObligationPaymentState(obligationId: number): Promise<void> {
  const obligation = await db.taxObligations.get(obligationId)
  if (!obligation) return
  const allocations = await db.paymentAllocations.where('obligationId').equals(obligationId).toArray()
  const paidAmount = allocations.reduce((sum, item) => sum.plus(d(item.amount)), d(0)).toFixed(2)
  const payments = allocations.length
    ? await db.payments.bulkGet(allocations.map(item => item.paymentId))
    : []
  const paidDate = payments
    .filter((item): item is Payment => Boolean(item))
    .map(item => item.date)
    .sort()
    .at(-1) ?? null

  await db.taxObligations.update(obligationId, {
    paidAmount,
    paidDate,
    status: obligationStatus(obligation, paidAmount),
    updatedAt: new Date().toISOString(),
  })
}

export const paymentRepo = {
  async getAll(ipId: number): Promise<Payment[]> {
    const rows = await db.payments.where('ipId').equals(ipId).toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  },

  async getAllocations(ipId: number): Promise<PaymentAllocation[]> {
    return db.paymentAllocations.where('ipId').equals(ipId).toArray()
  },

  async add(input: NewPayment): Promise<number> {
    const now = new Date().toISOString()
    const obligationId = input.obligationId ?? null
    const allocateAmount = input.allocateAmount ?? input.amount
    if (obligationId && d(allocateAmount).gt(d(input.amount))) {
      throw new Error('Зачтённая сумма не может превышать сумму платежа')
    }

    let paymentId = 0
    await db.transaction('rw', db.payments, db.paymentAllocations, async () => {
      const { allocateAmount: _allocateAmount, ...payment } = input
      paymentId = await db.payments.add({
        ...payment,
        obligationId,
        createdAt: now,
        updatedAt: now,
      } as Payment)
      if (obligationId && d(allocateAmount).gt(0)) {
        await db.paymentAllocations.add({
          ipId: input.ipId,
          paymentId,
          obligationId,
          amount: d(allocateAmount).toFixed(2),
          createdAt: now,
        })
      }
    })
    if (obligationId) await refreshObligationPaymentState(obligationId)
    scheduleSync()
    return paymentId
  },

  async allocate(paymentId: number, obligationId: number, amount: string): Promise<void> {
    const [payment, obligation, links] = await Promise.all([
      db.payments.get(paymentId),
      db.taxObligations.get(obligationId),
      db.paymentAllocations.where('paymentId').equals(paymentId).toArray(),
    ])
    if (!payment || !obligation || payment.ipId !== obligation.ipId) {
      throw new Error('Платёж или обязательство не найдено.')
    }
    const allocated = links.reduce((sum, link) => sum.plus(d(link.amount)), d(0))
    const available = d(payment.amount).minus(allocated)
    if (!d(amount).gt(0) || d(amount).gt(available)) {
      throw new Error(`Можно распределить не более ${available.toFixed(2)} ₽.`)
    }
    const existing = links.find(link => link.obligationId === obligationId)
    if (existing?.id) {
      await db.paymentAllocations.update(existing.id, {
        amount: d(existing.amount).plus(d(amount)).toFixed(2),
      })
    } else {
      await db.paymentAllocations.add({
        ipId: payment.ipId,
        paymentId,
        obligationId,
        amount: d(amount).toFixed(2),
        createdAt: new Date().toISOString(),
      })
    }
    await refreshObligationPaymentState(obligationId)
    scheduleSync()
  },

  async remove(paymentId: number): Promise<void> {
    const allocations = await db.paymentAllocations.where('paymentId').equals(paymentId).toArray()
    await db.transaction('rw', db.payments, db.paymentAllocations, async () => {
      await db.paymentAllocations.where('paymentId').equals(paymentId).delete()
      await db.payments.delete(paymentId)
    })
    for (const obligationId of new Set(allocations.map(item => item.obligationId))) {
      await refreshObligationPaymentState(obligationId)
    }
    for (const allocation of allocations) {
      if (allocation.id) await syncDelete(undefined, db.paymentAllocations, allocation.id)
    }
    await syncDelete(undefined, db.payments, paymentId)
    scheduleSync()
  },
}
