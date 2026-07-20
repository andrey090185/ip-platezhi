import { describe, expect, it } from 'vitest'
import { rowsToTransactions, transactionFingerprint, parseImportDate } from '../importService'
import { parseCSV } from '../csv'
import { excelRowsToRecords } from '../excel'

describe('safe statement import', () => {
  it('does not replace a missing date with today', () => {
    const result = rowsToTransactions([{ Сумма: '1000', Тип: 'Доход' }], 1)
    expect(result.transactions).toHaveLength(0)
    expect(result.errors[0].message).toContain('строка пропущена')
  })

  it('sends an unknown positive operation to review and excludes it from USN', () => {
    const result = rowsToTransactions([{ Дата: '20.07.2026', Сумма: '1000', Операция: 'Прочее' }], 1)
    expect(result.transactions[0].status).toBe('needs_review')
    expect(result.transactions[0].usnRelevant).toBe(false)
  })

  it('understands separate debit and credit columns', () => {
    const debit = rowsToTransactions([{ Дата: '20.07.2026', Дебет: '2500', Кредит: '' }], 1)
    const credit = rowsToTransactions([{ Дата: '20.07.2026', Дебет: '', Кредит: '4500' }], 1)
    expect(debit.transactions[0].type).toBe('expense')
    expect(debit.transactions[0].amount).toBe('2500.00')
    expect(credit.transactions[0].type).toBe('income')
    expect(credit.transactions[0].amount).toBe('4500.00')
  })

  it('creates a stable fingerprint for duplicate detection', () => {
    const input = {
      ipId: 1,
      date: '2026-07-20',
      type: 'income' as const,
      amount: '1000.00',
      counterparty: 'ООО Ромашка',
      comment: 'Оплата услуг',
    }
    expect(transactionFingerprint(input)).toBe(transactionFingerprint({ ...input }))
  })

  it('finds a CSV header after bank metadata rows', () => {
    const rows = parseCSV([
      'Банковская выписка по расчётному счёту',
      'Период: 01.07.2026–31.07.2026',
      'Дата операции;Сумма операции;Тип операции;Назначение платежа',
      '20.07.2026;1 250,50;Доход;Оплата по договору',
    ].join('\n'))
    const result = rowsToTransactions(rows, 1)

    expect(result.errors).toHaveLength(0)
    expect(result.transactions[0]).toMatchObject({
      date: '2026-07-20',
      amount: '1250.50',
      type: 'income',
      comment: 'Оплата по договору',
    })
  })

  it('keeps Excel column indexes when a header cell is empty', () => {
    const rows = excelRowsToRecords([
      ['Выписка'],
      ['Дата операции', '', 'Сумма операции', 'Тип операции'],
      ['20.07.2026', 'служебное поле', 1250, 'Доход'],
    ])
    const result = rowsToTransactions(rows, 1)

    expect(result.transactions[0].amount).toBe('1250.00')
    expect(result.transactions[0].type).toBe('income')
  })

  it('understands date-time values and Excel serial dates', () => {
    expect(parseImportDate('20.07.2026 15:30:00')).toBe('2026-07-20')
    expect(parseImportDate('2026-07-20T15:30:00')).toBe('2026-07-20')
    expect(parseImportDate('46223')).toBe('2026-07-20')
    expect(parseImportDate('31.02.2026')).toBeNull()
  })
})
