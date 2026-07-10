import Dexie, { type Table } from 'dexie'
import type {
  IpProfile, TaxSettings, Holiday, Transaction,
  TaxObligation, Payment, CalculationSnapshot, CalendarEvent,
  AuditLog, EnsRecord, ReportRecord, TaxRegimeVersion
} from '@/types'

export class AppDatabase extends Dexie {
  ipProfiles!: Table<IpProfile, number>
  taxRegimeVersions!: Table<TaxRegimeVersion, number>
  taxSettings!: Table<TaxSettings, number>
  holidays!: Table<Holiday, number>
  transactions!: Table<Transaction, number>
  taxObligations!: Table<TaxObligation, number>
  payments!: Table<Payment, number>
  calculationSnapshots!: Table<CalculationSnapshot, number>
  calendarEvents!: Table<CalendarEvent, number>
  auditLogs!: Table<AuditLog, number>
  ensRecords!: Table<EnsRecord, number>
  reportRecords!: Table<ReportRecord, number>

  constructor() {
    super('ip-platezhi-db-v2')
    this.version(1).stores({
      ipProfiles: '++id, inn, year',
      taxRegimeVersions: '++id, ipId',
      taxSettings: '++id, ipId, year',
      holidays: '++id, ipId, date, year',
      transactions: '++id, ipId, date, type, period, category, status',
      taxObligations: '++id, ipId, type, period, status',
      payments: '++id, ipId, obligationId, date',
      calculationSnapshots: '++id, ipId, type, period',
      calendarEvents: '++id, ipId, date, type, status',
      auditLogs: '++id, ipId, entityType, entityId',
      ensRecords: '++id, ipId, date, type',
      reportRecords: '++id, ipId, name, period, status',
    })
  }
}

export const db = new AppDatabase()
