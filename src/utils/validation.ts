import type { Transaction } from '@/types'

export function validateTransaction(tx: Partial<Transaction>): string[] {
  const errors: string[] = []
  if (!tx.date) errors.push('Дата обязательна')
  if (!tx.type) errors.push('Тип операции обязателен')
  if (!tx.amount || parseFloat(tx.amount) <= 0) {
    if (tx.type === 'income' || tx.type === 'expense') {
      errors.push('Сумма должна быть положительной')
    }
  }
  if (!tx.category) errors.push('Категория обязательна')
  return errors
}

export function validateIpProfile(ip: { name?: string; inn?: string; year?: number }): string[] {
  const errors: string[] = []
  if (!ip.name) errors.push('Название ИП обязательно')
  if (!ip.inn) errors.push('ИНН обязателен')
  if (ip.inn && ip.inn.length !== 12) errors.push('ИНН должен содержать 12 цифр')
  if (!ip.year || ip.year < 2020 || ip.year > 2030) errors.push('Год должен быть от 2020 до 2030')
  return errors
}

export function checkLimits(income: string, settings: { usnIncomeLimit: number; ndsThreshold: number; ndsEnabled: boolean }): string[] {
  const warnings: string[] = []
  const incomeNum = parseFloat(income)
  if (incomeNum > settings.usnIncomeLimit * 0.8) {
    warnings.push(`Доход приближается к лимиту УСН (${settings.usnIncomeLimit.toLocaleString('ru-RU')} ₽)`)
  }
  if (!settings.ndsEnabled && incomeNum > settings.ndsThreshold) {
    warnings.push(`Доход превысил порог освобождения от НДС (${settings.ndsThreshold.toLocaleString('ru-RU')} ₽). Рассмотрите подключение НДС.`)
  }
  return warnings
}
