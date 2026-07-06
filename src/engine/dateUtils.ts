import type { Holiday } from '@/types'
import { addDays, isWeekend, format, parseISO } from 'date-fns'

export function isHoliday(date: string, holidays: Holiday[]): boolean {
  return holidays.some(h => h.date === date)
}

export function isWorkingDay(date: string, holidays: Holiday[]): boolean {
  const d = parseISO(date)
  return !isWeekend(d) && !isHoliday(date, holidays)
}

export function shiftToNextWorkingDay(dateStr: string, holidays: Holiday[]): string {
  let date = parseISO(dateStr)
  let result = format(date, 'yyyy-MM-dd')
  let attempts = 0

  while (!isWorkingDay(result, holidays) && attempts < 30) {
    date = addDays(date, 1)
    result = format(date, 'yyyy-MM-dd')
    attempts++
  }

  return result
}

export function getInternalDeadline(dateStr: string, holidays: Holiday[], daysBefore = 3): string {
  let date = parseISO(dateStr)
  let result = format(date, 'yyyy-MM-dd')
  let workingDaysCount = 0

  while (workingDaysCount < daysBefore) {
    date = addDays(date, -1)
    result = format(date, 'yyyy-MM-dd')
    if (isWorkingDay(result, holidays)) {
      workingDaysCount++
    }
  }

  return result
}

export function getMonthsInRange(from: string, to: string): string[] {
  const months: string[] = []
  const start = parseISO(from)
  const end = parseISO(to)
  let current = new Date(start.getFullYear(), start.getMonth(), 1)

  while (current <= end) {
    months.push(format(current, 'yyyy-MM'))
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }

  return months
}

export function getQuarterFromDate(dateStr: string): number {
  const month = parseInt(dateStr.split('-')[1])
  return Math.ceil(month / 3)
}

export function getMonthFromDate(dateStr: string): number {
  return parseInt(dateStr.split('-')[1])
}

export function getYearFromDate(dateStr: string): number {
  return parseInt(dateStr.split('-')[0])
}

export function formatDate(dateStr: string): string {
  const d = parseISO(dateStr)
  return format(d, 'dd.MM.yyyy')
}

export function formatMonth(dateStr: string): string {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]
  const month = parseInt(dateStr.split('-')[1]) - 1
  return `${months[month]} ${dateStr.split('-')[0]}`
}

export function getCurrentPeriod(): string {
  const now = new Date()
  return format(now, 'yyyy-MM')
}

export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function getDaysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = parseISO(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
