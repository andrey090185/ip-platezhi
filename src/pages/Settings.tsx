import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { db } from '@/db/schema'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { useAppStore as useStore } from '@/store/appStore'
import { DEFAULT_TAX_SETTINGS } from '@/engine/taxRules'
import type { Holiday, AuditLog } from '@/types'
import { Plus, Trash2, Download, Upload, Save } from 'lucide-react'

export default function Settings() {
  const { currentIp, taxSettings, holidays, setCurrentIp, setTaxSettings, setHolidays } = useAppStore()
  const [ipForm, setIpForm] = useState({ name: '', inn: '', region: '', year: 2026 })
  const [taxForm, setTaxForm] = useState<any>({})
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    if (currentIp) {
      setIpForm({ name: currentIp.name, inn: currentIp.inn, region: currentIp.region, year: currentIp.year })
    }
    if (taxSettings) {
      setTaxForm({ ...taxSettings })
    }
  }, [currentIp, taxSettings])

  const saveIp = async () => {
    if (!currentIp?.id) return
    await db.ipProfiles.update(currentIp.id, { ...ipForm, updatedAt: new Date().toISOString() })
    const updated = await db.ipProfiles.get(currentIp.id)
    if (updated) setCurrentIp(updated)
  }

  const saveTaxSettings = async () => {
    if (!currentIp?.id) return
    await settingsRepo.saveTaxSettings({ ...taxForm, ipId: currentIp.id, year: currentIp.year })
    const updated = await settingsRepo.getTaxSettings(currentIp.id)
    if (updated) setTaxSettings(updated)
  }

  const addHoliday = async () => {
    if (!currentIp?.id || !newHoliday.date || !newHoliday.name) return
    const id = await settingsRepo.addHoliday({
      ipId: currentIp.id,
      date: newHoliday.date,
      name: newHoliday.name,
      year: currentIp.year,
    })
    const updated = await settingsRepo.getHolidays(currentIp.id, currentIp.year)
    setHolidays(updated)
    setHolidayDialogOpen(false)
    setNewHoliday({ date: '', name: '' })
  }

  const deleteHoliday = async (id: number) => {
    await settingsRepo.deleteHoliday(id)
    if (currentIp?.id) {
      const updated = await settingsRepo.getHolidays(currentIp.id, currentIp.year)
      setHolidays(updated)
    }
  }

  const handleExport = () => {
    const data = { ip: currentIp, taxSettings, holidays }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ip_platezhi_backup_${currentIp?.year || 2026}.json`
    link.click()
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentIp?.id) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.ip) {
          await db.ipProfiles.update(currentIp.id, { ...data.ip, id: currentIp.id })
          const updated = await db.ipProfiles.get(currentIp.id)
          if (updated) setCurrentIp(updated)
        }
        if (data.taxSettings) {
          await settingsRepo.saveTaxSettings({ ...data.taxSettings, ipId: currentIp.id })
          const updated = await settingsRepo.getTaxSettings(currentIp.id)
          if (updated) setTaxSettings(updated)
        }
      } catch (err) {
        console.error('Import error:', err)
      }
    }
    reader.readAsText(file)
  }

  if (!currentIp || !taxSettings) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Настройки</h1>

      <Tabs defaultValue="ip">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ip">Данные ИП</TabsTrigger>
          <TabsTrigger value="tax">Налоговые правила</TabsTrigger>
          <TabsTrigger value="holidays">Праздники</TabsTrigger>
          <TabsTrigger value="backup">Резервное копирование</TabsTrigger>
        </TabsList>

        <TabsContent value="ip" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Данные ИП</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Название / ФИО</Label>
                <Input value={ipForm.name} onChange={(e) => setIpForm({ ...ipForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ИНН</Label>
                <Input value={ipForm.inn} onChange={(e) => setIpForm({ ...ipForm, inn: e.target.value })} maxLength={12} />
              </div>
              <div className="space-y-2">
                <Label>Регион</Label>
                <Input value={ipForm.region} onChange={(e) => setIpForm({ ...ipForm, region: e.target.value })} />
              </div>
              <Button onClick={saveIp}><Save className="w-4 h-4 mr-1" /> Сохранить</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Ставки и лимиты УСН</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ставка УСН «Доходы» (%)</Label>
                <Input type="number" value={taxForm.usnRateIncome} onChange={(e) => setTaxForm({ ...taxForm, usnRateIncome: parseFloat(e.target.value) })} step="0.1" />
              </div>
              <div className="space-y-2">
                <Label>Ставка УСН «Д-Р» (%)</Label>
                <Input type="number" value={taxForm.usnRateIncomeMinusExpenses} onChange={(e) => setTaxForm({ ...taxForm, usnRateIncomeMinusExpenses: parseFloat(e.target.value) })} step="0.1" />
              </div>
              <div className="space-y-2">
                <Label>Региональная ставка (%)</Label>
                <Input type="number" value={taxForm.usnRegionalRate} onChange={(e) => setTaxForm({ ...taxForm, usnRegionalRate: parseFloat(e.target.value) })} step="0.1" />
              </div>
              <div className="space-y-2">
                <Label>Минимальный налог (%)</Label>
                <Input type="number" value={taxForm.usnMinTaxRate} onChange={(e) => setTaxForm({ ...taxForm, usnMinTaxRate: parseFloat(e.target.value) })} step="0.1" />
              </div>
              <div className="space-y-2">
                <Label>Лимит доходов УСН (₽)</Label>
                <Input type="number" value={taxForm.usnIncomeLimit} onChange={(e) => setTaxForm({ ...taxForm, usnIncomeLimit: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Лимит численности</Label>
                <Input type="number" value={taxForm.usnEmployeeLimit} onChange={(e) => setTaxForm({ ...taxForm, usnEmployeeLimit: parseInt(e.target.value) })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Страховые взносы ИП</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Фиксированные взносы (₽)</Label>
                <Input type="number" value={taxForm.fixedPremium} onChange={(e) => setTaxForm({ ...taxForm, fixedPremium: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Порог для 1% (₽)</Label>
                <Input type="number" value={taxForm.additionalPremiumThreshold} onChange={(e) => setTaxForm({ ...taxForm, additionalPremiumThreshold: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Максимум 1% (₽)</Label>
                <Input type="number" value={taxForm.additionalPremiumMax} onChange={(e) => setTaxForm({ ...taxForm, additionalPremiumMax: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Тариф травматизма (%)</Label>
                <Input type="number" value={taxForm.traumaRate} onChange={(e) => setTaxForm({ ...taxForm, traumaRate: parseFloat(e.target.value) })} step="0.1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Страховые взносы за сотрудников</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>База (₽)</Label>
                <Input type="number" value={taxForm.insuranceBaseThreshold} onChange={(e) => setTaxForm({ ...taxForm, insuranceBaseThreshold: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Основной тариф (%)</Label>
                <Input type="number" value={taxForm.insuranceMainRate} onChange={(e) => setTaxForm({ ...taxForm, insuranceMainRate: parseFloat(e.target.value) })} step="0.1" />
              </div>
              <div className="space-y-2">
                <Label>Сверх базы (%)</Label>
                <Input type="number" value={taxForm.insuranceExcessRate} onChange={(e) => setTaxForm({ ...taxForm, insuranceExcessRate: parseFloat(e.target.value) })} step="0.1" />
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveTaxSettings}><Save className="w-4 h-4 mr-1" /> Сохранить налоговые правила</Button>
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Праздничные дни {currentIp.year}</CardTitle>
              <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
                <DialogTrigger render={<Button size="sm" />}>
                  <Plus className="w-4 h-4 mr-1" /> Добавить
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Новый праздничный день</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Дата</Label>
                      <Input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} />
                    </div>
                    <Button onClick={addHoliday} className="w-full">Добавить</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map(h => (
                    <TableRow key={h.id}>
                      <TableCell>{h.date}</TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => h.id && deleteHoliday(h.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Резервное копирование</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Экспорт и импорт всех данных приложения в формате JSON.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleExport} variant="outline">
                  <Download className="w-4 h-4 mr-1" /> Экспорт JSON
                </Button>
                <label>
                  <Button variant="outline" render={<span />}>
                    <Upload className="w-4 h-4 mr-1" /> Импорт JSON
                  </Button>
                  <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
