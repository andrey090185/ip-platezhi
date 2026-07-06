import type { TaxSettings } from '@/types'

export const DEFAULT_TAX_SETTINGS: Omit<TaxSettings, 'id' | 'ipId' | 'createdAt' | 'updatedAt'> = {
  year: 2026,
  usnRateIncome: 6,
  usnRateIncomeMinusExpenses: 15,
  usnRegionalRate: 0,
  usnMinTaxRate: 1,
  usnIncomeLimit: 490500000,
  usnEmployeeLimit: 130,
  usnAssetLimit: 218000000,
  fixedPremium: 57390,
  additionalPremiumThreshold: 300000,
  additionalPremiumRate: 1,
  additionalPremiumMax: 321818,
  considerAdditionalInCurrentYear: false,
  insuranceBaseThreshold: 2979000,
  insuranceMainRate: 30,
  insuranceExcessRate: 15.1,
  traumaRate: 0.2,
  ndsThreshold: 20000000,
  ndsMode: 'standard',
  reducedTariffEnabled: false,
  reducedTariffRates: {},
}

export function getEffectiveRate(settings: TaxSettings, usnObject: 'income' | 'income_minus_expenses' = 'income'): number {
  const base = usnObject === 'income'
    ? settings.usnRateIncome
    : settings.usnRateIncomeMinusExpenses
  return base + settings.usnRegionalRate
}

export function getUsnDueDate(quarter: number, year: number): string {
  const dates: Record<number, string> = {
    1: `${year}-04-28`,
    2: `${year}-07-28`,
    3: `${year}-10-28`,
    4: `${year + 1}-04-28`,
  }
  return dates[quarter]
}

export function getUsnDeclarationDueDate(year: number): string {
  return `${year + 1}-04-25`
}

export function getInsurancePremiumDueDate(month: number, year: number): string {
  if (month === 12) return `${year}-12-28`
  return `${year}-${String(month + 1).padStart(2, '0')}-28`
}

export function getFixedPremiumDueDate(year: number): string {
  return `${year}-12-28`
}

export function getAdditionalPremiumDueDate(year: number): string {
  return `${year + 1}-07-01`
}

export function getNdfNotificationDueDate(periodStart: number, month: number, year: number): string {
  if (periodStart === 1) return `${year}-${String(month).padStart(2, '0')}-25`
  if (periodStart === 23) return `${year}-${String(month + 1).padStart(2, '0')}-03`
  return `${year + 1}-01-05`
}

export function getNdfPaymentDueDate(periodStart: number, month: number, year: number): string {
  if (periodStart === 1) return `${year}-${String(month).padStart(2, '0')}-28`
  if (periodStart === 23) return `${year}-${String(month + 1).padStart(2, '0')}-05`
  return `${year + 1}-01-09`
}

export function getReportPeriod(quarter: number): string {
  const periods: Record<number, string> = {
    1: '1 квартал',
    2: 'полугодие',
    3: '9 месяцев',
    4: 'год',
  }
  return periods[quarter]
}
