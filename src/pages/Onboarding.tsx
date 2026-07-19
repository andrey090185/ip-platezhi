import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db } from '@/db/schema'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { seedTaxSettings, seedHolidays } from '@/db/seed'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import type { IpProfile } from '@/types'
import { ChevronRight, ChevronLeft, Check, ArrowLeft } from 'lucide-react'

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const navigate = useNavigate()
  const { setCurrentIp, setTaxSettings, setHolidays, setIsOnboarded } = useAppStore()
  const [hasExistingIps, setHasExistingIps] = useState(false)

  useEffect(() => {
    ipRepo.getCount().then(count => setHasExistingIps(count > 0))
  }, [])

  const [data, setData] = useState({
    name: '',
    inn: '',
    region: 'Москва',
    year: 2026,
    usnObject: 'income' as 'income' | 'income_minus_expenses',
    ndsEnabled: false,
    registrationDate: '',
    ifnsCode: '',
    oktmo: '',
    startUsnPaid: '0',
    startPremiumPaid: '0',
  })

  const totalSteps = 4

  const handleFinish = async () => {
    const now = new Date().toISOString()

    const ipId = await db.ipProfiles.add({
      name: data.name,
      inn: data.inn,
      region: data.region,
      year: data.year,
      usnObject: data.usnObject,
      ndsEnabled: data.ndsEnabled,
      registrationDate: data.registrationDate || null,
      ifnsCode: data.ifnsCode,
      oktmo: data.oktmo,
      createdAt: now,
      updatedAt: now,
    } as IpProfile)

    const numericId = ipId as number

    await seedTaxSettings(numericId, data.year)
    await seedHolidays(numericId, data.year)

    if (parseFloat(data.startUsnPaid) > 0 || parseFloat(data.startPremiumPaid) > 0) {
      if (parseFloat(data.startUsnPaid) > 0) {
        await db.taxObligations.add({
          ipId: numericId,
          type: 'usn_advance',
          period: `${data.year}-start`,
          amount: '0',
          dueDate: `${data.year}-01-01`,
          internalDeadline: null,
          status: 'paid',
          paidAmount: data.startUsnPaid,
          paidDate: now,
          paymentComment: 'Начальный остаток (введено при онбординге)',
          calculationSnapshotId: null,
          createdAt: now,
          updatedAt: now,
        } as any)
      }
      if (parseFloat(data.startPremiumPaid) > 0) {
        await db.taxObligations.add({
          ipId: numericId,
          type: 'ip_premium_fixed',
          period: `${data.year}`,
          amount: '0',
          dueDate: `${data.year}-12-28`,
          internalDeadline: null,
          status: 'paid',
          paidAmount: data.startPremiumPaid,
          paidDate: now,
          paymentComment: 'Начальный остаток (введено при онбординге)',
          calculationSnapshotId: null,
          createdAt: now,
          updatedAt: now,
        } as any)
      }
    }

    const ip = await db.ipProfiles.get(numericId)
    const settings = await settingsRepo.getTaxSettings(numericId)
    const holidays = await settingsRepo.getHolidays(numericId, data.year)

    if (ip) setCurrentIp(ip)
    if (settings) setTaxSettings(settings)
    setHolidays(holidays)
    setIsOnboarded(true)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>ИП Платежи</CardTitle>
              {hasExistingIps && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => navigate('/ips')}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  К списку ИП
                </Button>
              )}
            </div>
            <span className="text-sm text-muted-foreground">Шаг {step} из {totalSteps}</span>
          </div>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Данные ИП</h3>
              <div className="space-y-2">
                <Label>ФИО / Название</Label>
                <Input
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="ИП Иванов Алексей Петрович"
                />
              </div>
              <div className="space-y-2">
                <Label>ИНН</Label>
                <Input
                  value={data.inn}
                  onChange={(e) => setData({ ...data, inn: e.target.value })}
                  placeholder="770123456789"
                  maxLength={12}
                />
              </div>
              <div className="space-y-2">
                <Label>Регион</Label>
                <Input
                  value={data.region}
                  onChange={(e) => setData({ ...data, region: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Код ИФНС</Label>
                  <Input
                    value={data.ifnsCode}
                    onChange={(e) => setData({ ...data, ifnsCode: e.target.value })}
                    placeholder="7701"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ОКТМО</Label>
                  <Input
                    value={data.oktmo}
                    onChange={(e) => setData({ ...data, oktmo: e.target.value })}
                    placeholder="45348000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Год расчёта</Label>
                <Input
                  type="number"
                  value={data.year}
                  onChange={(e) => setData({ ...data, year: parseInt(e.target.value) })}
                  min={2020}
                  max={2030}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Режим УСН</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setData({ ...data, usnObject: 'income' })}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    data.usnObject === 'income'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">Доходы</div>
                  <div className="text-sm text-muted-foreground">Ставка 6%</div>
                </button>
                <button
                  onClick={() => setData({ ...data, usnObject: 'income_minus_expenses' })}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    data.usnObject === 'income_minus_expenses'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">Доходы минус расходы</div>
                  <div className="text-sm text-muted-foreground">Ставка 15%</div>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Для ИП без сотрудников на УСН «Доходы» налог можно уменьшить на фиксированные взносы до 100%.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">НДС</h3>
              <p className="text-sm text-muted-foreground">
                НДС при УСН возникает только при превышении порога 60 млн ₽ (с 2025 г.).
                Если ваши доходы ниже — оставьте «Выключен».
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setData({ ...data, ndsEnabled: true })}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    data.ndsEnabled
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">Включён</div>
                  <div className="text-sm text-muted-foreground">Платить НДС</div>
                </button>
                <button
                  onClick={() => setData({ ...data, ndsEnabled: false })}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    !data.ndsEnabled
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-medium">Выключен</div>
                  <div className="text-sm text-muted-foreground">Без НДС</div>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Стартовые остатки</h3>
              <p className="text-sm text-muted-foreground">
                Укажите уже уплаченные суммы за текущий год (если есть). Эти данные будут учтены при расчёте налогов.
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Уплачено авансов УСН (₽)</Label>
                  <Input
                    type="number"
                    value={data.startUsnPaid}
                    onChange={(e) => setData({ ...data, startUsnPaid: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Уплачено фиксированных взносов (₽)</Label>
                  <Input
                    type="number"
                    value={data.startPremiumPaid}
                    onChange={(e) => setData({ ...data, startPremiumPaid: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Назад
            </Button>
            {step < totalSteps ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && (!data.name || !data.inn)}
              >
                Далее <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleFinish}>
                <Check className="w-4 h-4 mr-1" /> Начать
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
