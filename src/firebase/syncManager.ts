import { syncRecordToCloud, syncDeleteFromCloud, syncTableToCloud, syncTableFromCloud } from './sync'
import { db } from '../db/schema'
import type { TableName } from './types'

const TABLE_MAP: Record<string, TableName> = {
  'ipProfiles': 'ipProfiles',
  'taxSettings': 'taxSettings',
  'holidays': 'holidays',
  'transactions': 'transactions',
  'employees': 'employees',
  'employeeDeductions': 'employeeDeductions',
  'payrollRecords': 'payrollRecords',
  'taxCalculations': 'taxCalculations',
  'calendarEvents': 'calendarEvents',
  'auditLogs': 'auditLogs',
  'ensRecords': 'ensRecords',
  'reportRecords': 'reportRecords',
}

function getTable(dexieTable: any): TableName | null {
  for (const [key, val] of Object.entries(TABLE_MAP)) {
    if (db[key as keyof typeof db] === dexieTable) return val
  }
  return null
}

export async function syncAdd(userId: string, dexieTable: any, id: number, data: any): Promise<void> {
  const table = getTable(dexieTable)
  if (table && userId) {
    try {
      await syncRecordToCloud(userId, table, id, data)
    } catch (e) {
      console.warn('Sync add failed:', e)
    }
  }
}

export async function syncUpdate(userId: string, dexieTable: any, id: number, data: any): Promise<void> {
  const table = getTable(dexieTable)
  if (table && userId) {
    try {
      await syncRecordToCloud(userId, table, id, data)
    } catch (e) {
      console.warn('Sync update failed:', e)
    }
  }
}

export async function syncDelete(userId: string, dexieTable: any, id: number): Promise<void> {
  const table = getTable(dexieTable)
  if (table && userId) {
    try {
      await syncDeleteFromCloud(userId, table, id)
    } catch (e) {
      console.warn('Sync delete failed:', e)
    }
  }
}

// Full table sync: IndexedDB → Firebase
export async function syncFullTable(userId: string, dexieTable: any, table: TableName): Promise<void> {
  if (!userId) return
  try {
    const data = await dexieTable.toArray()
    await syncTableToCloud(userId, table, data)
  } catch (e) {
    console.warn('Full table sync failed:', e)
  }
}

// Full table sync: Firebase → IndexedDB (for initial load)
export async function loadFromCloud(userId: string, table: TableName, dexieTable: any): Promise<void> {
  if (!userId) return
  try {
    const cloudData = await syncTableFromCloud(userId, table)
    const localData = await dexieTable.toArray()
    const localIds = new Set(localData.map((d: any) => d.id))

    for (const [id, record] of Object.entries(cloudData)) {
      if (!localIds.has(Number(id))) {
        await dexieTable.add({ ...record, id: Number(id) } as any)
      }
    }
  } catch (e) {
    console.warn('Load from cloud failed:', e)
  }
}

// Load all tables from cloud
export async function loadAllFromCloud(userId: string): Promise<void> {
  if (!userId) return
  const tables: [any, TableName][] = [
    [db.ipProfiles, 'ipProfiles'],
    [db.taxSettings, 'taxSettings'],
    [db.holidays, 'holidays'],
    [db.transactions, 'transactions'],
    [db.employees, 'employees'],
    [db.employeeDeductions, 'employeeDeductions'],
    [db.payrollRecords, 'payrollRecords'],
    [db.taxCalculations, 'taxCalculations'],
    [db.calendarEvents, 'calendarEvents'],
    [db.ensRecords, 'ensRecords'],
    [db.reportRecords, 'reportRecords'],
  ]

  for (const [dexieTable, tableName] of tables) {
    await loadFromCloud(userId, tableName, dexieTable)
  }
}

// Migrate all local data to cloud
export async function migrateAllToCloud(userId: string): Promise<void> {
  if (!userId) return
  const tables: [any, TableName][] = [
    [db.ipProfiles, 'ipProfiles'],
    [db.taxSettings, 'taxSettings'],
    [db.holidays, 'holidays'],
    [db.transactions, 'transactions'],
    [db.employees, 'employees'],
    [db.employeeDeductions, 'employeeDeductions'],
    [db.payrollRecords, 'payrollRecords'],
    [db.taxCalculations, 'taxCalculations'],
    [db.calendarEvents, 'calendarEvents'],
    [db.auditLogs, 'auditLogs'],
    [db.ensRecords, 'ensRecords'],
    [db.reportRecords, 'reportRecords'],
  ]

  for (const [dexieTable, tableName] of tables) {
    await syncFullTable(userId, dexieTable, tableName)
  }
}
