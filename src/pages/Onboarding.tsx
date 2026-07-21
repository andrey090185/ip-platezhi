import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { paymentRepo } from '@/db/repositories/paymentRepo'
import { seedHolidays, seedTaxSettings } from '@/db/seed'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { d, dMin } from '@/engine/decimal'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

export default function Onboarding() {
  const navigate = useNavigate()
  const { switchToIp, setIsOnboarded, userId } = useAppStore()
  const [step, setStep] = useState(1)
  const [hasExistingIps, setHasExistingIps] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState({
    name: '',
    inn: '',
    region: 'Москва',
    year: 2026,
    registrationDate: '',
    ifnsCode: '',
    oktmo: '',
    openingAccruedUsn: '0',
    openingPaidUsn: '0',
    openingPaidPremium: '0',
    openingPaymentDate: '2026-01-01',
  })

  useEffect(() => { void ipRepo.getCount().then(count => setHasExistingIps(count > 0)) }, [])

  const finish = async () => {
    setError('')
    if (!/^\d{12}$/.test(data.inn)) {
      setError('ИНН индивидуального предпринимателя должен содержать 12 цифр.')
      setStep(1)
      return
    }
    const now = new Date().toISOString()
    const ipId = await ipRepo.add({
      name: data.name,
      inn: data.inn,
      region: data.region,
      year: data.year,
      usnObject: 'income',
      registrationDate: data.registrationDate || null,
      ifnsCode: data.ifnsCode,
      oktmo: data.oktmo,
      ndsEnabled: false,
      createdAt: now,
      updatedAt: now,
    }, userId ?? undefined)

    await seedTaxSettings(ipId, data.year)
    await seedHolidays(ipId, data.year)
    const settings = await settingsRepo.getTaxSettings(ipId)

    let openingUsnId: number | null = null
    if (d(data.openingAccruedUsn || 0).gt(0)) {
      openingUsnId = await taxCalcRepo.add({
        ipId,
        type: 'usn_advance',
        period: `${data.year}-opening`,
        taxYear: data.year,
        dueYear: data.year,
        amount: d(data.openingAccruedUsn).toFixed(2),
        dueDate: `${data.year}-01-01`,
        internalDeadline: null,
        notificationDueDate: null,
        status: 'calculated',
        paidAmount: '0.00',
        paidDate: null,
        paymentComment: 'Начальные данные',
        calculationSnapshotId: null,
        availableReduction: '0.00',
        usedReduction: '0.00',
        trace: null,
        createdAt: now,
        updatedAt: now,
      })
    }

    if (d(data.openingPaidUsn || 0).gt(0)) {
      await paymentRepo.add({
        ipId,
        obligationId: openingUsnId,
        allocateAmount: openingUsnId
          ? dMin(d(data.openingPaidUsn), d(data.openingAccruedUsn)).toFixed(2)
          : '0.00',
        date: data.openingPaymentDate,
        amount: d(data.openingPaidUsn).toFixed(2),
        description: 'УСН, оплачено до начала работы в приложении',
        kind: 'usn',
        period: `${data.year}-opening`,
        taxYear: data.year,
        documentNumber: '',
        comment: 'Начальные данные',
        source: 'opening',
        sourceTransactionId: null,
      })
    }

    if (settings && d(data.openingPaidPremium || 0).gt(0)) {
      const fixedId = await taxCalcRepo.add({
        ipId,
        type: 'ip_premium_fixed',
        period: `${data.year}-fixed`,
        taxYear: data.year,
        dueYear: data.year,
        amount: d(settings.fixedPremium).toFixed(2),
        dueDate: `${data.year}-12-28`,
        internalDeadline: null,
        notificationDueDate: null,
        status: 'calculated',
        paidAmount: '0.00',
        paidDate: null,
        paymentComment: 'Начальные данные',
        calculationSnapshotId: null,
        availableReduction: d(settings.fixedPremium).toFixed(2),
        usedReduction: '0.00',
        trace: null,
        createdAt: now,
        updatedAt: now,
      })
      await paymentRepo.add({
        ipId,
        obligationId: fixedId,
        allocateAmount: dMin(d(data.openingPaidPremium), d(settings.fixedPremium)).toFixed(2),
        date: data.openingPaymentDate,
        amount: d(data.openingPaidPremium).toFixed(2),
        description: 'Фиксированные взносы, оплачено ранее',
        kind: 'fixed_premium',
        period: `${data.year}-fixed`,
        taxYear: data.year,
        documentNumber: '',
        comment: 'Начальные данные',
        source: 'opening',
        sourceTransactionId: null,
      })
    }

    const [ip, holidays] = await Promise.all([
      ipRepo.getAll().then(items => items.find(item => item.id === ipId)),
      settingsRepo.getHolidays(ipId, data.year),
    ])
    if (ip) switchToIp(ip, settings ?? null, holidays)
    setIsOnboarded(true)
    navigate('/dashboard')
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-brand"><div className="brand-mark"><span>ИП</span></div><div><strong>ИП Платежи</strong><small>Контроль доходов и налогов</small></div></div>
      <Card className="w-full max-w-xl"><CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>{hasExistingIps && <Button variant="ghost" size="sm" onClick={() => navigate('/ips')}><ArrowLeft className="size-4" /> Все ИП</Button>}</div>
          <span className="text-xs text-muted-foreground">Шаг {step} из 3</span>
        </div>
        <div className="onboarding-progress">{[1, 2, 3].map(item => <span key={item} className={item <= step ? 'active' : ''} />)}</div>

        {step === 1 && <div className="space-y-5">
          <div><p className="eyebrow">ПРОФИЛЬ</p><h1 className="text-2xl font-semibold tracking-tight mt-1">Добавим ИП</h1><p className="text-sm text-muted-foreground mt-1">Каждый профиль хранит операции и платежи отдельно.</p></div>
          <div className="space-y-2"><Label>ФИО / название</Label><Input value={data.name} onChange={event => setData({ ...data, name: event.target.value })} placeholder="ИП Иванов Алексей Петрович" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>ИНН</Label><Input value={data.inn} maxLength={12} inputMode="numeric" onChange={event => setData({ ...data, inn: event.target.value.replace(/\D/g, '') })} placeholder="12 цифр" /></div>
            <div className="space-y-2"><Label>Регион</Label><Input value={data.region} onChange={event => setData({ ...data, region: event.target.value })} /></div>
            <div className="space-y-2"><Label>Дата регистрации</Label><Input type="date" value={data.registrationDate} onChange={event => setData({ ...data, registrationDate: event.target.value })} /></div>
            <div className="space-y-2"><Label>Рабочий год</Label><Input value={data.year} disabled /><p className="helper-text">Проверенные правила 2025.1 и 2026.1, включая переходящий взнос 1%.</p></div>
            <div className="space-y-2"><Label>Код ИФНС</Label><Input value={data.ifnsCode} maxLength={4} onChange={event => setData({ ...data, ifnsCode: event.target.value.replace(/\D/g, '') })} /></div>
            <div className="space-y-2"><Label>ОКТМО</Label><Input value={data.oktmo} onChange={event => setData({ ...data, oktmo: event.target.value.replace(/\D/g, '') })} /></div>
          </div>
        </div>}

        {step === 2 && <div className="space-y-5">
          <div><p className="eyebrow">НАЛОГОВЫЙ РЕЖИМ</p><h1 className="text-2xl font-semibold tracking-tight mt-1">УСН «Доходы»</h1><p className="text-sm text-muted-foreground mt-1">Первый релиз специально упрощён под ИП без сотрудников.</p></div>
          <div className="regime-card"><ShieldCheck className="size-6" /><div><strong>Ставка 6%</strong><p>Расходы ведутся для статистики и не уменьшают базу. Страховые взносы уменьшают рассчитанный налог по отдельному правилу.</p></div><Check className="size-5 text-emerald-600" /></div>
          <div className="info-note">НДС не включён. Приложение только предупредит о приближении к порогу 20 млн ₽.</div>
        </div>}

        {step === 3 && <div className="space-y-5">
          <div><p className="eyebrow">НАЧАЛЬНЫЕ ДАННЫЕ</p><h1 className="text-2xl font-semibold tracking-tight mt-1">Что было до приложения</h1><p className="text-sm text-muted-foreground mt-1">Начисления и оплаты вводятся отдельно — это важно для корректного расчёта.</p></div>
          <div className="space-y-2"><Label>Ранее начислено авансов УСН, ₽</Label><Input type="number" min="0" value={data.openingAccruedUsn} onChange={event => setData({ ...data, openingAccruedUsn: event.target.value })} /><p className="text-xs text-muted-foreground">Эта сумма вычитается как ранее рассчитанные авансы.</p></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Фактически уплачено УСН, ₽</Label><Input type="number" min="0" value={data.openingPaidUsn} onChange={event => setData({ ...data, openingPaidUsn: event.target.value })} /></div>
            <div className="space-y-2"><Label>Уплачено фиксированных взносов, ₽</Label><Input type="number" min="0" value={data.openingPaidPremium} onChange={event => setData({ ...data, openingPaidPremium: event.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Дата прошлых платежей</Label><Input type="date" value={data.openingPaymentDate} onChange={event => setData({ ...data, openingPaymentDate: event.target.value })} /></div>
        </div>}

        {error && <div className="form-error">{error}</div>}
        <div className="flex justify-between pt-2">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(current => Math.max(1, current - 1))}><ChevronLeft className="size-4" /> Назад</Button>
          {step < 3
            ? <Button disabled={step === 1 && (!data.name || data.inn.length !== 12)} onClick={() => setStep(current => current + 1)}>Далее <ChevronRight className="size-4" /></Button>
            : <Button onClick={finish}><Check className="size-4" /> Создать ИП</Button>}
        </div>
      </CardContent></Card>
    </div>
  )
}
