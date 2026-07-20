import { db } from '../schema'
import type { Transaction } from '@/types'
import { summarizeLedger } from '@/engine/ledger'
import { transactionFingerprint } from '@/utils/importService'
import { scheduleSync, syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

export const transactionRepo = {
  async getAll(ipId: number): Promise<Transaction[]> {
    return db.transactions.where('ipId').equals(ipId).reverse().sortBy('date')
  },

  async getByPeriod(ipId: number, period: string): Promise<Transaction[]> {
    return db.transactions.where({ ipId, period }).toArray()
  },

  async getByDateRange(ipId: number, from: string, to: string): Promise<Transaction[]> {
    return db.transactions
      .where('ipId')
      .equals(ipId)
      .filter(t => t.date >= from && t.date <= to)
      .toArray()
  },

  async add(tx: Omit<Transaction, 'id'>, userId?: string): Promise<number> {
    const id = await db.transactions.add(tx as Transaction)
    if (userId) await syncAdd(userId, db.transactions, id as number, { ...tx, id })
    return id
  },

  async update(id: number, changes: Partial<Transaction>, userId?: string): Promise<void> {
    await db.transactions.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.transactions, id, { ...changes, id })
  },

  async delete(id: number, userId?: string): Promise<void> {
    await db.transactions.delete(id)
    if (userId) await syncDelete(userId, db.transactions, id)
  },

  async getIncomeTotal(ipId: number, period?: string): Promise<string> {
    const txs = period
      ? await db.transactions.where({ ipId, period }).toArray()
      : await db.transactions.where('ipId').equals(ipId).toArray()
    const allocations = await db.transactionAllocations.where('ipId').equals(ipId).toArray()
    return summarizeLedger(txs, allocations).netIncome
  },

  async getExpenseTotal(ipId: number, period?: string): Promise<string> {
    const txs = period
      ? await db.transactions.where({ ipId, period }).toArray()
      : await db.transactions.where('ipId').equals(ipId).toArray()
    const allocations = await db.transactionAllocations.where('ipId').equals(ipId).toArray()
    return summarizeLedger(txs, allocations).netExpenses
  },

  async getYearTotals(ipId: number, year: number) {
    const all = await db.transactions.where('ipId').equals(ipId).toArray()
    const yearTxs = all.filter(t => t.date.startsWith(String(year)))
    const allocations = await db.transactionAllocations.where('ipId').equals(ipId).toArray()
    const summary = summarizeLedger(yearTxs, allocations)
    return { income: summary.netIncome, expenses: summary.netExpenses }
  },

  async getQuarterTotals(ipId: number, year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3 + 1
    const months = [startMonth, startMonth + 1, startMonth + 2]
    const all = await db.transactions.where('ipId').equals(ipId).toArray()
    const quarterTxs = all.filter(t => {
      const m = parseInt(t.date.split('-')[1])
      return t.date.startsWith(String(year)) && months.includes(m)
    })
    const allocations = await db.transactionAllocations.where('ipId').equals(ipId).toArray()
    const summary = summarizeLedger(quarterTxs, allocations)
    return { income: summary.netIncome, expenses: summary.netExpenses }
  },

  async getCumulativeTotals(ipId: number, year: number, throughMonth: number) {
    const all = await db.transactions.where('ipId').equals(ipId).toArray()
    const txs = all.filter(transaction => {
      const [txYear, txMonth] = transaction.date.split('-').map(Number)
      return txYear === year && txMonth <= throughMonth
    })
    const allocations = await db.transactionAllocations.where('ipId').equals(ipId).toArray()
    return summarizeLedger(txs, allocations)
  },

  async importBatch(ipId: number, records: Omit<Transaction, 'id'>[]): Promise<number> {
    const existing = await db.transactions.where('ipId').equals(ipId).toArray()
    const fingerprints = new Set(
      existing.map(transaction => transaction.fingerprint || transactionFingerprint(transaction)),
    )
    const unique = records.filter(transaction => {
      const fingerprint = transaction.fingerprint || transactionFingerprint(transaction)
      if (fingerprints.has(fingerprint)) return false
      fingerprints.add(fingerprint)
      transaction.fingerprint = fingerprint
      return true
    })
    if (unique.length) await db.transactions.bulkAdd(unique as Transaction[])
    if (unique.length) scheduleSync()
    return unique.length
  },

  async exportCSV(ipId: number): Promise<Transaction[]> {
    return db.transactions.where('ipId').equals(ipId).toArray()
  }
}
