import { db } from '@/db/schema'
import { scheduleSync } from '@/firebase/syncManager'

const tables = [
  ['ipProfiles', db.ipProfiles],
  ['taxRegimeVersions', db.taxRegimeVersions],
  ['taxSettings', db.taxSettings],
  ['holidays', db.holidays],
  ['transactions', db.transactions],
  ['transactionAllocations', db.transactionAllocations],
  ['taxObligations', db.taxObligations],
  ['payments', db.payments],
  ['paymentAllocations', db.paymentAllocations],
  ['calculationSnapshots', db.calculationSnapshots],
  ['calendarEvents', db.calendarEvents],
  ['auditLogs', db.auditLogs],
  ['ensRecords', db.ensRecords],
  ['reportRecords', db.reportRecords],
] as const

export interface AppBackup {
  app: 'ip-platezhi'
  schemaVersion: 2
  exportedAt: string
  data: Record<string, unknown[]>
}

export async function createFullBackup(): Promise<AppBackup> {
  const data: Record<string, unknown[]> = {}
  for (const [name, table] of tables) data[name] = await table.toArray()
  return { app: 'ip-platezhi', schemaVersion: 2, exportedAt: new Date().toISOString(), data }
}

export async function restoreBackup(raw: unknown): Promise<void> {
  const backup = raw as Partial<AppBackup>
  if (backup.app !== 'ip-platezhi' || !backup.data || typeof backup.data !== 'object') {
    throw new Error('Файл не является резервной копией «ИП Платежи».')
  }
  const dexieTables = tables.map(([, table]) => table)
  await db.transaction('rw', dexieTables, async () => {
    for (const [name, table] of tables) {
      const records = backup.data?.[name]
      if (Array.isArray(records) && records.length) await (table as any).bulkPut(records)
    }
  })
  scheduleSync()
}
