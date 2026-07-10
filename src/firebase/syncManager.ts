import {
  syncRecordToCloud,
  syncDeleteFromCloud,
  syncTableToCloud,
  syncTableFromCloud,
} from './sync'
import { db } from '../db/schema'
import type { TableName } from './types'

type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

let sessionUserId: string | null = null

export function setSyncUser(uid: string | null): void {
  sessionUserId = uid
}

export function getSyncUser(): string | null {
  return sessionUserId
}

let onStatus: ((status: SyncStatus) => void) | null = null

export function setSyncStatusHandler(fn: ((status: SyncStatus) => void) | null): void {
  onStatus = fn
}

const CANON: [any, TableName][] = [
  [db.ipProfiles, 'ipProfiles'],
  [db.taxRegimeVersions, 'taxRegimeVersions'],
  [db.taxSettings, 'taxSettings'],
  [db.holidays, 'holidays'],
  [db.transactions, 'transactions'],
  [db.taxObligations, 'taxObligations'],
  [db.payments, 'payments'],
  [db.calculationSnapshots, 'calculationSnapshots'],
  [db.calendarEvents, 'calendarEvents'],
  [db.auditLogs, 'auditLogs'],
  [db.ensRecords, 'ensRecords'],
  [db.reportRecords, 'reportRecords'],
]

const TABLE_MAP: Record<string, TableName> = Object.fromEntries(
  CANON.map(([, name]) => [name, name])
)

function getTable(dexieTable: any): TableName | null {
  for (const [key, val] of Object.entries(TABLE_MAP)) {
    if (db[key as keyof typeof db] === dexieTable) return val
  }
  return null
}

function resolveUser(userId?: string | null): string | null {
  return userId || sessionUserId
}

export async function syncAdd(userId: string | undefined, dexieTable: any, id: number, data: any): Promise<void> {
  const uid = resolveUser(userId)
  const table = getTable(dexieTable)
  if (uid && table) {
    try {
      await syncRecordToCloud(uid, table, id, data)
    } catch (e) {
      console.warn('Sync add failed:', e)
    }
  }
}

export async function syncUpdate(userId: string | undefined, dexieTable: any, id: number, data: any): Promise<void> {
  const uid = resolveUser(userId)
  const table = getTable(dexieTable)
  if (uid && table) {
    try {
      await syncRecordToCloud(uid, table, id, data)
    } catch (e) {
      console.warn('Sync update failed:', e)
    }
  }
}

export async function syncDelete(userId: string | undefined, dexieTable: any, id: number): Promise<void> {
  const uid = resolveUser(userId)
  const table = getTable(dexieTable)
  if (uid && table) {
    try {
      await syncDeleteFromCloud(uid, table, id)
    } catch (e) {
      console.warn('Sync delete failed:', e)
    }
  }
}

export async function syncFullTable(userId: string | undefined, dexieTable: any, table: TableName): Promise<void> {
  const uid = resolveUser(userId)
  if (!uid) return
  try {
    const data = await dexieTable.toArray()
    await syncTableToCloud(uid, table, data)
  } catch (e) {
    console.warn('Full table sync failed:', e)
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
let suppressed = false

export function suppressSync(value: boolean): void {
  suppressed = value
  if (value && syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
}

export function scheduleSync(): void {
  if (suppressed) return
  const uid = sessionUserId
  if (!uid) return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    syncTimer = null
    onStatus?.('syncing')
    try {
      await pushAllToCloud(uid)
      onStatus?.('synced')
    } catch (e) {
      console.warn('Auto-sync failed:', e)
      onStatus?.('error')
    }
  }, 1500)
}

export async function pushAllToCloud(userId: string): Promise<void> {
  if (!userId) return
  for (const [dexieTable, name] of CANON) {
    await syncFullTable(userId, dexieTable, name)
  }
}

export async function mirrorAllFromCloud(userId: string): Promise<void> {
  if (!userId) return
  suppressSync(true)
  try {
    for (const [dexieTable, name] of CANON) {
      try {
        const cloud = await syncTableFromCloud(userId, name)
        const records = Object.entries(cloud).map(([id, rec]) => ({
          ...(rec as any),
          id: Number(id),
        }))
        await dexieTable.clear()
        if (records.length) await dexieTable.bulkPut(records as any)
      } catch (e) {
        console.warn(`Mirror of table "${name}" failed:`, e)
      }
    }
  } finally {
    suppressSync(false)
  }
}

export async function cloudHasData(userId: string): Promise<boolean> {
  const ips = await syncTableFromCloud(userId, 'ipProfiles')
  return Object.keys(ips).length > 0
}

export async function syncOnLogin(userId: string): Promise<void> {
  if (!userId) return
  if (await cloudHasData(userId)) {
    await mirrorAllFromCloud(userId)
  } else {
    await pushAllToCloud(userId)
  }
}

export async function loadFromCloud(userId: string, table: TableName, dexieTable: any): Promise<void> {
  if (!userId) return
  try {
    const cloudData = await syncTableFromCloud(userId, table)
    const localData = await dexieTable.toArray()
    const localIds = new Set(localData.map((d: any) => d.id))
    for (const [id, record] of Object.entries(cloudData)) {
      if (!localIds.has(Number(id))) {
        await dexieTable.add({ ...(record as any), id: Number(id) } as any)
      }
    }
  } catch (e) {
    console.warn('Load from cloud failed:', e)
  }
}

export async function loadAllFromCloud(userId: string): Promise<void> {
  await mirrorAllFromCloud(userId)
}

export async function migrateAllToCloud(userId: string): Promise<void> {
  await pushAllToCloud(userId)
}
