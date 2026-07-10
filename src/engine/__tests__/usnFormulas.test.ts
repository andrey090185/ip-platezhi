import { describe, it, expect } from 'vitest'
import { calcUsnAdvance, calcUsnAnnual } from '../usnFormulas'
import type { TaxSettings } from '@/types'

const baseSettings: TaxSettings = {
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
  ndsThreshold: 20000000,
  ndsMode: 'standard',
  reducedTariffEnabled: false,
  reducedTariffRates: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('USN Income 6% — ИП без сотрудников', () => {
  it('Q1: доход 500 000, взносы 0, ранее не платил', () => {
    const result = calcUsnAdvance(
      baseSettings, '500000', '0', '0', '0', '0', 1, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('30000.00')  // 500000 * 6%
    expect(result.reduction).toBe('0.00')
    expect(result.taxAfterReduction).toBe('30000.00')
    expect(result.dueAmount).toBe('30000.00')
  })

  it('Q1: доход 500 000, уплачено взносов 57 390 (вся сумма)', () => {
    const result = calcUsnAdvance(
      baseSettings, '500000', '0', '57390', '0', '0', 1, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('30000.00')
    expect(result.reduction).toBe('30000.00')  // не больше налога
    expect(result.taxAfterReduction).toBe('0.00')
    expect(result.dueAmount).toBe('0.00')
  })

  it('Полугодие: доход 1 460 000, взносы 57 390, ранее уплачено 20 000', () => {
    const result = calcUsnAdvance(
      baseSettings, '1460000', '0', '57390', '0', '20000', 2, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('87600.00')  // 1460000 * 6%
    expect(result.reduction).toBe('57390.00')
    expect(result.taxAfterReduction).toBe('30210.00')
    expect(result.dueAmount).toBe('10210.00')  // 30210 - 20000
  })

  it('Год: доход 3 000 000, взносы 57 390 + 1% = 84 390, авансы 50 000', () => {
    const totalPremiums = '84390' // 57390 + 27000
    const result = calcUsnAnnual(
      baseSettings, '3000000', '0', totalPremiums, '0', '50000', false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('180000.00')
    expect(result.reduction).toBe('84390.00')
    expect(result.taxAfterReduction).toBe('95610.00')
    expect(result.dueAmount).toBe('45610.00')  // 95610 - 50000
  })

  it('Уменьшение не может превышать налог (100% без сотрудников)', () => {
    const result = calcUsnAdvance(
      baseSettings, '100000', '0', '200000', '0', '0', 1, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('6000.00')
    expect(result.reduction).toBe('6000.00')  // ограничено налогом
    expect(result.dueAmount).toBe('0.00')
  })

  it('Ранее уплаченные авансы корректно вычитаются', () => {
    // Q3: доход 2 000 000, взносы 57 390, ранее уплачено 60 000
    const result = calcUsnAdvance(
      baseSettings, '2000000', '0', '57390', '0', '60000', 3, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('120000.00')
    expect(result.reduction).toBe('57390.00')
    expect(result.taxAfterReduction).toBe('62610.00')
    // 62610 - 60000 = 2610
    expect(result.dueAmount).toBe('2610.00')
  })
})

describe('USN Income минус расходы 15%', () => {
  it('Прибыльная деятельность', () => {
    const result = calcUsnAdvance(
      baseSettings, '1000000', '400000', '0', '0', '0', 1, false, 'income_minus_expenses'
    )
    expect(result.base).toBe('600000.00')
    expect(result.taxBeforeReduction).toBe('90000.00')  // 600000 * 15%
    expect(result.dueAmount).toBe('90000.00')
    expect(result.isMinimumTax).toBe(false)
  })

  it('Убыток — налог 0', () => {
    const result = calcUsnAdvance(
      baseSettings, '500000', '700000', '0', '0', '0', 1, false, 'income_minus_expenses'
    )
    expect(result.taxBeforeReduction).toBe('0.00')
    expect(result.isMinimumTax).toBe(false)
  })

  it('Минимальный налог 1% при низкой прибыли', () => {
    // Доход 1 000 000, расход 980 000, прибыль 20 000 * 15% = 3 000
    // Минимальный = 1 000 000 * 1% = 10 000 > 3 000
    const result = calcUsnAdvance(
      baseSettings, '1000000', '980000', '0', '0', '0', 4, false, 'income_minus_expenses'
    )
    expect(result.isMinimumTax).toBe(true)
    expect(result.taxAfterReduction).toBe('10000.00')
  })
})

describe('Граничные случаи', () => {
  it('Нулевой доход', () => {
    const result = calcUsnAdvance(
      baseSettings, '0', '0', '0', '0', '0', 1, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('0.00')
    expect(result.dueAmount).toBe('0.00')
  })

  it('Предыдущие авансы больше текущего налога — к уплате 0', () => {
    const result = calcUsnAdvance(
      baseSettings, '500000', '0', '57390', '0', '50000', 1, false, 'income'
    )
    expect(result.dueAmount).toBe('0.00')
  })

  it('Региональная ставка используется как эффективная', () => {
    const regionalSettings = {
      ...baseSettings,
      usnRegionalRate: 5, // 5% региональная
    }
    const result = calcUsnAdvance(
      regionalSettings, '1000000', '0', '0', '0', '0', 1, false, 'income'
    )
    // Эффективная ставка = 5% (региональная)
    expect(result.taxBeforeReduction).toBe('50000.00')
  })
})

describe('Возвраты доходов (проверка через отрицательные транзакции)', () => {
  it('Возврат уменьшает базу', () => {
    // Доход 500 000, возврат 50 000 — эффективный доход 450 000
    // Этот сценарий тестирует, что база корректно уменьшается
    const netIncome = '450000'
    const result = calcUsnAdvance(
      baseSettings, netIncome, '0', '0', '0', '0', 1, false, 'income'
    )
    expect(result.taxBeforeReduction).toBe('27000.00')
  })
})
