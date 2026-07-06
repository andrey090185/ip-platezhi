import { d, dMul, dToString } from './decimal'

export interface TraumaResult {
  salary: string
  rate: string
  amount: string
  dueDate: string
  formula: string
}

export function calcTrauma(salary: string, rate: number, dueDate: string): TraumaResult {
  const amount = dMul(salary, d(rate).div(100))

  return {
    salary,
    rate: `${rate}%`,
    amount: dToString(amount),
    dueDate,
    formula: `Оклад: ${salary} ₽ × ${rate}% = ${dToString(amount)} ₽.`,
  }
}
