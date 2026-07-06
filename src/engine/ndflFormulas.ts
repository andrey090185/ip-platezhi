import { d, dMul, dMax, dMin, dToString, dSum } from './decimal'
import { getNdfNotificationDueDate, getNdfPaymentDueDate } from './taxRules'

export interface NdflBracket {
  from: number
  to: number | null
  rate: number
}

export const NDFL_BRACKETS: NdflBracket[] = [
  { from: 0, to: 2400000, rate: 13 },
  { from: 2400000, to: 5000000, rate: 15 },
  { from: 5000000, to: 20000000, rate: 18 },
  { from: 20000000, to: 50000000, rate: 20 },
  { from: 50000000, to: null, rate: 22 },
]

export interface NdflCalculationResult {
  employeeName: string
  periodIncome: string
  ytdIncome: string
  deductions: string
  taxableIncome: string
  ndflAmount: string
  effectiveRate: string
  appliedBrackets: string
  formula: string
  periodStart: number
  periodEnd: number
}

export function calcNdflForPeriod(
  employeeName: string,
  periodIncome: string,
  ytdIncomeBeforePeriod: string,
  deductions: string,
  periodStart: number,
  periodEnd: number
): NdflCalculationResult {
  const income = d(periodIncome)
  const ytdBefore = d(ytdIncomeBeforePeriod)
  const deduct = d(deductions)
  const ytdAfter = ytdBefore.plus(income)
  const taxableIncome = dMax(d(0), income.minus(deductions))

  let ndfl = d(0)
  let appliedBrackets = ''

  let prevLimit = d(0)
  for (const bracket of NDFL_BRACKETS) {
    const bracketFrom = d(bracket.from)
    const bracketTo = bracket.to !== null ? d(bracket.to) : ytdAfter

    if (ytdBefore.gte(bracketTo)) {
      prevLimit = bracketTo
      continue
    }

    const effectiveFrom = dMax(bracketFrom, ytdBefore)
    const effectiveTo = dMin(ytdAfter, bracketTo)

    if (effectiveFrom.gte(effectiveTo)) {
      prevLimit = bracketTo
      continue
    }

    const bracketIncome = effectiveTo.minus(effectiveFrom)
    const bracketNdfl = dMul(bracketIncome, d(bracket.rate).div(100))
    ndfl = ndfl.plus(bracketNdfl)

    if (appliedBrackets) appliedBrackets += ', '
    appliedBrackets += `${bracket.rate}% с ${dToString(effectiveFrom)} до ${dToString(effectiveTo)} = ${dToString(bracketNdfl)}`

    prevLimit = bracketTo
  }

  const effectiveRate = income.gt(0) ? dMul(ndfl.div(income), 100).toFixed(1) : '0'

  return {
    employeeName,
    periodIncome: dToString(income),
    ytdIncome: dToString(ytdAfter),
    deductions: dToString(deduct),
    taxableIncome: dToString(taxableIncome),
    ndflAmount: dToString(ndfl),
    effectiveRate: `${effectiveRate}%`,
    appliedBrackets,
    formula: `Доход за период: ${dToString(income)}. Нарастающий итог: ${dToString(ytdAfter)}. Вычеты: ${dToString(deduct)}. НДФЛ: ${appliedBrackets || '0'}.`,
    periodStart,
    periodEnd,
  }
}

export function getNdflNotificationDate(periodStart: number, month: number, year: number): string {
  return getNdfNotificationDueDate(periodStart, month, year)
}

export function getNdflPaymentDate(periodStart: number, month: number, year: number): string {
  return getNdfPaymentDueDate(periodStart, month, year)
}

export function splitPeriod(month: number, year: number) {
  return {
    firstHalf: { start: 1, end: 22, label: '1–22 число' },
    secondHalf: { start: 23, end: 31, label: '23–конец месяца' },
  }
}
