import { db } from '../schema'
import type { Transaction, TransactionType } from '@/types'
import { dSum, d } from '@/engine/decimal'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

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
    const income = txs
      .filter(t => t.type === 'income' && t.usnRelevant)
      .reduce((acc, t) => acc.plus(d(t.amount)), d(0))
    return income.toFixed(2)
  },

  async getExpenseTotal(ipId: number, period?: string): Promise<string> {
    const txs = period
      ? await db.transactions.where({ ipId, period }).toArray()
      : await db.transactions.where('ipId').equals(ipId).toArray()
    const expense = txs
      .filter(t => t.type === 'expense' && t.usnRelevant)
      .reduce((acc, t) => acc.plus(d(t.amount)), d(0))
    return expense.toFixed(2)
  },

  async getYearTotals(ipId: number, year: number) {
    const all = await db.transactions.where('ipId').equals(ipId).toArray()
    const yearTxs = all.filter(t => t.date.startsWith(String(year)))
    const income = yearTxs
      .filter(t => (t.type === 'income' || t.type === 'return_income') && t.usnRelevant)
      .reduce((acc, t) => acc.plus(d(t.amount)), d(0))
    const expenses = yearTxs
      .filter(t => (t.type === 'expense' || t.type === 'return_expense') && t.usnRelevant)
      .reduce((acc, t) => acc.plus(d(t.amount)), d(0))
    return { income: income.toFixed(2), expenses: expenses.toFixed(2) }
  },

  async getQuarterTotals(ipId: number, year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3 + 1
    const months = [startMonth, startMonth + 1, startMonth + 2]
    const all = await db.transactions.where('ipId').equals(ipId).toArray()
    const quarterTxs = all.filter(t => {
      const m = parseInt(t.date.split('-')[1])
      return t.date.startsWith(String(year)) && months.includes(m)
    })
    const income = quarterTxs
      .filter(t => (t.type === 'income' || t.type === 'return_income') && t.usnRelevant)
      .reduce((acc, t) => acc.plus(d(t.amount)), d(0))
    const expenses = quarterTxs
      .filter(t => (t.type === 'expense' || t.type === 'return_expense') && t.usnRelevant)
      .reduce((acc, t) => acc.plus(d(t.amount)), d(0))
    return { income: income.toFixed(2), expenses: expenses.toFixed(2) }
  },

  async importBatch(ipId: number, records: Omit<Transaction, 'id'>[]): Promise<number> {
    // Returns the key of the last inserted record
    const lastKey = await db.transactions.bulkAdd(records as Transaction[])
    return typeof lastKey === 'number' ? lastKey : 0
  },

  async exportCSV(ipId: number): Promise<Transaction[]> {
    return db.transactions.where('ipId').equals(ipId).toArray()
  }
}
