import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { db } from '@/db/schema'
import type { EnsRecord } from '@/types'
import { Plus, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'
import { d, dSum } from '@/engine/decimal'

export default function Ens() {
  const { currentIp } = useAppStore()
  const [records, setRecords] = useState<EnsRecord[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'payment' as EnsRecord['type'],
    amount: '',
    description: '',
  })

  useEffect(() => {
    if (currentIp?.id) loadRecords()
  }, [currentIp])

  const loadRecords = async () => {
    if (!currentIp?.id) return
    const recs = await db.ensRecords.where('ipId').equals(currentIp.id).toArray()
    setRecords(recs.sort((a, b) => b.date.localeCompare(a.date)))
  }

  const handleSave = async () => {
    if (!currentIp?.id || !form.amount) return
    await db.ensRecords.add({
      ipId: currentIp.id,
      ...form,
      createdAt: new Date().toISOString(),
    } as EnsRecord)
    setDialogOpen(false)
    setForm({ date: new Date().toISOString().split('T')[0], type: 'payment', amount: '', description: '' })
    loadRecords()
  }

  const totalAccruals = records
    .filter(r => r.type === 'accrual')
    .reduce((a, r) => a.plus(d(r.amount)), d(0))
  const totalPayments = records
    .filter(r => r.type === 'payment')
    .reduce((a, r) => a.plus(d(r.amount)), d(0))
  const balance = totalAccruals.minus(totalPayments)

  if (!currentIp) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ЕНС (Единый налоговый счёт)</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="w-4 h-4 mr-1" /> Добавить запись
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Запись по ЕНС</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Дата</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Тип</Label>
                <div className="flex gap-2">
                  <Button
                    variant={form.type === 'payment' ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, type: 'payment' })}
                  >
                    Уплата
                  </Button>
                  <Button
                    variant={form.type === 'accrual' ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, type: 'accrual' })}
                  >
                    Начисление
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Сумма (₽)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full">Сохранить</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <CardContent className="flex items-center gap-3 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Если уведомление не подано, деньги на ЕНС могут распределиться не так, как ожидается.
            Приложение не синхронизируется с ФНС — данные вводятся вручную.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Начислено</CardTitle></CardHeader>
          <CardContent><MoneyDisplay amount={totalAccruals.toFixed(2)} size="lg" className="text-blue-600" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Уплачено</CardTitle></CardHeader>
          <CardContent><MoneyDisplay amount={totalPayments.toFixed(2)} size="lg" className="text-green-600" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Предполагаемый остаток</CardTitle></CardHeader>
          <CardContent><MoneyDisplay amount={balance.toFixed(2)} size="lg" /></CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <EmptyState title="Пока нет записей по ЕНС" description="Добавьте начисления и платежи" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Описание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(rec => (
                <TableRow key={rec.id}>
                  <TableCell>{rec.date}</TableCell>
                  <TableCell>
                    <span className={rec.type === 'payment' ? 'text-green-600' : 'text-blue-600'}>
                      {rec.type === 'payment' ? 'Уплата' : 'Начисление'}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(rec.amount)}</TableCell>
                  <TableCell>{rec.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
