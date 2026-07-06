import { ref, set, get, remove, push, onValue, off } from 'firebase/database'
import { db } from './config'

type TableName = 'ipProfiles' | 'taxSettings' | 'holidays' | 'transactions' |
  'employees' | 'employeeDeductions' | 'payrollRecords' | 'taxCalculations' |
  'calendarEvents' | 'auditLogs' | 'ensRecords' | 'reportRecords'

function getUserPath(userId: string, table: TableName): string {
  return `users/${userId}/${table}`
}

// Firebase Realtime Database rejects any `undefined` value. Optional fields and
// the record's own `id` must be removed before writing, or `set()` throws.
function forFirebase(value: any): any {
  return JSON.parse(JSON.stringify(value ?? null))
}

// Write entire collection for a table
export async function syncTableToCloud(userId: string, table: TableName, data: any[]): Promise<void> {
  const path = getUserPath(userId, table)
  const dbRef = ref(db, path)
  const map: Record<string, any> = {}
  for (const item of data) {
    const id = String(item.id || push(ref(db, path)).key)
    const { id: _omit, ...rest } = item
    map[id] = forFirebase(rest)
  }
  await set(dbRef, map)
}

// Write single record
export async function syncRecordToCloud(userId: string, table: TableName, id: number, data: any): Promise<void> {
  const path = `${getUserPath(userId, table)}/${id}`
  const dbRef = ref(db, path)
  const { id: _, ...rest } = data
  await set(dbRef, forFirebase(rest))
}

// Delete single record
export async function syncDeleteFromCloud(userId: string, table: TableName, id: number): Promise<void> {
  const path = `${getUserPath(userId, table)}/${id}`
  await remove(ref(db, path))
}

// Delete entire table for user
export async function syncDeleteTable(userId: string, table: TableName): Promise<void> {
  const path = getUserPath(userId, table)
  await remove(ref(db, path))
}

// Read entire table
export async function syncTableFromCloud(userId: string, table: TableName): Promise<Record<string, any>> {
  const path = getUserPath(userId, table)
  const dbRef = ref(db, path)
  const snapshot = await get(dbRef)
  if (!snapshot.exists()) return {}
  return snapshot.val()
}

// Listen for changes on a table
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

// Migrate all local IndexedDB data to Firebase
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
