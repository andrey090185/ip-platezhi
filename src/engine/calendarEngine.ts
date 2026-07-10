import type { TaxSettings, CalendarEvent } from '@/types'
import { shiftToNextWorkingDay, getInternalDeadline, getToday } from './dateUtils'

export async function generateCalendarEvents(
  ipId: number,
  settings: TaxSettings,
  holidays: any[]
): Promise<Omit<CalendarEvent, 'id'>[]> {
  const events: Omit<CalendarEvent, 'id'>[] = []
  const year = settings.year
  const now = getToday()

  const pushEvent = (
    date: string,
    type: CalendarEvent['type'],
    title: string,
    description: string,
    amount: string | null = null,
    period: string | null = null
  ) => {
    const adjustedDate = shiftToNextWorkingDay(date, holidays)
    const internal = getInternalDeadline(adjustedDate, holidays)
    events.push({
      ipId,
      date: adjustedDate,
      type,
      title,
      description,
      amount,
      period,
      obligationId: null,
      internalDeadline: internal,
      status: adjustedDate < now ? 'overdue' : 'planned',
      comment: '',
      createdAt: now,
      updatedAt: now,
    })
  }

  const y = String(year)
  const y1 = String(year + 1)

  // USN advance payments
  pushEvent(y + '-04-28', 'payment', 'Аванс УСН за I квартал', 'Авансовый платёж УСН за I квартал', null, y + '-Q1')
  pushEvent(y + '-07-28', 'payment', 'Аванс УСН за полугодие', 'Авансовый платёж УСН за полугодие', null, y + '-Q2')
  pushEvent(y + '-10-28', 'payment', 'Аванс УСН за 9 месяцев', 'Авансовый платёж УСН за 9 месяцев', null, y + '-Q3')
  pushEvent(y1 + '-04-28', 'payment', 'Годовой платёж УСН', 'Годовой налог УСН за ' + y + ' год', null, y + '-annual')

  // USN declaration
  pushEvent(y1 + '-04-25', 'report', 'Декларация УСН', 'Подать декларацию УСН за ' + y + ' год', null, y + '-annual')

  // Fixed insurance premiums
  pushEvent(y + '-12-28', 'payment', 'Фиксированные взносы ИП', 'Фиксированные страховые взносы ИП за ' + y + ' год', String(settings.fixedPremium), y)
  pushEvent(y1 + '-07-01', 'payment', 'Дополнительный взнос 1%', 'Дополнительный взнос 1% с дохода свыше 300 000 ₽', null, y)

  // ENS notifications (monthly)
  for (let month = 1; month <= 12; month++) {
    const m = String(month).padStart(2, '0')
    pushEvent(y + '-' + m + '-25', 'notification', 'Уведомление ЕНС ' + m + '.' + y, 'Подать уведомление ЕНС за ' + m + '.' + y)
  }

  return events
}
