import type { TaxObligation } from '@/types'

export function taxYearFromPeriod(period?: string | null): number | null {
  const match = period?.match(/^\d{4}/)?.[0]
  return match ? Number(match) : null
}

export function formatTaxPeriod(period: string, taxYear?: number | null): string {
  const year = taxYear ?? taxYearFromPeriod(period)
  if (!year) return period
  const suffix = period.replace(/^\d{4}-?/, '').toLowerCase()
  const labels: Record<string, string> = {
    q1: `1 квартал ${year}`,
    h1: `полугодие ${year}`,
    m9: `9 месяцев ${year}`,
    year: `${year} год`,
    annual: `${year} год`,
    fixed: `за ${year} год`,
    additional: `за ${year} год`,
    opening: `начальные данные ${year}`,
  }
  return labels[suffix] ?? period
}

export function formatObligationPeriod(obligation: TaxObligation): string {
  return formatTaxPeriod(obligation.period, obligation.taxYear)
}
