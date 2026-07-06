// Registers Dexie change hooks once, at app startup. Any create/update/delete
// on a synced table schedules a (debounced) push of the whole database to the
// cloud. This is the single place that keeps Firebase in sync with local data,
// so no individual page or repository has to remember to sync.
import { db } from '../db/schema'
import { scheduleSync } from './syncManager'

const SYNCED_TABLES = [
  db.ipProfiles,
  db.taxSettings,
  db.holidays,
  db.transactions,
  db.employees,
  db.employeeDeductions,
  db.payrollRecords,
  db.taxCalculations,
  db.calendarEvents,
  db.auditLogs,
  db.ensRecords,
  db.reportRecords,
]

for (const table of SYNCED_TABLES) {
  table.hook('creating', () => {
    scheduleSync()
  })
  table.hook('updating', () => {
    scheduleSync()
  })
  table.hook('deleting', () => {
    scheduleSync()
  })
}
