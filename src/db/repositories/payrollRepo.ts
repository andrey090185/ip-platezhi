import { db } from '../schema'
import type { PayrollRecord } from '@/types'

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

  async add(record: Omit<PayrollRecord, 'id'>): Promise<number> {
    return db.payrollRecords.add(record as PayrollRecord)
  },

  async addBatch(records: Omit<PayrollRecord, 'id'>[]): Promise<number> {
    return db.payrollRecords.bulkAdd(records as PayrollRecord[])
  },

  async update(id: number, changes: Partial<PayrollRecord>): Promise<void> {
    await db.payrollRecords.update(id, { ...changes, updatedAt: new Date().toISOString() })
  },

  async delete(id: number): Promise<void> {
    await db.payrollRecords.delete(id)
  },

  async getYtdIncome(employeeId: number, year: number): Promise<string> {
    const records = await db.payrollRecords.where('employeeId').equals(employeeId).toArray()
    const yearRecords = records.filter(r => r.period.startsWith(String(year)))
    return yearRecords.reduce((acc, r) => acc + parseFloat(r.totalIncomeYtd || '0'), 0).toFixed(2)
  },

  async getTotalNdfForPeriod(ipId: number, period: string): Promise<string> {
    const records = await db.payrollRecords.where({ ipId, period }).toArray()
    return records.reduce((acc, r) => acc + parseFloat(r.ndflAmount || '0'), 0).toFixed(2)
  },

  async getTotalInsuranceForPeriod(ipId: number, period: string): Promise<string> {
    const records = await db.payrollRecords.where({ ipId, period }).toArray()
    return records.reduce((acc, r) => acc + parseFloat(r.insuranceAmount || '0'), 0).toFixed(2)
  },

  async getTotalTraumaForPeriod(ipId: number, period: string): Promise<string> {
    const records = await db.payrollRecords.where({ ipId, period }).toArray()
    return records.reduce((acc, r) => acc + parseFloat(r.traumaAmount || '0'), 0).toFixed(2)
  }
}
