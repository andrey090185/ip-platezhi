import type { TaxSettings } from '@/types'
import { d, dMul, dMax, dMin, dToString } from './decimal'
import { getFixedPremiumDueDate, getAdditionalPremiumDueDate } from './taxRules'

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
