import type { TaxSettings, RuleSet } from '@/types'

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
  ndsThreshold: 20000000,
  ndsMode: 'standard',
  reducedTariffEnabled: false,
  reducedTariffRates: {},
}

export function getEffectiveRate(settings: TaxSettings, usnObject: 'income' | 'income_minus_expenses' = 'income'): number {
  // Effective rate: regional laws may set a lower or higher rate
  // Regional rate represents the ACTUAL rate, not an addition to base
  if (settings.usnRegionalRate > 0) {
    return settings.usnRegionalRate
  }
  return usnObject === 'income'
    ? settings.usnRateIncome
    : settings.usnRateIncomeMinusExpenses
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

export function getFixedPremiumDueDate(year: number): string {
  return `${year}-12-28`
}

export function getAdditionalPremiumDueDate(year: number): string {
  return `${year + 1}-07-01`
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

// Versioned rule set for 2026
export const RULESET_2026: RuleSet = {
  year: 2026,
  version: '2026.1',
  fixedPremium: 57390,
  additionalPremiumThreshold: 300000,
  additionalPremiumRate: 1,
  additionalPremiumMax: 321818,
  usnIncomeLimit: 490500000,
  usnAssetLimit: 218000000,
  ndsThreshold: 20000000,
  ndsMainRate: 22,
  effectiveFrom: '2026-01-01',
  holidays: [
    { date: '2026-01-01', name: 'Новый год' },
    { date: '2026-01-02', name: 'Новый год' },
    { date: '2026-01-03', name: 'Новый год' },
    { date: '2026-01-04', name: 'Новый год' },
    { date: '2026-01-05', name: 'Новый год' },
    { date: '2026-01-06', name: 'Новый год' },
    { date: '2026-01-07', name: 'Рождество Христово' },
    { date: '2026-01-08', name: 'Новый год' },
    { date: '2026-02-23', name: 'День защитника Отечества' },
    { date: '2026-03-08', name: 'Международный женский день' },
    { date: '2026-05-01', name: 'Праздник Весны и Труда' },
    { date: '2026-05-09', name: 'День Победы' },
    { date: '2026-06-12', name: 'День России' },
    { date: '2026-11-04', name: 'День народного единства' },
  ],
}

export function getRuleSet(year: number): RuleSet | null {
  if (year === 2026) return RULESET_2026
  return null
}
