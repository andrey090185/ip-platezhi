import { db } from '../schema'
import type { TaxObligation } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

export const taxCalcRepo = {
  async getAll(ipId: number): Promise<TaxObligation[]> {
    return db.taxObligations.where('ipId').equals(ipId).toArray()
  },

  async getByType(ipId: number, type: TaxObligation['type']): Promise<TaxObligation[]> {
    return db.taxObligations.where({ ipId, type }).toArray()
  },

  async getByPeriod(ipId: number, period: string): Promise<TaxObligation[]> {
    return db.taxObligations.where({ ipId, period }).toArray()
  },

  async add(calc: Omit<TaxObligation, 'id'>, userId?: string): Promise<number> {
    const id = await db.taxObligations.add(calc as TaxObligation)
    if (userId) await syncAdd(userId, db.taxObligations, id as number, { ...calc, id })
    return id
  },

  async update(id: number, changes: Partial<TaxObligation>, userId?: string): Promise<void> {
    await db.taxObligations.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.taxObligations, id, { ...changes, id })
  },

  async delete(id: number, userId?: string): Promise<void> {
    await db.taxObligations.delete(id)
    if (userId) await syncDelete(userId, db.taxObligations, id)
  },

  async getUpcoming(ipId: number, limit = 5): Promise<TaxObligation[]> {
    const now = new Date().toISOString().split('T')[0]
    const all = await db.taxObligations
      .where('ipId')
      .equals(ipId)
      .toArray()
    return all
      .filter(c => c.dueDate >= now && c.status !== 'paid')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, limit)
  },

  async getOverdue(ipId: number): Promise<TaxObligation[]> {
    const now = new Date().toISOString().split('T')[0]
    const all = await db.taxObligations
      .where('ipId')
      .equals(ipId)
      .toArray()
    return all.filter(c => c.dueDate < now && c.status !== 'paid')
  }
}
