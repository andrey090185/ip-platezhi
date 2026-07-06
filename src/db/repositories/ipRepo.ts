import { db } from '../schema'
import type { IpProfile } from '@/types'
import { syncAdd, syncUpdate, syncDelete, loadFromCloud } from '@/firebase/syncManager'

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

  async add(ip: Omit<IpProfile, 'id'>, userId?: string): Promise<number> {
    const id = await db.ipProfiles.add(ip as IpProfile)
    if (userId) await syncAdd(userId, db.ipProfiles, id as number, { ...ip, id })
    return id
  },

  async update(id: number, changes: Partial<IpProfile>, userId?: string): Promise<void> {
    await db.ipProfiles.update(id, { ...changes, updatedAt: new Date().toISOString() })
    if (userId) await syncUpdate(userId, db.ipProfiles, id, { ...changes, id })
  },

  async delete(id: number, userId?: string): Promise<void> {
    await db.ipProfiles.delete(id)
    if (userId) await syncDelete(userId, db.ipProfiles, id)
  },

  async deleteWithCascade(id: number, userId?: string): Promise<void> {
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

    if (userId) {
      try {
        const { syncDeleteTable } = await import('@/firebase/sync')
        const tables = [
          'ipProfiles', 'taxSettings', 'holidays', 'transactions',
          'employees', 'employeeDeductions', 'payrollRecords',
          'taxCalculations', 'calendarEvents', 'auditLogs',
          'ensRecords', 'reportRecords'
        ] as const
        for (const table of tables) {
          await syncDeleteTable(userId, table)
        }
      } catch (e) {
        console.warn('Cascade sync failed:', e)
      }
    }
  },
}
