import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { allocationRepo } from '@/db/repositories/allocationRepo'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { paymentRepo } from '@/db/repositories/paymentRepo'
import { recalculateTaxPlan } from '@/services/taxPlanService'
import { summarizeLedger } from '@/engine/ledger'
import { d, dMax } from '@/engine/decimal'
import { formatDate, getDaysUntil } from '@/engine/dateUtils'
import { formatCurrency } from '@/utils/currency'
import type { TaxObligation } from '@/types'
import {
  AlertTriangle, ArrowRight, CalendarClock, CircleCheck, Loader2, Plus, ReceiptText, ShieldCheck, TrendingUp, Wallet,
} from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const obligationLabels: Record<TaxObligation['type'], string> = {
  usn_advance: 'Аванс УСН',
  usn_annual: 'Годовой УСН',
  ip_premium_fixed: 'Фиксированные взносы',
  ip_premium_additional: 'Дополнительный 1%',
  notification: 'Уведомление',
}

function leftToPay(item: TaxObligation) {
  return dMax(d(0), d(item.amount).minus(d(item.paidAmount)))
}

export default function Dashboard() {
  const { currentIp, taxSettings, holidays } = useAppStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [data, setData] = useState({
    income: '0.00',
    expenses: '0.00',
    taxPayments: '0.00',
    accrued: '0.00',
    paid: '0.00',
    remaining: '0.00',
    nearest: null as TaxObligation | null,
    overdue: 0,
    reviewCount: 0,
    monthly: [] as { name: string; income: number }[],
  })

  const loadData = useCallback(async () => {
    if (!currentIp?.id || !taxSettings) return
    setLoading(true)
    setLoadError('')
    try {
      await recalculateTaxPlan(currentIp, taxSettings, holidays)
      const [transactions, allocations, obligations, payments] = await Promise.all([
        transactionRepo.getAll(currentIp.id),
        allocationRepo.getAll(currentIp.id),
        taxCalcRepo.getAll(currentIp.id),
        paymentRepo.getAll(currentIp.id),
      ])
      const yearTransactions = transactions.filter(item => item.date.startsWith(String(currentIp.year)))
      const summary = summarizeLedger(yearTransactions, allocations)
      const open = obligations
        .filter(item => leftToPay(item).gt(0))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      const monthly = monthNames.map((name, index) => {
        const period = `${currentIp.year}-${String(index + 1).padStart(2, '0')}`
        const monthSummary = summarizeLedger(yearTransactions.filter(item => item.period === period), allocations)
        return { name, income: d(monthSummary.netIncome).toNumber() }
      })

      setData({
        income: summary.netIncome,
        expenses: summary.netExpenses,
        taxPayments: summary.taxPayments,
        accrued: obligations.reduce((sum, item) => sum.plus(d(item.amount)), d(0)).toFixed(2),
        paid: payments.reduce((sum, item) => sum.plus(d(item.amount)), d(0)).toFixed(2),
        remaining: obligations.reduce((sum, item) => sum.plus(leftToPay(item)), d(0)).toFixed(2),
        nearest: open[0] ?? null,
        overdue: open.filter(item => item.dueDate < new Date().toISOString().slice(0, 10)).length,
        reviewCount: yearTransactions.filter(item => item.status === 'needs_review').length,
        monthly,
      })
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Не удалось рассчитать налоговый план.')
    } finally {
      setLoading(false)
    }
  }, [currentIp, holidays, taxSettings])

  useEffect(() => { void loadData() }, [loadData])

  if (!currentIp || !taxSettings) return null
  if (loading) return <div className="min-h-[60vh] grid place-items-center"><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Собираем сводку…</div></div>
  if (loadError) return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow">РАСЧЁТ ПРИОСТАНОВЛЕН</p><h1>{currentIp.name}</h1><p>Операции сохранены, но суммы налогового плана не пересчитывались.</p></div></div>
      <div className="form-error">{loadError}</div>
      <Button variant="outline" onClick={() => navigate('/ips')}>Выбрать профиль 2026 года</Button>
    </div>
  )

  const vatProgress = Math.min(100, d(data.income).div(d(taxSettings.ndsThreshold)).times(100).toNumber())
  const limitProgress = Math.min(100, d(data.income).div(d(taxSettings.usnIncomeLimit)).times(100).toNumber())

  return (
    <div className="page-shell dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">ПОРТФЕЛЬ · {currentIp.year}</p>
          <h1>{currentIp.name}</h1>
          <p>УСН «Доходы» · ставка {taxSettings.usnRegionalRate || taxSettings.usnRateIncome}% · без сотрудников</p>
        </div>
        <Button onClick={() => navigate('/income?type=income')}><Plus className="size-4" /> Добавить доход</Button>
      </div>

      {(data.overdue > 0 || data.reviewCount > 0) && (
        <div className="action-strip">
          <AlertTriangle className="size-5" />
          <div className="flex-1">
            <strong>Нужно внимание</strong>
            <p>{data.overdue > 0 ? `Просрочено обязательств: ${data.overdue}. ` : ''}{data.reviewCount > 0 ? `Операций на проверке: ${data.reviewCount}.` : ''}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(data.overdue > 0 ? '/taxes' : '/income')}>Проверить <ArrowRight className="size-4" /></Button>
        </div>
      )}

      <div className="metric-grid metric-grid-four">
        <Card className="metric-card featured"><CardContent><span>Доход с начала года</span><MoneyDisplay amount={data.income} size="lg" /><small>налоговая база после возвратов</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Начислено</span><MoneyDisplay amount={data.accrued} size="lg" /><small>УСН и страховые взносы</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Оплачено</span><MoneyDisplay amount={data.paid} size="lg" /><small>по фактическим платежам</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Осталось оплатить</span><MoneyDisplay amount={data.remaining} size="lg" /><small>по текущему плану</small></CardContent></Card>
      </div>

      {data.nearest ? (
        <Card className="next-action-card">
          <CardContent>
            <div className="next-action-icon"><CalendarClock className="size-5" /></div>
            <div className="flex-1">
              <p className="eyebrow">СЛЕДУЮЩИЙ ПЛАТЁЖ</p>
              <h2>{obligationLabels[data.nearest.type]} · {data.nearest.period}</h2>
              <p>до {formatDate(data.nearest.dueDate)} · {getDaysUntil(data.nearest.dueDate) >= 0 ? `${getDaysUntil(data.nearest.dueDate)} дн.` : 'срок прошёл'}</p>
            </div>
            <div className="text-right"><MoneyDisplay amount={leftToPay(data.nearest).toFixed(2)} size="lg" /><StatusBadge status={data.nearest.status} /></div>
            <Button onClick={() => navigate('/taxes')}>Открыть платежи <ArrowRight className="size-4" /></Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="next-action-card success"><CardContent><div className="next-action-icon"><CircleCheck className="size-5" /></div><div><p className="eyebrow">СТАТУС</p><h2>Текущие обязательства закрыты</h2><p>Новых сумм к оплате по рассчитанному плану нет.</p></div></CardContent></Card>
      )}

      <div className="dashboard-grid">
        <Card className="chart-card">
          <CardContent>
            <div className="section-heading"><div><p className="eyebrow">ДИНАМИКА</p><h2>Доход по месяцам</h2></div><Badge variant="outline">{currentIp.year}</Badge></div>
            {data.monthly.some(item => item.income !== 0) ? (
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={data.monthly} barCategoryGap="32%">
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} width={56} tickFormatter={value => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip cursor={{ fill: 'var(--color-muted)' }} formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="income" fill="var(--chart-primary)" name="Доход" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-chart"><TrendingUp className="size-7" /><strong>Добавьте первый доход</strong><p>Здесь появится динамика по месяцам.</p></div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="threshold-card"><CardContent><div className="flex items-center justify-between"><div><p className="eyebrow">КОНТРОЛЬ</p><h3>Порог НДС</h3></div><ShieldCheck className="size-5" /></div><div className="threshold-value"><strong>{vatProgress.toFixed(1)}%</strong><span>{formatCurrency(data.income)} из {formatCurrency(taxSettings.ndsThreshold)}</span></div><div className="progress-track"><span style={{ width: `${vatProgress}%` }} /></div><p>Пассивный мониторинг порога 20 млн ₽. Полный модуль НДС скрыт.</p></CardContent></Card>
          <Card className="threshold-card"><CardContent><div className="flex items-center justify-between"><div><p className="eyebrow">ЛИМИТ</p><h3>Право на УСН</h3></div><Wallet className="size-5" /></div><div className="threshold-value"><strong>{limitProgress.toFixed(2)}%</strong><span>лимит {formatCurrency(taxSettings.usnIncomeLimit)}</span></div><div className="progress-track"><span style={{ width: `${limitProgress}%` }} /></div><p>Показываем только значимый лимит доходов.</p></CardContent></Card>
        </div>
      </div>

      <div className="quick-actions">
        <button onClick={() => navigate('/income')}><ReceiptText className="size-5" /><span><strong>Операции</strong><small>Импорт, ручной ввод и разделение</small></span><ArrowRight className="size-4" /></button>
        <button onClick={() => navigate('/taxes')}><Wallet className="size-5" /><span><strong>Платежи</strong><small>Начисления, сроки и история</small></span><ArrowRight className="size-4" /></button>
      </div>
    </div>
  )
}
