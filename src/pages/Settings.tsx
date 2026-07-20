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
import { Download, FileJson, Save, ShieldCheck, Upload } from 'lucide-react'

export default function Settings() {
  const {
    currentIp, taxSettings, setCurrentIp, setTaxSettings, userId,
  } = useAppStore()
  const [profile, setProfile] = useState({
    name: '', inn: '', region: '', registrationDate: '', ifnsCode: '', oktmo: '', year: 2026,
  })
  const [tax, setTax] = useState({ rate: 6, considerAdditionalInCurrentYear: false })
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
              <div className="space-y-2"><Label>Рабочий год</Label><Input value={profile.year} disabled /><p className="text-xs text-muted-foreground">Для расчёта подключён набор правил 2026.1.</p></div>
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
              <div className="space-y-2"><Label>Действующая ставка, %</Label><Input type="number" min="1" max="6" step="0.1" value={tax.rate} onChange={event => setTax({ ...tax, rate: Number(event.target.value) })} /><p className="text-xs text-muted-foreground">Проверьте региональную льготу перед изменением базовых 6%.</p></div>
              <label className="setting-toggle"><input type="checkbox" checked={tax.considerAdditionalInCurrentYear} onChange={event => setTax({ ...tax, considerAdditionalInCurrentYear: event.target.checked })} /><span><strong>Учитывать дополнительный 1% в текущем году</strong><small>Одну и ту же сумму нельзя повторно использовать в следующем году.</small></span></label>
            </div>
            <Button onClick={saveTax}><Save className="size-4" /> Сохранить настройки</Button>
          </CardContent></Card>

          <Card><CardContent>
            <div className="section-heading"><div><p className="eyebrow">ПРАВИЛА 2026.1</p><h2>Официальные параметры</h2></div><ShieldCheck className="size-5 text-emerald-600" /></div>
            <div className="rules-grid">
              <div><span>Фиксированные взносы</span><strong>{taxSettings.fixedPremium.toLocaleString('ru-RU')} ₽</strong></div>
              <div><span>Порог дополнительного 1%</span><strong>{taxSettings.additionalPremiumThreshold.toLocaleString('ru-RU')} ₽</strong></div>
              <div><span>Максимум дополнительного взноса</span><strong>{taxSettings.additionalPremiumMax.toLocaleString('ru-RU')} ₽</strong></div>
              <div><span>Порог НДС</span><strong>{taxSettings.ndsThreshold.toLocaleString('ru-RU')} ₽</strong></div>
              <div><span>Лимит доходов УСН</span><strong>{taxSettings.usnIncomeLimit.toLocaleString('ru-RU')} ₽</strong></div>
              <div><span>Версия</span><strong>2026.1 · 20.07.2026</strong></div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Официальные значения не редактируются произвольно в обычном интерфейсе. Полный расчёт НДС и настройки сотрудников скрыты.</p>
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
