import { db } from '../schema'
import type { TaxCalculation } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

export const taxCalcRepo = {
  async getAll(ipId: number): Promise<TaxCalculation[]> {
    return db.taxCalculations.where('ipId').equals(ipId).toArray()
  },

  async getByType(ipId: number, type: TaxCalculation['type']): Promise<TaxCalculation[]> {
    return db.taxCalculations.where({ ipId, type }).toArray()
  },

  async getByPeriod(ipId: number, period: string): Promise<TaxCalculation[]> {
    return db.taxCalculations.where({ ipId, period }).toArray()
  },

  async add(calc: Omit<TaxCalculation, 'id'>, userId?: string): Promise<number> {
    const id = await db.taxCalculations.add(calc as TaxCalculation)
    if (userId) await syncAdd(userId, db.taxCalculations, id as number, { ...calc, id })
    return id
  },

  async update(id: number, changes: Partial<TaxCalculation>, userId?: string): Promise<void> {
    await db.taxCalculations.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.taxCalculations, id, { ...changes, id })
  },

  async delete(id: number, userId?: string): Promise<void> {
    await db.taxCalculations.delete(id)
    if (userId) await syncDelete(userId, db.taxCalculations, id)
  },

  async getUpcoming(ipId: number, limit = 5): Promise<TaxCalculation[]> {
    const now = new Date().toISOString().split('T')[0]
    return db.taxCalculations
      .where('ipId')
      .equals(ipId)
      .filter(c => c.dueDate >= now && c.status !== 'paid')
      .sortBy('dueDate')
      .then(items => items.slice(0, limit))
  },

  async getOverdue(ipId: number): Promise<TaxCalculation[]> {
    const now = new Date().toISOString().split('T')[0]
    return db.taxCalculations
      .where('ipId')
      .equals(ipId)
      .filter(c => c.dueDate < now && c.status !== 'paid')
      .toArray()
  }
}
