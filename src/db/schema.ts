import Dexie, { type Table } from 'dexie'
import type {
  IpProfile, TaxSettings, Holiday, Transaction,
  TaxObligation, Payment, CalculationSnapshot, CalendarEvent,
  AuditLog, EnsRecord, ReportRecord, TaxRegimeVersion,
  TransactionAllocation, PaymentAllocation
} from '@/types'
import { createEntityId } from './entityId'

export class AppDatabase extends Dexie {
  ipProfiles!: Table<IpProfile, number>
  taxRegimeVersions!: Table<TaxRegimeVersion, number>
  taxSettings!: Table<TaxSettings, number>
  holidays!: Table<Holiday, number>
  transactions!: Table<Transaction, number>
  transactionAllocations!: Table<TransactionAllocation, number>
  taxObligations!: Table<TaxObligation, number>
  payments!: Table<Payment, number>
  paymentAllocations!: Table<PaymentAllocation, number>
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

    // Additive migration: legacy transactions/payments remain valid and are
    // interpreted through compatibility fallbacks in the repositories.
    this.version(2).stores({
      ipProfiles: '++id, inn, year',
      taxRegimeVersions: '++id, ipId',
      taxSettings: '++id, ipId, year',
      holidays: '++id, ipId, date, year',
      transactions: '++id, ipId, date, type, period, category, status',
      transactionAllocations: '++id, ipId, transactionId, kind, obligationId',
      taxObligations: '++id, ipId, type, period, status',
      payments: '++id, ipId, obligationId, date, sourceTransactionId',
      paymentAllocations: '++id, ipId, paymentId, obligationId',
      calculationSnapshots: '++id, ipId, type, period',
      calendarEvents: '++id, ipId, date, type, status',
      auditLogs: '++id, ipId, entityType, entityId',
      ensRecords: '++id, ipId, date, type',
      reportRecords: '++id, ipId, name, period, status',
    })

    this.version(3).stores({
      transactions: '++id, ipId, date, type, period, category, status, fingerprint',
    })

    this.version(4).stores({
      taxObligations: '++id, ipId, type, period, taxYear, dueYear, status',
      payments: '++id, ipId, obligationId, date, taxYear, sourceTransactionId',
    }).upgrade(async transaction => {
      await transaction.table<TaxSettings, number>('taxSettings').toCollection().modify(settings => {
        if (settings.considerPreviousYearAdditional == null) {
          settings.considerPreviousYearAdditional = true
        }
      })
      await transaction.table<TaxObligation, number>('taxObligations').toCollection().modify(obligation => {
        const periodYear = Number(obligation.period.match(/^\d{4}/)?.[0])
        obligation.taxYear = obligation.taxYear ?? (Number.isFinite(periodYear) ? periodYear : Number(obligation.dueDate.slice(0, 4)))
        obligation.dueYear = obligation.dueYear ?? Number(obligation.dueDate.slice(0, 4))
      })
      await transaction.table<Payment, number>('payments').toCollection().modify(payment => {
        const periodYear = Number(payment.period?.match(/^\d{4}/)?.[0])
        payment.taxYear = payment.taxYear ?? (Number.isFinite(periodYear) ? periodYear : Number(payment.date.slice(0, 4)))
      })
    })
  }
}

export const db = new AppDatabase()

// Existing numeric ids remain valid. New records receive random safe-integer
// ids so independently working devices do not reuse the same Firebase key.
for (const table of db.tables) {
  table.hook('creating', primaryKey => primaryKey == null ? createEntityId() : undefined)
}
