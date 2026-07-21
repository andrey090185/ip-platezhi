import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ipRepo } from '@/db/repositories/ipRepo'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { createFullBackup, restoreBackup } from '@/services/backupService'
import { getRuleSet } from '@/engine/taxRules'
import { Download, FileJson, Save, ShieldCheck, Upload } from 'lucide-react'

export default function Settings() {
  const {
    currentIp, taxSettings, setCurrentIp, setTaxSettings, userId,
  } = useAppStore()
  const [profile, setProfile] = useState({
    name: '', inn: '', region: '', registrationDate: '', ifnsCode: '', oktmo: '', year: 2026,
  })
  const [tax, setTax] = useState({
    rate: 6,
    considerAdditionalInCurrentYear: false,
    considerPreviousYearAdditional: true,
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (currentIp) setProfile({
      name: currentIp.name,
      inn: currentIp.inn,
      region: currentIp.region,
      registrationDate: currentIp.registrationDate ?? '',
      ifnsCode: currentIp.ifnsCode,
      oktmo: currentIp.oktmo,
      year: currentIp.year,
    })
    if (taxSettings) setTax({
      rate: taxSettings.usnRegionalRate || taxSettings.usnRateIncome,
      considerAdditionalInCurrentYear: taxSettings.considerAdditionalInCurrentYear,
      considerPreviousYearAdditional: taxSettings.considerPreviousYearAdditional !== false,
    })
  }, [currentIp, taxSettings])

  const saveProfile = async () => {
    if (!currentIp?.id) return
    await ipRepo.update(currentIp.id, { ...profile, registrationDate: profile.registrationDate || null }, userId ?? undefined)
    const updated = await ipRepo.getAll().then(items => items.find(item => item.id === currentIp.id))
    if (updated) setCurrentIp(updated)
    setMessage('Данные ИП сохранены.')
  }

  const saveTax = async () => {
    if (!currentIp?.id || !taxSettings) return
    await settingsRepo.saveTaxSettings({
      ...taxSettings,
      ipId: currentIp.id,
      year: profile.year,
      usnRegionalRate: tax.rate === taxSettings.usnRateIncome ? 0 : tax.rate,
      considerAdditionalInCurrentYear: tax.considerAdditionalInCurrentYear,
      considerPreviousYearAdditional: tax.considerPreviousYearAdditional,
    })
    const updated = await settingsRepo.getTaxSettings(currentIp.id)
    if (updated) setTaxSettings(updated)
    setMessage('Налоговые настройки сохранены.')
  }

  const exportBackup = async () => {
    const backup = await createFullBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `ip-platezhi-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(href)
    setMessage('Полная резервная копия создана.')
  }

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      await restoreBackup(JSON.parse(await file.text()))
      setMessage('Резервная копия восстановлена. Обновляем приложение…')
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось восстановить копию.')
    } finally {
      event.target.value = ''
    }
  }

  if (!currentIp || !taxSettings) return null
  const previousRules = getRuleSet(currentIp.year - 1)
  const currentRules = getRuleSet(currentIp.year)

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div><p className="eyebrow">КОНФИГУРАЦИЯ</p><h1>Настройки</h1><p>Только параметры, которые нужны ИП на УСН «Доходы» без сотрудников.</p></div>
      </div>

      {message && <div className="info-note">{message}</div>}

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Профиль ИП</TabsTrigger>
          <TabsTrigger value="tax">Налоги</TabsTrigger>
          <TabsTrigger value="data">Данные</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card><CardContent className="space-y-5">
            <div className="section-heading"><div><p className="eyebrow">РЕКВИЗИТЫ</p><h2>Основные данные</h2></div><Badge variant="outline">{currentIp.region}</Badge></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2"><Label>ФИО / название</Label><Input value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} /></div>
              <div className="space-y-2"><Label>ИНН</Label><Input value={profile.inn} maxLength={12} onChange={event => setProfile({ ...profile, inn: event.target.value.replace(/\D/g, '') })} /></div>
              <div className="space-y-2"><Label>Регион</Label><Input value={profile.region} onChange={event => setProfile({ ...profile, region: event.target.value })} /></div>
              <div className="space-y-2"><Label>Дата регистрации</Label><Input type="date" value={profile.registrationDate} onChange={event => setProfile({ ...profile, registrationDate: event.target.value })} /></div>
              <div className="space-y-2"><Label>Рабочий год</Label><Input value={profile.year} disabled /><p className="helper-text">Расчёт использует правила {currentRules?.version ?? profile.year} и обязательства предыдущего года.</p></div>
              <div className="space-y-2"><Label>Код ИФНС</Label><Input value={profile.ifnsCode} maxLength={4} onChange={event => setProfile({ ...profile, ifnsCode: event.target.value.replace(/\D/g, '') })} /></div>
              <div className="space-y-2"><Label>ОКТМО</Label><Input value={profile.oktmo} onChange={event => setProfile({ ...profile, oktmo: event.target.value.replace(/\D/g, '') })} /></div>
            </div>
            <Button onClick={saveProfile}><Save className="size-4" /> Сохранить профиль</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card><CardContent className="space-y-5">
            <div className="section-heading"><div><p className="eyebrow">РЕЖИМ</p><h2>УСН «Доходы»</h2></div><Badge>Без сотрудников</Badge></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Действующая ставка, %</Label><Input type="number" min="1" max="6" step="0.1" value={tax.rate} onChange={event => setTax({ ...tax, rate: Number(event.target.value) })} /><p className="helper-text">Проверьте региональную льготу перед изменением базовых 6%.</p></div>
              <label className="setting-toggle"><input type="checkbox" checked={tax.considerPreviousYearAdditional} onChange={event => setTax({ ...tax, considerPreviousYearAdditional: event.target.checked })} /><span><strong>Учитывать 1% за {currentIp.year - 1} год в УСН {currentIp.year}</strong><small>Включено по умолчанию. Отключите, только если уже уменьшили на эту сумму налог за {currentIp.year - 1} год.</small></span></label>
              <label className="setting-toggle sm:col-start-2"><input type="checkbox" checked={tax.considerAdditionalInCurrentYear} onChange={event => setTax({ ...tax, considerAdditionalInCurrentYear: event.target.checked })} /><span><strong>Учитывать 1% за {currentIp.year} год досрочно</strong><small>Если включить, эту сумму нельзя повторно использовать в {currentIp.year + 1} году.</small></span></label>
            </div>
            <Button onClick={saveTax}><Save className="size-4" /> Сохранить настройки</Button>
          </CardContent></Card>

          <Card><CardContent>
            <div className="section-heading"><div><p className="eyebrow">ПРАВИЛА {previousRules?.version} + {currentRules?.version}</p><h2>Официальные параметры взносов</h2></div><ShieldCheck className="size-5 text-emerald-600" /></div>
            <div className="rules-year-grid">
              {[previousRules, currentRules].filter(Boolean).map(rules => rules && (
                <div className="rules-year" key={rules.year}>
                  <div className="rules-year-title"><strong>{rules.year} год</strong><Badge variant="outline">{rules.version}</Badge></div>
                  <div className="rules-grid">
                    <div><span>Фиксированные взносы</span><strong>{rules.fixedPremium.toLocaleString('ru-RU')} ₽</strong></div>
                    <div><span>Порог для 1%</span><strong>{rules.additionalPremiumThreshold.toLocaleString('ru-RU')} ₽</strong></div>
                    <div><span>Максимум 1%</span><strong>{rules.additionalPremiumMax.toLocaleString('ru-RU')} ₽</strong></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="helper-text mt-4">Дополнительный взнос считается как (доход за расчётный год − 300 000 ₽) × 1% с учётом годового максимума. Взнос за {currentIp.year - 1} год подлежит уплате до 1 июля {currentIp.year} года.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="data">
          <Card><CardContent className="space-y-5">
            <div className="section-heading"><div><p className="eyebrow">БЕЗОПАСНОСТЬ</p><h2>Полная резервная копия</h2></div><FileJson className="size-5 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">В файл входят все ИП, операции, распределения, обязательства, платежи, снимки расчётов и настройки. Импорт добавляет или обновляет записи, не очищая базу.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportBackup}><Download className="size-4" /> Скачать JSON</Button>
              <label><Button variant="outline" render={<span />}><Upload className="size-4" /> Восстановить JSON</Button><input className="hidden" type="file" accept="application/json,.json" onChange={importBackup} /></label>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
