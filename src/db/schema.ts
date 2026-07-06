import Dexie, { type Table } from 'dexie'
import type {
  IpProfile, TaxSettings, Holiday, Transaction, Employee,
  EmployeeDeduction, PayrollRecord, TaxCalculation, CalendarEvent,
  AuditLog, EnsRecord, ReportRecord
} from '@/types'

export class AppDatabase extends Dexie {
  ipProfiles!: Table<IpProfile, number>
  taxSettings!: Table<TaxSettings, number>
  holidays!: Table<Holiday, number>
  transactions!: Table<Transaction, number>
  employees!: Table<Employee, number>
  employeeDeductions!: Table<EmployeeDeduction, number>
  payrollRecords!: Table<PayrollRecord, number>
  taxCalculations!: Table<TaxCalculation, number>
  calendarEvents!: Table<CalendarEvent, number>
  auditLogs!: Table<AuditLog, number>
  ensRecords!: Table<EnsRecord, number>
  reportRecords!: Table<ReportRecord, number>

  constructor() {
    super('ip-platezhi-db')
    this.version(1).stores({
      ipProfiles: '++id, inn, year',
      taxSettings: '++id, ipId, year',
      holidays: '++id, ipId, date, year',
      transactions: '++id, ipId, date, type, period, category',
      employees: '++id, ipId, status, fullName',
      employeeDeductions: '++id, employeeId, ipId',
      payrollRecords: '++id, ipId, employeeId, period',
      taxCalculations: '++id, ipId, type, period, status',
      calendarEvents: '++id, ipId, date, type, status',
      auditLogs: '++id, ipId, entityType, entityId',
      ensRecords: '++id, ipId, date, type',
      reportRecords: '++id, ipId, name, period, status',
    })
  }
}

export const db = new AppDatabase()
