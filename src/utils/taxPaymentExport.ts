import { d, dMax } from '@/engine/decimal'
import type { Payment, PaymentAllocation, TaxObligation, TaxPaymentKind } from '@/types'
import { taxYearFromPeriod } from './taxPeriods'

const paymentLabels: Record<TaxPaymentKind, string> = {
  usn: 'УСН',
  fixed_premium: 'Фиксированные страховые взносы',
  additional_premium: 'Дополнительный страховой взнос 1%',
  enp: 'ЕНП без распределения',
  other_tax: 'Другой налоговый платёж',
}

const obligationLabels: Record<TaxObligation['type'], string> = {
  usn_advance: 'Аванс УСН',
  usn_annual: 'Годовой налог УСН',
  ip_premium_fixed: 'Фиксированные страховые взносы',
  ip_premium_additional: 'Дополнительный страховой взнос 1%',
  notification: 'Уведомление',
}

function cell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function buildTaxPaymentCsv(
  payments: Payment[],
  allocations: PaymentAllocation[],
  obligations: TaxObligation[],
): string {
  const obligationsById = new Map(obligations.filter(item => item.id).map(item => [item.id!, item]))
  const header = [
    'Дата оплаты',
    'Вид платежа',
    'Расчётный год',
    'Обязательства',
    'Сроки уплаты',
    'Сумма платежа, ₽',
    'Зачтено, ₽',
    'Остаток на ЕНС, ₽',
    'Номер документа',
    'Комментарий',
  ]

  const rows = payments.map(payment => {
    const links = allocations.filter(link => link.paymentId === payment.id)
    const linked = links
      .map(link => obligationsById.get(link.obligationId))
      .filter((item): item is TaxObligation => Boolean(item))
    const allocated = links.reduce((sum, link) => sum.plus(d(link.amount)), d(0))
    const taxYears = [...new Set([
      ...linked.map(item => item.taxYear ?? taxYearFromPeriod(item.period)),
      payment.taxYear ?? taxYearFromPeriod(payment.period),
    ].filter((year): year is number => typeof year === 'number' && Number.isFinite(year)))]
    const linkedLabels = linked.map(item => (
      `${obligationLabels[item.type]} за ${item.taxYear ?? taxYearFromPeriod(item.period) ?? '—'} год (${item.period})`
    ))

    return [
      payment.date,
      paymentLabels[payment.kind ?? 'other_tax'],
      taxYears.sort().join(', '),
      linkedLabels.join(' / ') || 'Не распределено',
      [...new Set(linked.map(item => item.dueDate))].join(', '),
      d(payment.amount).toFixed(2),
      allocated.toFixed(2),
      dMax(d(0), d(payment.amount).minus(allocated)).toFixed(2),
      payment.documentNumber ?? '',
      payment.comment || payment.description,
    ].map(cell).join(';')
  })

  return ['sep=;', header.map(cell).join(';'), ...rows].join('\r\n')
}
