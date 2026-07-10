import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { HowCalculated } from '@/components/shared/HowCalculated'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { calendarRepo } from '@/db/repositories/calendarRepo'
import { generateCalendarEvents } from '@/engine/calendarEngine'
import { calcUsnAdvance } from '@/engine/usnFormulas'
import { calcFixedPremium } from '@/engine/insuranceFormulas'
import { getToday, getDaysUntil, formatDate } from '@/engine/dateUtils'
import { formatCurrency } from '@/utils/currency'
import {
  TrendingUp, AlertTriangle, CalendarDays,
  Wallet, Plus, Loader2, CheckCircle2,
  ArrowRight
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { currentIp, taxSettings, holidays } = useAppStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    totalIncome: '0',
    upcomingPayments: [] as any[],
    overduePayments: [] as any[],
    monthlyData: [] as any[],
    nearestPayment: null as any,
    usnDue: '0',
    usnFormula: '',
    fixedPremiumAnnual: '0',
    warnings: [] as string[],
  })

  useEffect(() => {
    if (!currentIp) {
      navigate('/onboarding')
      return
    }
    loadData()
  }, [currentIp])

  const loadData = async () => {
    if (!currentIp?.id) return
    const ipId = currentIp.id
    const year = currentIp.year

    try {
      const { income } = await transactionRepo.getYearTotals(ipId, year)

      let calendar = await calendarRepo.getAll(ipId)
      if (calendar.length === 0 && taxSettings) {
        const events = await generateCalendarEvents(ipId, taxSettings, holidays)
        await calendarRepo.addBatch(events)
        calendar = await calendarRepo.getAll(ipId)
      }

      const upcoming = await taxCalcRepo.getUpcoming(ipId, 10)
      const overdue = await taxCalcRepo.getOverdue(ipId)

      let usnDue = '0'
      let usnFormula = ''
      let fixedPremiumAnnual = '0'
      if (taxSettings) {
        const quarter = Math.ceil((new Date().getMonth() + 1) / 3)
        const fixedPremiumResult = calcFixedPremium(taxSettings)
        fixedPremiumAnnual = fixedPremiumResult.annualAmount

        const usnResult = calcUsnAdvance(
          taxSettings, income, '0',
          fixedPremiumResult.annualAmount,
          '0',
          '0',
          quarter,
          false,
          currentIp.usnObject
        )
        usnDue = usnResult.dueAmount
        usnFormula = usnResult.formula
      }

      const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
      const monthlyData = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const month = String(i + 1).padStart(2, '0')
          const period = `${year}-${month}`
          const txs = await transactionRepo.getByPeriod(ipId, period)
          const inc = txs.filter(t => t.type === 'income').reduce((a, t) => a + parseFloat(t.amount), 0)
          const ret = txs.filter(t => t.type === 'return_income').reduce((a, t) => a + parseFloat(t.amount), 0)
          return { name: monthNames[i], income: inc - ret }
        })
      )

      const today = getToday()
      const futurePayments = calendar
        .filter(e => e.type === 'payment' && e.date >= today && e.status !== 'paid')
        .sort((a, b) => a.date.localeCompare(b.date))
      const nearestPayment = futurePayments[0] || null

      const warnings: string[] = []
      const incomeNum = parseFloat(income)
      if (taxSettings) {
        if (incomeNum > taxSettings.usnIncomeLimit * 0.8) {
          warnings.push('Доход приближается к лимиту УСН (' + taxSettings.usnIncomeLimit.toLocaleString('ru-RU') + ' ₽)')
        }
        if (!currentIp.ndsEnabled && incomeNum > taxSettings.ndsThreshold) {
          warnings.push('Доход превысил порог освобождения от НДС (' + taxSettings.ndsThreshold.toLocaleString('ru-RU') + ' ₽). Рассмотрите подключение НДС.')
        }
      }

      setData({
        totalIncome: income,
        upcomingPayments: upcoming,
        overduePayments: overdue,
        monthlyData,
        nearestPayment,
        usnDue,
        usnFormula,
        fixedPremiumAnnual,
        warnings,
      })
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkPaid = async (eventId: number) => {
    await calendarRepo.update(eventId, { status: 'paid' })
    loadData()
  }

  if (!currentIp) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Загрузка данных...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Обзор</h1>
          <p className="text-sm text-muted-foreground">
            {currentIp.name} · {currentIp.year} · УСН «{currentIp.usnObject === 'income' ? 'Доходы' : 'Доходы минус расходы'}»
          </p>
        </div>
      </div>

      {data.overduePayments.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              У вас {data.overduePayments.length} просроченных платежей
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Проверьте раздел «Платежи» и отметьте оплаченные
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 self-start sm:self-auto"
            onClick={() => navigate('/taxes')}
          >
            К платежам
          </Button>
        </div>
      )}

      {data.warnings.length > 0 && (
        <div className="space-y-2">
          {data.warnings.map((warning, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Доходы за год
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay amount={data.totalIncome} size="lg" className="text-green-600" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-500" />
              УСН к доплате
              {data.usnFormula && <HowCalculated formula={data.usnFormula} />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay amount={data.usnDue} size="lg" />
            <p className="text-xs text-muted-foreground mt-1">Аванс за текущий квартал</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            data.overduePayments.length > 0
              ? 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800'
              : 'hover:border-primary/50'
          }`}
          onClick={() => navigate('/taxes')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${data.overduePayments.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              Просроченные платежи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overduePayments.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              Фиксированные взносы ИП
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay amount={data.fixedPremiumAnnual} size="lg" />
            <p className="text-xs text-muted-foreground mt-1">
              Годовая сумма · Срок до 28.12.{currentIp.year}
            </p>
          </CardContent>
        </Card>

        {data.nearestPayment && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ближайший платёж</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{data.nearestPayment.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Срок: {formatDate(data.nearestPayment.date)} ({getDaysUntil(data.nearestPayment.date)} дн.)
                  </p>
                  {data.nearestPayment.internalDeadline && (
                    <p className="text-xs text-amber-600">
                      Внутренний дедлайн: {formatDate(data.nearestPayment.internalDeadline)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  {data.nearestPayment.amount && (
                    <MoneyDisplay amount={data.nearestPayment.amount} size="lg" />
                  )}
                  <div className="flex items-center gap-2">
                    <StatusBadge status={data.nearestPayment.status} />
                    {data.nearestPayment.status !== 'paid' && data.nearestPayment.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleMarkPaid(data.nearestPayment.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Оплачено
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Доходы по месяцам</CardTitle>
        </CardHeader>
        <CardContent>
          {data.monthlyData.some(m => m.income > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.monthlyData}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="income" fill="#22c55e" name="Доходы" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Пока нет данных</p>
              <p className="text-xs text-muted-foreground mt-1">Добавьте первый доход</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/income')}>
                Добавить доход <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Button onClick={() => navigate('/income')} className="gap-2">
          <Plus className="w-4 h-4" /> Добавить доход
        </Button>
        <Button onClick={() => navigate('/taxes')} variant="outline" className="gap-2">
          <CalendarDays className="w-4 h-4" /> Платежи
        </Button>
      </div>
    </div>
  )
}
