import { describe, expect, it } from 'vitest'
import { buildUsnPlan, periodsAvailableOnDate } from '../usnPlan'
import type { TaxSettings } from '@/types'

const settings: TaxSettings = {
  id: 1,
  ipId: 1,
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
  considerPreviousYearAdditional: true,
  ndsThreshold: 20000000,
  ndsMode: 'standard',
  reducedTariffEnabled: false,
  reducedTariffRates: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('УСН plan', () => {
  it('subtracts previously calculated advances from the cumulative tax', () => {
    const plan = buildUsnPlan(settings, [
      { code: 'q1', income: '1000000', expenses: '0' },
      { code: 'h1', income: '2000000', expenses: '0' },
    ])
    expect(plan[0].result.dueAmount).toBe('2610.00')
    expect(plan[1].previouslyCalculatedAdvances).toBe('2610.00')
    expect(plan[1].result.dueAmount).toBe('60000.00')
  })

  it('keeps opening accruals separate from actual payments', () => {
    const plan = buildUsnPlan(settings, [
      { code: 'q1', income: '1000000', expenses: '0' },
      { code: 'h1', income: '2000000', expenses: '0' },
    ], '20000')
    expect(plan[0].result.dueAmount).toBe('0.00')
    expect(plan[1].previouslyCalculatedAdvances).toBe('20000.00')
    expect(plan[1].result.dueAmount).toBe('42610.00')
  })

  it('exposes only completed reporting periods in July 2026', () => {
    expect(periodsAvailableOnDate(2026, new Date('2026-07-20T12:00:00Z')).map(item => item.code))
      .toEqual(['q1', 'h1'])
  })

  it('uses the additional 1% for 2025 when reducing USN for 2026', () => {
    const plan = buildUsnPlan(settings, [
      { code: 'q1', income: '2000000', expenses: '0' },
    ], '0', { previousYearAdditional: '20896', ruleSetVersion: '2026.1' })

    expect(plan[0].availableContributionReduction).toBe('78286.00')
    expect(plan[0].result.dueAmount).toBe('41714.00')
    expect(plan[0].trace.steps[2].detail).toContain('за 2025 год')
  })

  it('does not reuse the 2025 contribution when the user disables carry-over', () => {
    const plan = buildUsnPlan(
      { ...settings, considerPreviousYearAdditional: false },
      [{ code: 'q1', income: '2000000', expenses: '0' }],
      '0',
      { previousYearAdditional: '20896' },
    )
    expect(plan[0].availableContributionReduction).toBe('57390.00')
  })
})
