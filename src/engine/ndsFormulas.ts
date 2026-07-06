import { d, dMul, dDiv, dToString } from './decimal'

export interface NdsResult {
  mode: string
  amount: string
  rate: string
  ndsAmount: string
  inputNds: string
  ndsToPay: string
  paymentSchedule: { month: string; amount: string }[]
  formula: string
  warning: string | null
}

export function calcNds(
  mode: 'standard' | 'special_5' | 'special_7',
  amount: string,
  inputNdsAmount: string = '0'
): NdsResult {
  const amt = d(amount)
  let rate: number
  let rateLabel: string

  switch (mode) {
    case 'standard':
      rate = 20
      rateLabel = '20%'
      break
    case 'special_5':
      rate = 5
      rateLabel = '5%'
      break
    case 'special_7':
      rate = 7
      rateLabel = '7%'
      break
  }

  const ndsAmount = dMul(amt, d(rate).div(100 + rate))
  const inputNds = d(inputNdsAmount)
  const ndsToPay = mode === 'standard' ? ndsAmount.minus(inputNds) : ndsAmount
  const perQuarter = dDiv(ndsToPay, 3)

  return {
    mode: mode === 'standard' ? 'Стандартный' : mode === 'special_5' ? 'Специальный 5%' : 'Специальный 7%',
    amount: dToString(amt),
    rate: rateLabel,
    ndsAmount: dToString(ndsAmount),
    inputNds: mode === 'standard' ? dToString(inputNds) : '0',
    ndsToPay: dToString(ndsToPay),
    paymentSchedule: [
      { month: '1 месяц после квартала', amount: dToString(perQuarter) },
      { month: '2 месяц после квартала', amount: dToString(perQuarter) },
      { month: '3 месяц после квартала', amount: dToString(perQuarter) },
    ],
    formula: `Сумма с НДС: ${dToString(amt)}. НДС = ${dToString(amt)} × ${rate}/(100+${rate}) = ${dToString(ndsAmount)}` +
      (mode === 'standard' ? `. Входной НДС: ${dToString(inputNds)}. К уплате: ${dToString(ndsToPay)}.` : `. Входной НДС не учитывается (специальный режим).`),
    warning: 'НДС при УСН — сложный режим. Проверьте расчёт с бухгалтером.',
  }
}
