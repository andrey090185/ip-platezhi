import { calcAdditionalPremium } from './insuranceFormulas'
import { calcUsnAdvance, type UsnCalculationResult } from './usnFormulas'
import { d } from './decimal'
import type { CalculationTrace, TaxSettings } from '@/types'

export const REPORTING_PERIODS = [
  { code: 'q1', label: '1 квартал', quarter: 1, throughMonth: 3 },
  { code: 'h1', label: 'Полугодие', quarter: 2, throughMonth: 6 },
  { code: 'm9', label: '9 месяцев', quarter: 3, throughMonth: 9 },
  { code: 'year', label: 'Год', quarter: 4, throughMonth: 12 },
] as const

export type ReportingPeriodCode = typeof REPORTING_PERIODS[number]['code']

export interface PeriodLedgerInput {
  code: ReportingPeriodCode
  income: string
  expenses: string
  excludedTransactionIds?: number[]
}

export interface UsnPlanPeriod {
  code: ReportingPeriodCode
  label: string
  quarter: number
  result: UsnCalculationResult
  availableContributionReduction: string
  previouslyCalculatedAdvances: string
  trace: CalculationTrace
}

export function buildUsnPlan(
  settings: TaxSettings,
  inputs: PeriodLedgerInput[],
  openingCalculatedAdvances = '0',
): UsnPlanPeriod[] {
  let previousAdvances = d(openingCalculatedAdvances)

  return inputs.map(input => {
    const period = REPORTING_PERIODS.find(item => item.code === input.code)
    if (!period) throw new Error(`Неизвестный период: ${input.code}`)

    const additional = settings.considerAdditionalInCurrentYear
      ? calcAdditionalPremium(settings, input.income).finalAmount
      : '0'
    const availableReduction = d(settings.fixedPremium).plus(d(additional)).toFixed(2)
    const result = calcUsnAdvance(
      settings,
      input.income,
      input.expenses,
      availableReduction,
      '0',
      previousAdvances.toFixed(2),
      period.quarter,
      false,
      'income',
    )

    const trace: CalculationTrace = {
      period: `${settings.year}-${period.code}`,
      calculationDate: new Date().toISOString(),
      ruleSetVersion: '2026.1',
      steps: [
        { label: 'Доход нарастающим итогом', detail: `Период: ${period.label}`, amount: input.income },
        { label: 'Налог до уменьшения', detail: `${input.income} × ${result.rate}`, amount: result.taxBeforeReduction },
        { label: 'Доступное уменьшение', detail: 'Фиксированные взносы' + (settings.considerAdditionalInCurrentYear ? ' и дополнительный 1%' : ''), amount: result.availableReduction },
        { label: 'Использовано уменьшения', detail: 'Не более суммы исчисленного налога', amount: result.reduction },
        { label: 'Ранее начисленные авансы', detail: 'Именно начисленные, а не фактически оплаченные суммы', amount: result.previouslyPaid },
        { label: 'К начислению за период', detail: 'Неотрицательный результат', amount: result.dueAmount },
      ],
      warnings: input.excludedTransactionIds?.length
        ? [`Исключено операций: ${input.excludedTransactionIds.length}`]
        : [],
      excludedTransactions: input.excludedTransactionIds ?? [],
      rounding: 'Денежные значения рассчитываются Decimal.js и округляются до копеек.',
      normativeSource: 'ФНС России: УСН и уменьшение налога на страховые взносы',
      normativeDate: '2026-07-20',
    }

    const item: UsnPlanPeriod = {
      code: input.code,
      label: period.label,
      quarter: period.quarter,
      result,
      availableContributionReduction: availableReduction,
      previouslyCalculatedAdvances: previousAdvances.toFixed(2),
      trace,
    }
    previousAdvances = previousAdvances.plus(d(result.dueAmount))
    return item
  })
}

export function periodsAvailableOnDate(year: number, today = new Date()): typeof REPORTING_PERIODS[number][] {
  const currentYear = today.getFullYear()
  if (year < currentYear) return [...REPORTING_PERIODS]
  if (year > currentYear) return [REPORTING_PERIODS[0]]
  const month = today.getMonth() + 1
  const completedMonth = month <= 3 ? 3 : month <= 6 ? 3 : month <= 9 ? 6 : 9
  return REPORTING_PERIODS.filter(period => period.throughMonth <= completedMonth)
}

