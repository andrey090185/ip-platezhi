import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { exportToCSV, parseCSV } from '@/utils/csv'
import type { Transaction } from '@/types'
import { Plus, Upload, Download, Trash2, Edit } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'
import { d, dSum } from '@/engine/decimal'

export default function IncomeExpenses() {
  const { currentIp } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income' as Transaction['type'],
    amount: '',
    category: '',
    counterparty: '',
    comment: '',
    usnRelevant: true,
    ndsRelevant: false,
  })

  useEffect(() => {
    if (currentIp?.id) loadTransactions()
  }, [currentIp])

  // Auto-open form when navigated with ?type=income or ?type=expense
  useEffect(() => {
    const typeParam = searchParams.get('type')
    if (typeParam === 'income' || typeParam === 'expense') {
      setForm(prev => ({ ...prev, type: typeParam as Transaction['type'] }))
      setEditingTx(null)
      setDialogOpen(true)
      setSearchParams({})
    }
  }, [searchParams])

  const loadTransactions = async () => {
    if (!currentIp?.id) return
    const txs = await transactionRepo.getAll(currentIp.id)
    setTransactions(txs)
  }

  const handleSave = async () => {
    if (!currentIp?.id || !form.amount) return
    const period = form.date.substring(0, 7)
    if (editingTx?.id) {
      await transactionRepo.update(editingTx.id, { ...form, period })
    } else {
      await transactionRepo.add({
        ipId: currentIp.id,
        ...form,
        period,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    setDialogOpen(false)
    setEditingTx(null)
    setForm({
      date: new Date().toISOString().split('T')[0],
      type: 'income',
      amount: '',
      category: '',
      counterparty: '',
      comment: '',
      usnRelevant: true,
      ndsRelevant: false,
    })
    loadTransactions()
  }

  const handleDelete = async (id: number) => {
    await transactionRepo.delete(id)
    loadTransactions()
  }

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setForm({
      date: tx.date,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      counterparty: tx.counterparty,
      comment: tx.comment,
      usnRelevant: tx.usnRelevant,
      ndsRelevant: tx.ndsRelevant,
    })
    setDialogOpen(true)
  }

  const handleExport = () => {
    const data = filtered.map(t => ({
      Дата: t.date,
      Тип: t.type === 'income' ? 'Доход' : t.type === 'expense' ? 'Расход' : t.type,
      Сумма: t.amount,
      Категория: t.category,
      Контрагент: t.counterparty,
      Комментарий: t.comment,
    }))
    exportToCSV(data, `operacii_${currentIp?.year || 2026}.csv`)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentIp?.id) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      const now = new Date().toISOString()
      const txs: Omit<Transaction, 'id'>[] = rows.map(r => ({
        ipId: currentIp.id!,
        date: r['Дата'] || r['date'] || now.split('T')[0],
        type: (r['Тип'] || r['type'] || 'income') as Transaction['type'],
        amount: r['Сумма'] || r['amount'] || '0',
        category: r['Категория'] || r['category'] || '',
        counterparty: r['Контрагент'] || r['counterparty'] || '',
        comment: r['Комментарий'] || r['comment'] || '',
        usnRelevant: true,
        ndsRelevant: false,
        period: (r['Дата'] || r['date'] || now).substring(0, 7),
        createdAt: now,
        updatedAt: now,
      }))
      await transactionRepo.importCSV(currentIp.id, txs)
      loadTransactions()
    }
    reader.readAsText(file)
  }

  const filtered = transactions.filter(t => {
    if (filterMonth !== 'all' && !t.date.startsWith(filterMonth)) return false
    if (filterType !== 'all' && t.type !== filterType) return false
    return true
  })

  const totalIncome = filtered
    .filter(t => t.type === 'income')
    .reduce((a, t) => a.plus(d(t.amount)), d(0))
  const totalExpenses = filtered
    .filter(t => t.type === 'expense')
    .reduce((a, t) => a.plus(d(t.amount)), d(0))

  if (!currentIp) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Доходы и расходы</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Экспорт
          </Button>
          <label>
            <Button variant="outline" size="sm" render={<span />}>
              <Upload className="w-4 h-4 mr-1" /> Импорт
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" onClick={() => { setEditingTx(null); setForm({ ...form, date: new Date().toISOString().split('T')[0], type: 'income', amount: '', category: '', counterparty: '', comment: '', usnRelevant: true, ndsRelevant: false }) }} />}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTx ? 'Редактировать' : 'Новая операция'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Дата</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Тип</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Transaction['type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Доход</SelectItem>
                      <SelectItem value="expense">Расход</SelectItem>
                      <SelectItem value="return_income">Возврат дохода</SelectItem>
                      <SelectItem value="return_expense">Возврат расхода</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Сумма (₽)</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Категория</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Услуги, Аренда..." />
                </div>
                <div className="space-y-2">
                  <Label>Контрагент</Label>
                  <Input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Комментарий</Label>
                  <Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.usnRelevant} onChange={(e) => setForm({ ...form, usnRelevant: e.target.checked })} />
                    Учитывается в УСН
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.ndsRelevant} onChange={(e) => setForm({ ...form, ndsRelevant: e.target.checked })} />
                    Учитывается в НДС
                  </label>
                </div>
                <Button onClick={handleSave} className="w-full">
                  {editingTx ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Доходы</CardTitle></CardHeader>
          <CardContent><MoneyDisplay amount={totalIncome.toFixed(2)} size="lg" className="text-green-600" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Расходы</CardTitle></CardHeader>
          <CardContent><MoneyDisplay amount={totalExpenses.toFixed(2)} size="lg" className="text-red-600" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">База УСН</CardTitle></CardHeader>
          <CardContent><MoneyDisplay amount={totalIncome.minus(totalExpenses).toFixed(2)} size="lg" /></CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Период" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все месяцы</SelectItem>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i} value={`${currentIp.year}-${String(i + 1).padStart(2, '0')}`}>
                {new Date(currentIp.year, i).toLocaleDateString('ru-RU', { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Тип" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="income">Доходы</SelectItem>
            <SelectItem value="expense">Расходы</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Пока нет операций" description="Добавьте первый доход или расход" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Контрагент</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell>{tx.date}</TableCell>
                  <TableCell>
                    <Badge variant={tx.type === 'income' ? 'default' : 'secondary'}>
                      {tx.type === 'income' ? 'Доход' : tx.type === 'expense' ? 'Расход' : tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(tx.amount)}</TableCell>
                  <TableCell>{tx.category}</TableCell>
                  <TableCell>{tx.counterparty}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(tx)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => tx.id && handleDelete(tx.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
