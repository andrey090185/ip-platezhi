import { db } from '../schema'
import type { PayrollRecord } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

export const payrollRepo = {
  async getAll(ipId: number): Promise<PayrollRecord[]> {
    return db.payrollRecords.where('ipId').equals(ipId).toArray()
  },

  async getByPeriod(ipId: number, period: string): Promise<PayrollRecord[]> {
    return db.payrollRecords.where({ ipId, period }).toArray()
  },

  async getByEmployee(employeeId: number): Promise<PayrollRecord[]> {
    return db.payrollRecords.where('employeeId').equals(employeeId).toArray()
  },

  async add(record: Omit<PayrollRecord, 'id'>, userId?: string): Promise<number> {
    const id = await db.payrollRecords.add(record as PayrollRecord)
    if (userId) await syncAdd(userId, db.payrollRecords, id as number, { ...record, id })
    return id
  },

  async addBatch(records: Omit<PayrollRecord, 'id'>[], userId?: string): Promise<number> {
    const ids = await db.payrollRecords.bulkAdd(records as PayrollRecord[])
    if (userId) {
      for (let i = 0; i < records.length; i++) {
        await syncAdd(userId, db.payrollRecords, ids[i] as number, { ...records[i], id: ids[i] })
      }
    }
    return ids as unknown as number
  },

  async update(id: number, changes: Partial<PayrollRecord>, userId?: string): Promise<void> {
    await db.payrollRecords.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.payrollRecords, id, { ...changes, id })
  },

  async delete(id: number, userId?: string): Promise<void> {
    await db.payrollRecords.delete(id)
    if (userId) await syncDelete(userId, db.payrollRecords, id)
  },

  async getYtdIncome(employeeId: number, year: number): Promise<string> {
    const records = await db.payrollRecords.where('employeeId').equals(employeeId).toArray()
    const yearRecords = records.filter(r => r.period.startsWith(String(year)))
    return yearRecords.reduce((acc, r) => acc + parseFloat(r.totalIncomeYtd || '0'), 0).toFixed(2)
  },

  async getTotalNdfForPeriod(ipId: number, period: string): Promise<string> {
    const records = await db.payrollRecords.where({ ipId, period }).toArray()
    return records.reduce((a, r) => a + parseFloat(r.ndflAmount || '0'), 0).toFixed(2)
  },

  async getTotalInsuranceForPeriod(ipId: number, period: string): Promise<string> {
    const records = await db.payrollRecords.where({ ipId, period }).toArray()
    return records.reduce((a, r) => a + parseFloat(r.insuranceAmount || '0'), 0).toFixed(2)
  },

  async getTotalTraumaForPeriod(ipId: number, period: string): Promise<string> {
    const records = await db.payrollRecords.where({ ipId, period }).toArray()
    return records.reduce((a, r) => a + parseFloat(r.traumaAmount || '0'), 0).toFixed(2)
  }
}
