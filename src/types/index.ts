export type UsnObject = 'income' | 'income_minus_expenses'
export type PaymentStatus = 'planned' | 'paid' | 'overdue' | 'draft'
export type TransactionType = 'income' | 'expense' | 'return_income' | 'return_expense'
export type EmployeeStatus = 'active' | 'archived'
export type ContractType = 'labor' | 'gph'
export type TaxResidentStatus = 'resident' | 'non_resident'
export type CalendarEventType = 'payment' | 'notification' | 'report' | 'reminder'
export type ReportStatus = 'planned' | 'prepared' | 'submitted' | 'overdue'
export type NdsMode = 'standard' | 'special_5' | 'special_7'
export type PayrollPeriod = 'first_half' | 'second_half'

export interface IpProfile {
  id?: number
  name: string
  inn: string
  region: string
  year: number
  usnObject: UsnObject
  hasEmployees: boolean
  employeeCount: number
  ndsEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface TaxSettings {
  id?: number
  ipId: number
  year: number
  usnRateIncome: number
  usnRateIncomeMinusExpenses: number
  usnRegionalRate: number
  usnMinTaxRate: number
  usnIncomeLimit: number
  usnEmployeeLimit: number
  usnAssetLimit: number
  fixedPremium: number
  additionalPremiumThreshold: number
  additionalPremiumRate: number
  additionalPremiumMax: number
  considerAdditionalInCurrentYear: boolean
  insuranceBaseThreshold: number
  insuranceMainRate: number
  insuranceExcessRate: number
  traumaRate: number
  ndsThreshold: number
  ndsMode: NdsMode
  reducedTariffEnabled: boolean
  reducedTariffRates: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface Holiday {
  id?: number
  ipId: number
  date: string
  name: string
  year: number
}

export interface Transaction {
  id?: number
  ipId: number
  date: string
  type: TransactionType
  amount: string
  category: string
  counterparty: string
  comment: string
  usnRelevant: boolean
  ndsRelevant: boolean
  period: string
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id?: number
  ipId: number
  fullName: string
  personnelNumber: string
  hireDate: string
  fireDate: string | null
  contractType: ContractType
  taxResidentStatus: TaxResidentStatus
  salary: string
  traumaRate: string | null
  reducedTariff: boolean
  status: EmployeeStatus
  createdAt: string
  updatedAt: string
}

export interface EmployeeDeduction {
  id?: number
  employeeId: number
  ipId: number
  type: string
  amount: string
  dateFrom: string
  dateTo: string
  comment: string
  createdAt: string
}

export interface PayrollRecord {
  id?: number
  ipId: number
  employeeId: number
  period: string
  periodType: PayrollPeriod
  baseSalary: string
  bonus: string
  sickLeave: string
  nonTaxable: string
  deductions: string
  ndflAmount: string
  netPay: string
  insuranceAmount: string
  traumaAmount: string
  totalIncomeYtd: string
  ndflRate: string
  ndflManualOverride: string | null
  insuranceManualOverride: string | null
  overrideReason: string
  createdAt: string
  updatedAt: string
}

export interface TaxCalculation {
  id?: number
  ipId: number
  type: 'usn_advance' | 'usn_annual' | 'ip_premium_fixed' | 'ip_premium_additional' | 'ndfl' | 'insurance' | 'trauma' | 'nds'
  period: string
  base: string
  rate: string
  calculatedAmount: string
  reductions: string
  paidAmount: string
  dueAmount: string
  dueDate: string
  notificationRequired: boolean
  notificationDate: string | null
  manualOverride: string | null
  overrideReason: string
  status: PaymentStatus
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id?: number
  ipId: number
  date: string
  type: CalendarEventType
  title: string
  description: string
  amount: string | null
  period: string | null
  taxCalcId: number | null
  reportName: string | null
  internalDeadline: string | null
  status: PaymentStatus
  comment: string
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id?: number
  ipId: number
  entityType: string
  entityId: number
  field: string
  oldValue: string
  newValue: string
  reason: string
  author: string
  createdAt: string
}

export interface EnsRecord {
  id?: number
  ipId: number
  date: string
  type: 'accrual' | 'payment'
  amount: string
  description: string
  createdAt: string
}

export interface ReportRecord {
  id?: number
  ipId: number
  name: string
  period: string
  dueDate: string
  destination: 'ФНС' | 'СФР'
  status: ReportStatus
  comment: string
  createdAt: string
  updatedAt: string
}
