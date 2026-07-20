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
const LOCAL_OWNER_KEY = 'ip-platezhi-local-owner'
const LEGACY_PENDING_DELETES_KEY = 'ip-platezhi-pending-sync-deletes'
const pendingDeletesKey = (userId: string) => `${LEGACY_PENDING_DELETES_KEY}:${userId}`

interface PendingDelete { table: TableName; id: number }

function parsePendingDeletes(raw: string | null): PendingDelete[] {
  try {
    const value = JSON.parse(raw ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function readPendingDeletes(userId: string): PendingDelete[] {
  if (typeof localStorage === 'undefined') return []
  return parsePendingDeletes(localStorage.getItem(pendingDeletesKey(userId)))
}

function writePendingDeletes(userId: string, items: PendingDelete[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(pendingDeletesKey(userId), JSON.stringify(items))
}

function queueDelete(userId: string, table: TableName, id: number): void {
  const pending = readPendingDeletes(userId)
  if (!pending.some(item => item.table === table && item.id === id)) {
    writePendingDeletes(userId, [...pending, { table, id }])
  }
}

async function flushPendingDeletes(userId: string): Promise<void> {
  const pending = readPendingDeletes(userId)
  if (!pending.length) return
  const failed: PendingDelete[] = []
  for (const item of pending) {
    try {
      await syncDeleteFromCloud(userId, item.table, item.id)
    } catch {
      failed.push(item)
    }
  }
  writePendingDeletes(userId, failed)
  if (failed.length) throw new Error(`Не удалось синхронизировать удалений: ${failed.length}`)
}

function migrateLegacyPendingDeletes(userId: string): void {
  if (typeof localStorage === 'undefined') return
  const legacy = parsePendingDeletes(localStorage.getItem(LEGACY_PENDING_DELETES_KEY))
  if (legacy.length) {
    const current = readPendingDeletes(userId)
    const merged = [...current]
    for (const item of legacy) {
      if (!merged.some(candidate => candidate.table === item.table && candidate.id === item.id)) merged.push(item)
    }
    writePendingDeletes(userId, merged)
  }
  localStorage.removeItem(LEGACY_PENDING_DELETES_KEY)
}

async function prepareLocalWorkspace(userId: string): Promise<void> {
  if (typeof localStorage === 'undefined') return
  const previousOwner = localStorage.getItem(LOCAL_OWNER_KEY)

  if (previousOwner && previousOwner !== userId) {
    suppressSync(true)
    try {
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) await table.clear()
      })
    } finally {
      suppressSync(false)
    }
    localStorage.removeItem(LEGACY_PENDING_DELETES_KEY)
  } else {
    // Before owner tracking existed, the current signed-in account is the only
    // safe owner to which queued local deletions can be attributed.
    migrateLegacyPendingDeletes(userId)
  }

  localStorage.setItem(LOCAL_OWNER_KEY, userId)
}

export function setSyncUser(uid: string | null): void {
  sessionUserId = uid
  if (uid) void flushPendingDeletes(uid).catch(() => onStatus?.('error'))
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
  [db.transactionAllocations, 'transactionAllocations'],
  [db.taxObligations, 'taxObligations'],
  [db.payments, 'payments'],
  [db.paymentAllocations, 'paymentAllocations'],
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
    onStatus?.('syncing')
    try {
      await syncRecordToCloud(uid, table, id, data)
      onStatus?.('synced')
    } catch (e) {
      onStatus?.('error')
      console.warn('Sync add failed:', e)
    }
  }
}

export async function syncUpdate(userId: string | undefined, dexieTable: any, id: number, data: any): Promise<void> {
  const uid = resolveUser(userId)
  const table = getTable(dexieTable)
  if (uid && table) {
    onStatus?.('syncing')
    try {
      await syncRecordToCloud(uid, table, id, data)
      onStatus?.('synced')
    } catch (e) {
      onStatus?.('error')
      console.warn('Sync update failed:', e)
    }
  }
}

export async function syncDelete(userId: string | undefined, dexieTable: any, id: number): Promise<void> {
  const uid = resolveUser(userId)
  const table = getTable(dexieTable)
  if (!table) return
  // Pure local mode has no cloud owner, therefore nothing should be queued.
  if (!uid) return
  try {
    await syncDeleteFromCloud(uid, table, id)
  } catch (e) {
    queueDelete(uid, table, id)
    onStatus?.('error')
    console.warn('Sync delete failed:', e)
  }
}

export async function syncFullTable(userId: string | undefined, dexieTable: any, table: TableName): Promise<void> {
  const uid = resolveUser(userId)
  if (!uid) return
  const data = await dexieTable.toArray()
  await syncTableToCloud(uid, table, data)
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
      await flushPendingDeletes(uid)
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

export async function retrySync(): Promise<void> {
  const userId = sessionUserId
  if (!userId) return
  onStatus?.('syncing')
  try {
    await flushPendingDeletes(userId)
    await pushAllToCloud(userId)
    onStatus?.('synced')
  } catch (error) {
    onStatus?.('error')
    throw error
  }
}

export async function mirrorAllFromCloud(userId: string): Promise<void> {
  if (!userId) return
  suppressSync(true)
  try {
    const failures: unknown[] = []
    for (const [dexieTable, name] of CANON) {
      try {
        const cloud = await syncTableFromCloud(userId, name)
        const records = Object.entries(cloud).map(([id, rec]) => ({
          ...(rec as any),
          id: Number(id),
        }))
        const local = await dexieTable.toArray()
        const localById = new Map<number, any>(local.map((record: any) => [Number(record.id), record] as [number, any]))
        const newer = records.filter((record: any) => {
          const localRecord: any = localById.get(record.id)
          if (!localRecord) return true
          const remoteTime = record.updatedAt || record.createdAt || ''
          const localTime = localRecord.updatedAt || localRecord.createdAt || ''
          return remoteTime >= localTime
        })
        if (newer.length) await dexieTable.bulkPut(newer as any)
      } catch (e) {
        console.warn(`Mirror of table "${name}" failed:`, e)
        failures.push(e)
      }
    }
    if (failures.length) throw new Error(`Не удалось синхронизировать таблиц: ${failures.length}`)
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
  await prepareLocalWorkspace(userId)
  await flushPendingDeletes(userId)
  if (await cloudHasData(userId)) {
    await mirrorAllFromCloud(userId)
    await pushAllToCloud(userId)
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
