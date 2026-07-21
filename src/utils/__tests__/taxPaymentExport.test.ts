import { describe, expect, it } from 'vitest'
import { buildTaxPaymentCsv } from '../taxPaymentExport'
import type { Payment, PaymentAllocation, TaxObligation } from '@/types'

describe('tax payment CSV export', () => {
  it('exports a payment made in 2026 as the additional contribution for 2025', () => {
    const payment = {
      id: 10,
      ipId: 1,
      obligationId: 20,
      date: '2026-06-20',
      amount: '20896.00',
      description: 'Дополнительный 1%',
      kind: 'additional_premium',
      period: '2025-additional',
      taxYear: 2025,
      documentNumber: '42',
      comment: 'Взнос за 2025 год',
      source: 'manual',
      createdAt: '2026-06-20T10:00:00.000Z',
    } satisfies Payment
    const obligation = {
      id: 20,
      ipId: 1,
      type: 'ip_premium_additional',
      period: '2025-additional',
      taxYear: 2025,
      dueYear: 2026,
      amount: '20896.00',
      dueDate: '2026-07-01',
      internalDeadline: null,
      status: 'paid',
      paidAmount: '20896.00',
      paidDate: '2026-06-20',
      paymentComment: '',
      calculationSnapshotId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-06-20T10:00:00.000Z',
    } satisfies TaxObligation
    const allocation = {
      id: 30,
      ipId: 1,
      paymentId: 10,
      obligationId: 20,
      amount: '20896.00',
      createdAt: '2026-06-20T10:00:00.000Z',
    } satisfies PaymentAllocation

    const csv = buildTaxPaymentCsv([payment], [allocation], [obligation])
    expect(csv).toContain('"Расчётный год"')
    expect(csv).toContain('"2025"')
    expect(csv).toContain('"Дополнительный страховой взнос 1% за 2025 год (2025-additional)"')
    expect(csv).toContain('"2026-07-01"')
    expect(csv).toContain('"0.00"')
  })
})
