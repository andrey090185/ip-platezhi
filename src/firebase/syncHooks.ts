import { db } from '../db/schema'
import { scheduleSync } from './syncManager'

const SYNCED_TABLES = [
  db.ipProfiles,
  db.taxRegimeVersions,
  db.taxSettings,
  db.holidays,
  db.transactions,
  db.transactionAllocations,
  db.taxObligations,
  db.payments,
  db.paymentAllocations,
  db.calculationSnapshots,
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
