export type UsnObject = 'income' | 'income_minus_expenses'
export type PaymentStatus = 'planned' | 'paid' | 'overdue' | 'draft'
export type TransactionType = 'income' | 'expense' | 'return_income' | 'return_expense'
export type CalendarEventType = 'payment' | 'notification' | 'report' | 'reminder'
export type ReportStatus = 'planned' | 'prepared' | 'submitted' | 'overdue'
export type NdsMode = 'standard' | 'special_5' | 'special_7'
export type ObligationStatus = 'draft' | 'calculated' | 'due' | 'paid' | 'overdue'
export type AllocationKind =
  | 'taxable_income'
  | 'income_return'
  | 'business_expense'
  | 'business_expense_refund'
  | 'tax_payment'
  | 'non_taxable'
  | 'personal'
  | 'transfer'
  | 'needs_review'
export type TaxPaymentKind = 'usn' | 'fixed_premium' | 'additional_premium' | 'enp' | 'other_tax'

export interface IpProfile {
  id?: number
  name: string
  inn: string
  region: string
  year: number
  usnObject: UsnObject
  registrationDate: string | null
  ifnsCode: string
  oktmo: string
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
  importSource: string | null
  importBatchId: string | null
  fingerprint?: string | null
  status: 'accounted' | 'not_accounted' | 'needs_review'
  createdAt: string
  updatedAt: string
}

/**
 * One bank/manual operation may have several accounting purposes. Amounts are
 * always positive; the allocation kind determines their effect on the ledger.
 */
export interface TransactionAllocation {
  id?: number
  ipId: number
  transactionId: number
  kind: AllocationKind
  amount: string
  category: string
  taxPaymentKind: TaxPaymentKind | null
  taxPeriod: string | null
  obligationId: number | null
  comment: string
  createdAt: string
  updatedAt: string
}

export interface TaxObligation {
  id?: number
  ipId: number
  type: 'usn_advance' | 'usn_annual' | 'ip_premium_fixed' | 'ip_premium_additional' | 'notification'
  period: string
  amount: string
  dueDate: string
  internalDeadline: string | null
  status: ObligationStatus
  paidAmount: string
  paidDate: string | null
  paymentComment: string
  calculationSnapshotId: number | null
  notificationDueDate?: string | null
  availableReduction?: string
  usedReduction?: string
  trace?: string | null
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id?: number
  ipId: number
  /** Legacy direct relation. New records use PaymentAllocation. */
  obligationId: number | null
  date: string
  amount: string
  description: string
  kind?: TaxPaymentKind
  period?: string | null
  documentNumber?: string
  comment?: string
  source?: 'manual' | 'transaction' | 'opening'
  sourceTransactionId?: number | null
  createdAt: string
  updatedAt?: string
}

export interface PaymentAllocation {
  id?: number
  ipId: number
  paymentId: number
  obligationId: number
  amount: string
  createdAt: string
}

export interface CalculationSnapshot {
  id?: number
  ipId: number
  type: string
  period: string
  ruleSetVersion: string
  inputs: string // JSON
  result: string // JSON
  trace: string // JSON: CalculationTrace
  createdAt: string
}

export interface CalculationTrace {
  period: string
  calculationDate: string
  ruleSetVersion: string
  steps: CalculationStep[]
  warnings: string[]
  excludedTransactions: number[]
  rounding: string
  normativeSource: string
  normativeDate: string
}

export interface CalculationStep {
  label: string
  detail: string
  amount: string
  links?: { type: string; id: number; label: string }[]
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
  obligationId: number | null
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

// Tax regime versioning
export interface TaxRegimeVersion {
  id?: number
  ipId: number
  regime: UsnObject
  rate: number
  effectiveFrom: string
  effectiveTo: string | null
  createdAt: string
}

// Rule set for a given year
export interface RuleSet {
  year: number
  version: string
  fixedPremium: number
  additionalPremiumThreshold: number
  additionalPremiumRate: number
  additionalPremiumMax: number
  usnIncomeLimit: number
  usnAssetLimit: number
  ndsThreshold: number
  ndsMainRate: number
  effectiveFrom: string
  holidays: { date: string; name: string }[]
}
