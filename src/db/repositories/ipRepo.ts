import { db } from '../schema'
import type { IpProfile } from '@/types'

export const ipRepo = {
  async get(): Promise<IpProfile | undefined> {
    return db.ipProfiles.toCollection().first()
  },

  async getAll(): Promise<IpProfile[]> {
    return db.ipProfiles.toArray()
  },

  async getCount(): Promise<number> {
    return db.ipProfiles.count()
  },

  async add(ip: Omit<IpProfile, 'id'>): Promise<number> {
    return db.ipProfiles.add(ip as IpProfile)
  },

  async update(id: number, changes: Partial<IpProfile>): Promise<void> {
    await db.ipProfiles.update(id, { ...changes, updatedAt: new Date().toISOString() })
  },

  async delete(id: number): Promise<void> {
    await db.ipProfiles.delete(id)
  },

  async deleteWithCascade(id: number): Promise<void> {
    await db.transaction('rw', [
      db.ipProfiles, db.taxSettings, db.holidays, db.transactions,
      db.employees, db.employeeDeductions, db.payrollRecords,
      db.taxCalculations, db.calendarEvents, db.auditLogs,
      db.ensRecords, db.reportRecords,
    ], async () => {
      await db.taxSettings.where('ipId').equals(id).delete()
      await db.holidays.where('ipId').equals(id).delete()
      await db.transactions.where('ipId').equals(id).delete()
      await db.employeeDeductions.where('ipId').equals(id).delete()
      await db.employees.where('ipId').equals(id).delete()
      await db.payrollRecords.where('ipId').equals(id).delete()
      await db.taxCalculations.where('ipId').equals(id).delete()
      await db.calendarEvents.where('ipId').equals(id).delete()
      await db.auditLogs.where('ipId').equals(id).delete()
      await db.ensRecords.where('ipId').equals(id).delete()
      await db.reportRecords.where('ipId').equals(id).delete()
      await db.ipProfiles.delete(id)
    })
  },
}
