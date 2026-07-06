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

  pushEvent(y + '-04-28', 'payment', 'USN Q1 advance', 'USN Q1 advance payment', null, y + '-Q1')
  pushEvent(y + '-07-28', 'payment', 'USN H1 advance', 'USN H1 advance payment', null, y + '-Q2')
  pushEvent(y + '-10-28', 'payment', 'USN Q3 advance', 'USN Q3 advance payment', null, y + '-Q3')
  pushEvent(y1 + '-04-28', 'payment', 'USN annual payment', 'USN annual tax payment', null, y + '-annual')

  pushEvent(y1 + '-04-25', 'report', 'USN declaration', 'Submit USN declaration for the year', null, y + '-annual')

  pushEvent(y + '-12-28', 'payment', 'Fixed insurance premiums', 'Fixed insurance premiums for the year', String(settings.fixedPremium), y)
  pushEvent(y1 + '-07-01', 'payment', 'Additional 1% premium', 'Additional 1% on income over 300000 RUB', null, y)

  for (let month = 1; month <= 12; month++) {
    const m = String(month).padStart(2, '0')

    pushEvent(y + '-' + m + '-25', 'notification', 'ENS notification ' + m + '.' + y, 'Submit ENS notification')
    pushEvent(y + '-' + m + '-28', 'payment', 'Insurance premiums ' + m + '.' + y, 'Pay employee insurance premiums')

    pushEvent(y + '-' + m + '-25', 'notification', 'NDFL notification (1-22) ' + m + '.' + y, 'NDFL notification for period 1-22')
    pushEvent(y + '-' + m + '-28', 'payment', 'NDFL payment (1-22) ' + m + '.' + y, 'NDFL payment for period 1-22')

    if (month < 12) {
      const nextMonth = String(month + 1).padStart(2, '0')
      pushEvent(y + '-' + nextMonth + '-03', 'notification', 'NDFL notification (23-end) ' + m + '.' + y, 'NDFL notification for period 23-end of month')
      pushEvent(y + '-' + nextMonth + '-05', 'payment', 'NDFL payment (23-end) ' + m + '.' + y, 'NDFL payment for period 23-end of month')
    } else {
      pushEvent(y1 + '-01-05', 'notification', 'NDFL notification (23-end) 12.' + y, 'NDFL notification for December (23-31)')
      pushEvent(y1 + '-01-09', 'payment', 'NDFL payment (23-end) 12.' + y, 'NDFL payment for December (23-31)')
    }

    pushEvent(y + '-' + m + '-15', 'payment', 'Trauma insurance ' + m + '.' + y, 'Pay trauma insurance premiums')
  }

  const quarterReports = [
    { q: 1, name: '6-NDFL', due: y + '-04-25', dest: 'FNS' },
    { q: 1, name: 'RSV', due: y + '-04-25', dest: 'FNS' },
    { q: 2, name: '6-NDFL', due: y + '-07-25', dest: 'FNS' },
    { q: 2, name: 'RSV', due: y + '-07-25', dest: 'FNS' },
    { q: 3, name: '6-NDFL', due: y + '-10-25', dest: 'FNS' },
    { q: 3, name: 'RSV', due: y + '-10-25', dest: 'FNS' },
    { q: 4, name: '6-NDFL', due: y1 + '-02-25', dest: 'FNS' },
    { q: 4, name: 'RSV', due: y1 + '-02-25', dest: 'FNS' },
  ]

  for (const r of quarterReports) {
    pushEvent(r.due, 'report', r.name + ' Q' + r.q, 'Submit ' + r.name + ' (' + r.dest + ')')
  }

  return events
}
