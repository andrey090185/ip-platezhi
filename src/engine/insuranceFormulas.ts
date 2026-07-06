import type { TaxSettings } from '@/types'
import { d, dMul, dMax, dMin, dToString } from './decimal'
import { getFixedPremiumDueDate, getAdditionalPremiumDueDate, getInsurancePremiumDueDate } from './taxRules'

export interface FixedPremiumResult {
  annualAmount: string
  quarterlyAmount: string
  dueDate: string
  formula: string
}

export interface AdditionalPremiumResult {
  incomeYtd: string
  threshold: string
  taxableIncome: string
  rate: string
  calculatedAmount: string
  maxAmount: string
  finalAmount: string
  dueDate: string
  formula: string
}

export interface EmployeeInsuranceResult {
  employeeName: string
  incomeYtd: string
  baseThreshold: string
  baseAmount: string
  excessAmount: string
  baseInsurance: string
  excessInsurance: string
  totalInsurance: string
  formula: string
}

export function calcFixedPremium(settings: TaxSettings): FixedPremiumResult {
  const amount = d(settings.fixedPremium)
  const quarterly = amount.div(4)

  return {
    annualAmount: dToString(amount),
    quarterlyAmount: dToString(quarterly),
    dueDate: getFixedPremiumDueDate(settings.year),
    formula: `Фиксированные взносы ИП за ${settings.year} год = ${dToString(amount)} ₽. Ежеквартально: ${dToString(quarterly)} ₽.`,
  }
}

export function calcAdditionalPremium(
  settings: TaxSettings,
  annualIncome: string
): AdditionalPremiumResult {
  const income = d(annualIncome)
  const threshold = d(settings.additionalPremiumThreshold)
  const rate = d(settings.additionalPremiumRate).div(100)
  const max = d(settings.additionalPremiumMax)

  const taxableIncome = dMax(d(0), income.minus(threshold))
  const calculated = dMul(taxableIncome, rate)
  const finalAmount = dMin(calculated, max)

  return {
    incomeYtd: dToString(income),
    threshold: dToString(threshold),
    taxableIncome: dToString(taxableIncome),
    rate: `${settings.additionalPremiumRate}%`,
    calculatedAmount: dToString(calculated),
    maxAmount: dToString(max),
    finalAmount: dToString(finalAmount),
    dueDate: getAdditionalPremiumDueDate(settings.year),
    formula: `Доход ИП: ${dToString(income)}. Порог: ${dToString(threshold)}. Облагаемый доход: ${dToString(taxableIncome)}. Взнос: ${dToString(taxableIncome)} × ${settings.additionalPremiumRate}% = ${dToString(calculated)}. Максимум: ${dToString(max)}. Итого: ${dToString(finalAmount)}.`,
  }
}

export function calcEmployeeInsurance(
  settings: TaxSettings,
  employeeName: string,
  ytdIncome: string
): EmployeeInsuranceResult {
  const income = d(ytdIncome)
  const threshold = d(settings.insuranceBaseThreshold)
  const mainRate = d(settings.insuranceMainRate).div(100)
  const excessRate = d(settings.insuranceExcessRate).div(100)

  const baseAmount = dMin(income, threshold)
  const excessAmount = dMax(d(0), income.minus(threshold))

  const baseInsurance = dMul(baseAmount, mainRate)
  const excessInsurance = dMul(excessAmount, excessRate)
  const total = baseInsurance.plus(excessInsurance)

  return {
    employeeName,
    incomeYtd: dToString(income),
    baseThreshold: dToString(threshold),
    baseAmount: dToString(baseAmount),
    excessAmount: dToString(excessAmount),
    baseInsurance: dToString(baseInsurance),
    excessInsurance: dToString(excessInsurance),
    totalInsurance: dToString(total),
    formula: `Доход: ${dToString(income)}. База: ${dToString(baseAmount)} × ${settings.insuranceMainRate}% = ${dToString(baseInsurance)}. Сверх базы: ${dToString(excessAmount)} × ${settings.insuranceExcessRate}% = ${dToString(excessInsurance)}. Итого: ${dToString(total)}.`,
  }
}

export function getInsuranceDueDate(month: number, year: number): string {
  return getInsurancePremiumDueDate(month, year)
}
