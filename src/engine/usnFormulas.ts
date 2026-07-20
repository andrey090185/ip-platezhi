import type { TaxSettings, UsnObject } from '@/types'
import { d, dMul, dMax, dMin, dToString, dSum } from './decimal'
import { getEffectiveRate, getUsnDueDate } from './taxRules'

export interface UsnCalculationResult {
  base: string
  rate: string
  taxBeforeReduction: string
  availableReduction: string
  reductionLimit: string
  reduction: string
  taxAfterReduction: string
  previouslyPaid: string
  dueAmount: string
  dueDate: string
  formula: string
  isMinimumTax: boolean
  minimumTaxAmount: string | null
}

export function calcUsnAdvance(
  settings: TaxSettings,
  incomeYtd: string,
  expensesYtd: string,
  insurancePremiumsPaidYtd: string,
  employeeInsurancePaidYtd: string,
  previouslyPaidUsn: string,
  quarter: number,
  hasEmployees: boolean,
  usnObject: UsnObject = 'income'
): UsnCalculationResult {
  const rate = getEffectiveRate(settings, usnObject)
  const rateDecimal = d(rate).div(100)

  if (usnObject === 'income') {
    const taxBeforeReduction = dMul(incomeYtd, rateDecimal)
    const availableReduction = dSum(insurancePremiumsPaidYtd, employeeInsurancePaidYtd)

    let reductionLimit: ReturnType<typeof d>
    if (hasEmployees) {
      reductionLimit = dMul(taxBeforeReduction, 0.5)
    } else {
      reductionLimit = taxBeforeReduction
    }

    const reduction = dMin(availableReduction, reductionLimit)
    const taxAfterReduction = dMax(d(0), taxBeforeReduction.minus(reduction))
    const previouslyPaid = d(previouslyPaidUsn)
    const dueAmount = dMax(d(0), taxAfterReduction.minus(previouslyPaid))

    return {
      base: incomeYtd,
      rate: `${rate}%`,
      taxBeforeReduction: dToString(taxBeforeReduction),
      availableReduction: dToString(availableReduction),
      reductionLimit: dToString(reductionLimit),
      reduction: dToString(reduction),
      taxAfterReduction: dToString(taxAfterReduction),
      previouslyPaid: dToString(previouslyPaid),
      dueAmount: dToString(dueAmount),
      dueDate: getUsnDueDate(quarter, settings.year),
      formula: `Налог = ${incomeYtd} × ${rate}% = ${dToString(taxBeforeReduction)}. Уменьшение = min(${dToString(availableReduction)}, ${dToString(reductionLimit)}) = ${dToString(reduction)}. К уплате = ${dToString(taxAfterReduction)} - ${dToString(previouslyPaid)} = ${dToString(dueAmount)}`,
      isMinimumTax: false,
      minimumTaxAmount: null,
    }
  } else {
    const base = d(incomeYtd).minus(d(expensesYtd))
    const taxBeforeReduction = base.gt(0) ? dMul(base, rateDecimal) : d(0)

    const previouslyPaid = d(previouslyPaidUsn)
    const minimumTax = dMul(incomeYtd, d(settings.usnMinTaxRate).div(100))
    const isMinimumTax = minimumTax.gt(taxBeforeReduction) && base.gt(0)
    const finalTax = isMinimumTax ? minimumTax : taxBeforeReduction
    const finalDue = dMax(d(0), finalTax.minus(previouslyPaid))

    return {
      base: base.toFixed(2),
      rate: `${rate}%`,
      taxBeforeReduction: dToString(taxBeforeReduction),
      availableReduction: '0',
      reductionLimit: '0',
      reduction: '0',
      taxAfterReduction: dToString(finalTax),
      previouslyPaid: dToString(previouslyPaid),
      dueAmount: dToString(finalDue),
      dueDate: getUsnDueDate(quarter, settings.year),
      formula: `База = ${incomeYtd} - ${expensesYtd} = ${base.toFixed(2)}. Налог = ${base.toFixed(2)} × ${rate}% = ${dToString(taxBeforeReduction)}` +
        (isMinimumTax ? `. Минимальный налог = ${incomeYtd} × 1% = ${dToString(minimumTax)} > ${dToString(taxBeforeReduction)}, применяется минимальный.` : ''),
      isMinimumTax,
      minimumTaxAmount: dToString(minimumTax),
    }
  }
}

export function calcUsnAnnual(
  settings: TaxSettings,
  incomeYtd: string,
  expensesYtd: string,
  insurancePremiumsPaidYtd: string,
  employeeInsurancePaidYtd: string,
  previouslyPaidUsn: string,
  hasEmployees: boolean,
  usnObject: UsnObject = 'income'
): UsnCalculationResult {
  return calcUsnAdvance(
    settings, incomeYtd, expensesYtd,
    insurancePremiumsPaidYtd, employeeInsurancePaidYtd,
    previouslyPaidUsn, 4, hasEmployees, usnObject
  )
}
