import { db } from '../schema'
import type { IpProfile } from '@/types'
import { syncAdd, syncUpdate, syncDelete } from '@/firebase/syncManager'

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
    const tables = [
      db.taxSettings, db.taxRegimeVersions, db.holidays, db.transactions, db.transactionAllocations,
      db.taxObligations, db.payments, db.paymentAllocations, db.calculationSnapshots,
      db.calendarEvents, db.auditLogs, db.ensRecords, db.reportRecords,
    ]
    const recordsByTable = await Promise.all(tables.map(async table => ({
      table,
      records: await table.where('ipId').equals(id).toArray(),
    })))
    await db.transaction('rw', [db.ipProfiles, ...tables], async () => {
      for (const table of tables) {
        await table.where('ipId').equals(id).delete()
      }
      await db.ipProfiles.delete(id)
    })

    try {
      for (const { table, records } of recordsByTable) {
        for (const record of records) {
          if (record.id) await syncDelete(userId, table, record.id)
        }
      }
      await syncDelete(userId, db.ipProfiles, id)
    } catch (e) {
      console.warn('Cascade sync failed:', e)
    }
  },
}
