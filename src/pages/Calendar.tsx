import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { calendarRepo } from '@/db/repositories/calendarRepo'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { generateCalendarEvents } from '@/engine/calendarEngine'
import { formatDate, formatMonth, getDaysUntil } from '@/engine/dateUtils'
import type { CalendarEvent } from '@/types'
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CalendarPage() {
  const { currentIp, taxSettings, holidays } = useAppStore()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (currentIp?.id) loadEvents()
  }, [currentIp, selectedMonth])

  const loadEvents = async () => {
    if (!currentIp?.id) return
    const evts = await calendarRepo.getByMonth(currentIp.id, selectedMonth)
    setEvents(evts.sort((a, b) => a.date.localeCompare(b.date)))
  }

  const generateEvents = async () => {
    if (!currentIp?.id || !taxSettings) return
    const newEvents = await generateCalendarEvents(currentIp.id, taxSettings, holidays)
    await calendarRepo.clearForIp(currentIp.id)
    await calendarRepo.addBatch(newEvents)
    loadEvents()
  }

  const handleMarkPaid = async (event: CalendarEvent) => {
    if (!event.id) return
    await calendarRepo.update(event.id, { status: 'paid', comment })
    setSelectedEvent(null)
    loadEvents()
  }

  const handlePostpone = async (event: CalendarEvent) => {
    if (!event.id) return
    const newDate = new Date(event.date)
    newDate.setDate(newDate.getDate() + 7)
    await calendarRepo.update(event.id, {
      date: newDate.toISOString().split('T')[0],
      comment,
    })
    setSelectedEvent(null)
    loadEvents()
  }

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]

  const prevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    setSelectedMonth(prev)
  }

  const nextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    setSelectedMonth(next)
  }

  const paymentEvents = events.filter(e => e.type === 'payment')
  const notificationEvents = events.filter(e => e.type === 'notification')
  const reportEvents = events.filter(e => e.type === 'report')

  if (!currentIp) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Календарь</h1>
        <Button variant="outline" size="sm" onClick={generateEvents}>
          <RefreshCw className="w-4 h-4 mr-1" /> Сгенерировать события
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-medium min-w-[200px] text-center">
          {monthNames[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
        </h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Платежи ({paymentEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paymentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет платежей</p>
            ) : paymentEvents.map(evt => (
              <div
                key={evt.id}
                className="p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => { setSelectedEvent(evt); setComment(evt.comment) }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{evt.title}</span>
                  <StatusBadge status={evt.status} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{formatDate(evt.date)}</span>
                  {evt.amount && <MoneyDisplay amount={evt.amount} size="sm" />}
                </div>
                {evt.internalDeadline && (
                  <span className="text-xs text-amber-600">
                    Внутренний дедлайн: {formatDate(evt.internalDeadline)}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              Уведомления ({notificationEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notificationEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет уведомлений</p>
            ) : notificationEvents.map(evt => (
              <div
                key={evt.id}
                className="p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => { setSelectedEvent(evt); setComment(evt.comment) }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{evt.title}</span>
                  <StatusBadge status={evt.status} />
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(evt.date)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              Отчёты ({reportEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reportEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет отчётов</p>
            ) : reportEvents.map(evt => (
              <div
                key={evt.id}
                className="p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => { setSelectedEvent(evt); setComment(evt.comment) }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{evt.title}</span>
                  <StatusBadge status={evt.status} />
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(evt.date)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Дата</p>
                  <p className="font-medium">{formatDate(selectedEvent.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Статус</p>
                  <StatusBadge status={selectedEvent.status} />
                </div>
                {selectedEvent.amount && (
                  <div>
                    <p className="text-muted-foreground">Сумма</p>
                    <MoneyDisplay amount={selectedEvent.amount} />
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Тип</p>
                  <Badge variant="outline">{selectedEvent.type}</Badge>
                </div>
              </div>
              {selectedEvent.internalDeadline && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">
                  Внутренний дедлайн: {formatDate(selectedEvent.internalDeadline)}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Комментарий</p>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                />
              </div>
              <div className="flex gap-2">
                {selectedEvent.status !== 'paid' && (
                  <Button onClick={() => handleMarkPaid(selectedEvent)} className="flex-1">
                    Отметить выполнено
                  </Button>
                )}
                <Button variant="outline" onClick={() => handlePostpone(selectedEvent)} className="flex-1">
                  Перенести на 7 дней
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
