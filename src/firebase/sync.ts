import { ref, set, update, get, remove, push, onValue, off } from 'firebase/database'
import { db } from './config'
import type { TableName } from './types'
import { toFirebaseRecord } from './serialization'

function getUserPath(userId: string, table: TableName): string {
  return `users/${userId}/${table}`
}

export async function syncTableToCloud(userId: string, table: TableName, data: any[]): Promise<void> {
  const path = getUserPath(userId, table)
  const dbRef = ref(db, path)
  const map: Record<string, any> = {}
  for (const item of data) {
    const generatedId = item.id == null ? push(ref(db, path)).key : null
    const id = item.id == null ? generatedId : String(item.id)
    if (!id) throw new Error('Не удалось создать идентификатор записи для синхронизации')
    map[id] = toFirebaseRecord(item)
  }
  // Merge records instead of replacing the whole table. Deletions are sent as
  // explicit per-record operations, so one stale device cannot erase another.
  if (Object.keys(map).length) await update(dbRef, map)
}

export async function syncRecordToCloud(userId: string, table: TableName, id: number, data: any): Promise<void> {
  const path = `${getUserPath(userId, table)}/${id}`
  const dbRef = ref(db, path)
  await set(dbRef, toFirebaseRecord(data))
}

export async function syncDeleteFromCloud(userId: string, table: TableName, id: number): Promise<void> {
  const path = `${getUserPath(userId, table)}/${id}`
  await remove(ref(db, path))
}

export async function syncDeleteTable(userId: string, table: TableName): Promise<void> {
  const path = getUserPath(userId, table)
  await remove(ref(db, path))
}

export async function syncTableFromCloud(userId: string, table: TableName): Promise<Record<string, any>> {
  const path = getUserPath(userId, table)
  const dbRef = ref(db, path)
  const snapshot = await get(dbRef)
  if (!snapshot.exists()) return {}
  return snapshot.val()
}

export function listenToTable(
  userId: string,
  table: TableName,
  callback: (data: Record<string, any>) => void
): () => void {
  const path = getUserPath(userId, table)
  const dbRef = ref(db, path)
  onValue(dbRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {})
  })
  return () => off(dbRef)
}

export async function migrateLocalToCloud(
  userId: string,
  tables: { name: TableName; data: any[] }[]
): Promise<void> {
  for (const table of tables) {
    if (table.data.length > 0) {
      await syncTableToCloud(userId, table.name, table.data)
    }
  }
}
