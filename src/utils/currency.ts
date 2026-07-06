import { d, dFormat, dToString } from '@/engine/decimal'

export function formatCurrency(amount: string | number): string {
  const val = d(amount)
  return dFormat(val) + ' ₽'
}

export function formatCurrencyShort(amount: string | number): string {
  const val = d(amount)
  if (val.abs().gte(1000000)) {
    return dFormat(val.div(1000000)) + ' млн ₽'
  }
  if (val.abs().gte(1000)) {
    return dFormat(val.div(1000)) + ' тыс ₽'
  }
  return dFormat(val) + ' ₽'
}

export function parseCurrencyInput(value: string): string {
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? '0' : num.toFixed(2)
}
