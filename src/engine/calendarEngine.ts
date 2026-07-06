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
      taxCalcId: null,
      reportName: null,
      internalDeadline: internal,
      status: adjustedDate < now ? 'overdue' : 'planned',
      comment: '',
      createdAt: now,
      updatedAt: now,
    })
  }

  const y = String(year)
  const y1 = String(year + 1)

  pushEvent(y + '-04-28', 'payment', 'Аванс УСН за 1 квартал', 'Авансовый платёж по УСН за 1 квартал', null, y + '-Q1')
  pushEvent(y + '-07-28', 'payment', 'Аванс УСН за полугодие', 'Авансовый платёж по УСН за полугодие', null, y + '-Q2')
  pushEvent(y + '-10-28', 'payment', 'Аванс УСН за 9 месяцев', 'Авансовый платёж по УСН за 9 месяцев', null, y + '-Q3')
  pushEvent(y1 + '-04-28', 'payment', 'Годовой налог УСН', 'Итоговый платёж по УСН за год', null, y + '-annual')

  pushEvent(y1 + '-04-25', 'report', 'Декларация УСН', 'Сдать декларацию по УСН за год', null, y + '-annual')

  pushEvent(y + '-12-28', 'payment', 'Фиксированные взносы ИП', 'Фиксированные страховые взносы ИП за год', String(settings.fixedPremium), y)
  pushEvent(y1 + '-07-01', 'payment', 'Дополнительный взнос 1%', 'Дополнительный взнос 1% с дохода свыше 300 000 ₽', null, y)

  for (let month = 1; month <= 12; month++) {
    const m = String(month).padStart(2, '0')

    pushEvent(y + '-' + m + '-25', 'notification', 'Уведомление ЕНС ' + m + '.' + y, 'Подать уведомление по ЕНС')
    pushEvent(y + '-' + m + '-28', 'payment', 'Страховые взносы за сотрудников ' + m + '.' + y, 'Уплата страховых взносов за сотрудников')

    pushEvent(y + '-' + m + '-25', 'notification', 'Уведомление НДФЛ (1–22) ' + m + '.' + y, 'Уведомление по НДФЛ за период с 1 по 22 число')
    pushEvent(y + '-' + m + '-28', 'payment', 'НДФЛ (1–22) ' + m + '.' + y, 'Уплата НДФЛ за период с 1 по 22 число')

    if (month < 12) {
      const nextMonth = String(month + 1).padStart(2, '0')
      pushEvent(y + '-' + nextMonth + '-03', 'notification', 'Уведомление НДФЛ (23–конец мес.) ' + m + '.' + y, 'Уведомление по НДФЛ за период с 23 числа до конца месяца')
      pushEvent(y + '-' + nextMonth + '-05', 'payment', 'НДФЛ (23–конец мес.) ' + m + '.' + y, 'Уплата НДФЛ за период с 23 числа до конца месяца')
    } else {
      pushEvent(y1 + '-01-05', 'notification', 'Уведомление НДФЛ (23–31 дек.) ' + y, 'Уведомление по НДФЛ за период 23–31 декабря')
      pushEvent(y1 + '-01-09', 'payment', 'НДФЛ (23–31 дек.) ' + y, 'Уплата НДФЛ за период 23–31 декабря')
    }

    pushEvent(y + '-' + m + '-15', 'payment', 'Взносы на травматизм ' + m + '.' + y, 'Уплата взносов на травматизм')
  }

  const quarterReports = [
    { q: 1, name: '6-НДФЛ', due: y + '-04-25' },
    { q: 1, name: 'РСВ', due: y + '-04-25' },
    { q: 2, name: '6-НДФЛ', due: y + '-07-25' },
    { q: 2, name: 'РСВ', due: y + '-07-25' },
    { q: 3, name: '6-НДФЛ', due: y + '-10-25' },
    { q: 3, name: 'РСВ', due: y + '-10-25' },
    { q: 4, name: '6-НДФЛ', due: y1 + '-02-25' },
    { q: 4, name: 'РСВ', due: y1 + '-02-25' },
  ]

  for (const r of quarterReports) {
    pushEvent(r.due, 'report', r.name + ' за ' + r.q + ' кв. ' + y, 'Сдать ' + r.name + ' в ФНС')
  }

  return events
}
