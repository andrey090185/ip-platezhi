import { describe, expect, it } from 'vitest'
import { calcAdditionalPremium } from '../insuranceFormulas'
import { DEFAULT_TAX_SETTINGS, getRuleSet, settingsForRuleSet } from '../taxRules'
import type { TaxSettings } from '@/types'

const baseSettings = {
  ...DEFAULT_TAX_SETTINGS,
  id: 1,
  ipId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as TaxSettings

describe('additional insurance contribution by tax year', () => {
  it('contains the official 2025 contribution parameters', () => {
    expect(getRuleSet(2025)).toMatchObject({
      fixedPremium: 53658,
      additionalPremiumThreshold: 300000,
      additionalPremiumRate: 1,
      additionalPremiumMax: 300888,
    })
  })

  it('calculates 20,896 rubles from 2,389,600 rubles of 2025 income', () => {
    const result = calcAdditionalPremium(settingsForRuleSet(baseSettings, 2025), '2389600')
    expect(result.taxableIncome).toBe('2089600.00')
    expect(result.finalAmount).toBe('20896.00')
    expect(result.dueDate).toBe('2026-07-01')
  })

  it('applies the 2025 annual maximum', () => {
    const result = calcAdditionalPremium(settingsForRuleSet(baseSettings, 2025), '100000000')
    expect(result.finalAmount).toBe('300888.00')
  })
})
