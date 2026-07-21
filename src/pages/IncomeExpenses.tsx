import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent } from '@/components/ui/card'
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
import { allocationRepo } from '@/db/repositories/allocationRepo'
import { operationRepo, type AllocationDraft } from '@/db/repositories/operationRepo'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { exportToCSV } from '@/utils/csv'
import type { AllocationKind, TaxObligation, Transaction, TransactionAllocation } from '@/types'
import {
  ALLOCATION_LABELS,
  legacyAllocationKind,
  summarizeLedger,
  validateAllocationTotal,
} from '@/engine/ledger'
import { d } from '@/engine/decimal'
import { formatCurrency } from '@/utils/currency'
import { formatObligationPeriod } from '@/utils/taxPeriods'
import {
  ArrowDownLeft, ArrowUpRight, Download, Edit3, Plus, Split, Trash2, Upload,
} from 'lucide-react'
import { ImportDialog } from '@/components/shared/ImportDialog'

type Direction = 'in' | 'out'
type AllocationLine = AllocationDraft & { key: string }

const incomingKinds: AllocationKind[] = [
  'taxable_income', 'business_expense_refund', 'non_taxable', 'transfer', 'needs_review',
]
const outgoingKinds: AllocationKind[] = [
  'income_return', 'business_expense', 'tax_payment', 'personal', 'transfer', 'needs_review',
]

const obligationLabels: Record<TaxObligation['type'], string> = {
  usn_advance: 'Аванс УСН',
  usn_annual: 'Годовой УСН',
  ip_premium_fixed: 'Фиксированные взносы',
  ip_premium_additional: 'Дополнительный 1%',
  notification: 'Уведомление',
}

const operationFilterLabels: Record<string, string> = {
  all: 'Все назначения',
  income: 'Доходы и возвраты',
  expense: 'Расходы ИП',
  tax: 'Налоги и взносы',
  review: 'Требует проверки',
}

function line(kind: AllocationKind, amount = ''): AllocationLine {
  return {
    key: `${Date.now()}-${Math.random()}`,
    kind,
    amount,
    category: '',
    taxPaymentKind: kind === 'tax_payment' ? 'usn' : null,
    taxPeriod: null,
    obligationId: null,
    comment: '',
  }
}

function directionFor(transaction: Transaction): Direction {
  return transaction.type === 'income' || transaction.type === 'return_expense' ? 'in' : 'out'
}

function transactionType(direction: Direction, allocations: AllocationLine[]): Transaction['type'] {
  if (direction === 'in' && allocations.every(item => item.kind === 'business_expense_refund')) return 'return_expense'
  if (direction === 'out' && allocations.every(item => item.kind === 'income_return')) return 'return_income'
  return direction === 'in' ? 'income' : 'expense'
}

export default function IncomeExpenses() {
  const { currentIp } = useAppStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [allocations, setAllocations] = useState<TransactionAllocation[]>([])
  const [obligations, setObligations] = useState<TaxObligation[]>([])
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    direction: 'in' as Direction,
    amount: '',
    counterparty: '',
    comment: '',
  })
  const [lines, setLines] = useState<AllocationLine[]>([line('taxable_income')])

  const openNew = useCallback((direction: Direction = 'in') => {
    setEditingTx(null)
    setError('')
    setForm({
      date: new Date().toISOString().slice(0, 10),
      direction,
      amount: '',
      counterparty: '',
      comment: '',
    })
    setLines([line(direction === 'in' ? 'taxable_income' : 'business_expense')])
    setDialogOpen(true)
  }, [])

  const loadData = useCallback(async () => {
    if (!currentIp?.id) return
    const [txs, parts, dues] = await Promise.all([
      transactionRepo.getAll(currentIp.id),
      allocationRepo.getAll(currentIp.id),
      taxCalcRepo.getAll(currentIp.id),
    ])
    setTransactions(txs)
    setAllocations(parts)
    setObligations(dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
  }, [currentIp?.id])

  useEffect(() => { void loadData() }, [loadData])

  useEffect(() => {
    const type = searchParams.get('type')
    if (type === 'income' || type === 'expense') {
      openNew(type === 'income' ? 'in' : 'out')
      setSearchParams({})
    }
  }, [openNew, searchParams, setSearchParams])

  const partsByTransaction = useMemo(() => {
    const map = new Map<number, TransactionAllocation[]>()
    allocations.forEach(item => {
      const current = map.get(item.transactionId) ?? []
      current.push(item)
      map.set(item.transactionId, current)
    })
    return map
  }, [allocations])

  const filtered = transactions.filter(transaction => {
    if (filterMonth !== 'all' && !transaction.date.startsWith(filterMonth)) return false
    const kinds = transaction.id && partsByTransaction.get(transaction.id)?.length
      ? partsByTransaction.get(transaction.id)!.map(item => item.kind)
      : [legacyAllocationKind(transaction)]
    if (filterType === 'income' && !kinds.some(kind => kind === 'taxable_income' || kind === 'income_return')) return false
    if (filterType === 'expense' && !kinds.some(kind => kind === 'business_expense' || kind === 'business_expense_refund')) return false
    if (filterType === 'tax' && !kinds.includes('tax_payment')) return false
    if (filterType === 'review' && !kinds.includes('needs_review')) return false
    return true
  })
  const summary = summarizeLedger(filtered, allocations)

  const handleEdit = async (transaction: Transaction) => {
    const stored = transaction.id ? await allocationRepo.getForTransaction(transaction.id) : []
    const direction = directionFor(transaction)
    setEditingTx(transaction)
    setError('')
    setForm({
      date: transaction.date,
      direction,
      amount: transaction.amount,
      counterparty: transaction.counterparty,
      comment: transaction.comment,
    })
    setLines(stored.length ? stored.map(item => ({
      key: String(item.id),
      kind: item.kind,
      amount: item.amount,
      category: item.category,
      taxPaymentKind: item.taxPaymentKind,
      taxPeriod: item.taxPeriod,
      obligationId: item.obligationId,
      comment: item.comment,
    })) : [line(legacyAllocationKind(transaction), transaction.amount)])
    setDialogOpen(true)
  }

  const changeDirection = (direction: Direction) => {
    setForm(current => ({ ...current, direction }))
    setLines([line(direction === 'in' ? 'taxable_income' : 'business_expense', form.amount)])
  }

  const updateLine = (key: string, changes: Partial<AllocationLine>) => {
    setLines(current => current.map(item => item.key === key ? { ...item, ...changes } : item))
  }

  const handleAmount = (amount: string) => {
    setForm(current => ({ ...current, amount }))
    if (lines.length === 1) updateLine(lines[0].key, { amount })
  }

  const handleSave = async () => {
    if (!currentIp?.id) return
    setError('')
    if (!form.date || !d(form.amount || 0).gt(0)) {
      setError('Укажите дату и сумму больше нуля.')
      return
    }
    if (lines.some(item => !d(item.amount || 0).gt(0)) || !validateAllocationTotal(form.amount, lines)) {
      setError(`Распределите ровно ${formatCurrency(form.amount || 0)} между частями.`)
      return
    }
    try {
      await operationRepo.save({
        id: editingTx?.id,
        ipId: currentIp.id,
        date: form.date,
        type: transactionType(form.direction, lines),
        amount: d(form.amount).toFixed(2),
        category: lines.length === 1 ? lines[0].category : 'Разделённая операция',
        counterparty: form.counterparty,
        comment: form.comment,
        usnRelevant: lines.some(item => item.kind === 'taxable_income' || item.kind === 'income_return'),
        ndsRelevant: false,
        period: form.date.slice(0, 7),
        importSource: editingTx?.importSource ?? null,
        importBatchId: editingTx?.importBatchId ?? null,
        status: lines.some(item => item.kind === 'needs_review') ? 'needs_review' : 'accounted',
      }, lines.map(({ key: _key, ...item }) => item))
      setDialogOpen(false)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить операцию.')
    }
  }

  const handleDelete = async (transaction: Transaction) => {
    if (!transaction.id || !window.confirm('Удалить операцию и связанный с ней налоговый платёж?')) return
    await operationRepo.remove(transaction.id)
    await loadData()
  }

  const handleExport = () => {
    exportToCSV(filtered.map(transaction => ({
      Дата: transaction.date,
      Направление: directionFor(transaction) === 'in' ? 'Поступление' : 'Списание',
      Сумма: transaction.amount,
      Назначения: (transaction.id && partsByTransaction.get(transaction.id)?.length
        ? partsByTransaction.get(transaction.id)!.map(item => ALLOCATION_LABELS[item.kind])
        : [ALLOCATION_LABELS[legacyAllocationKind(transaction)]]).join('; '),
      Контрагент: transaction.counterparty,
      Комментарий: transaction.comment,
    })), `operacii_${currentIp?.year ?? 2026}.csv`)
  }

  const handleKudirExport = () => {
    let row = 0
    const data = transactions
      .filter(transaction => transaction.date.startsWith(String(currentIp?.year)))
      .flatMap(transaction => {
        const parts = transaction.id && partsByTransaction.get(transaction.id)?.length
          ? partsByTransaction.get(transaction.id)!
          : [{ kind: legacyAllocationKind(transaction), amount: transaction.amount, category: transaction.category }]
        return parts
          .filter(part => part.kind === 'taxable_income' || part.kind === 'income_return')
          .map(part => ({
            '№': ++row,
            'Дата и документ': transaction.date,
            'Содержание операции': part.category || transaction.counterparty || transaction.comment,
            'Доходы, учитываемые при УСН': part.kind === 'income_return'
              ? d(part.amount).negated().toFixed(2)
              : d(part.amount).toFixed(2),
            'Расходы, учитываемые при УСН': '0.00',
          }))
      })
    exportToCSV(data, `kudir_razdel_1_${currentIp?.year ?? 2026}.csv`)
  }

  if (!currentIp) return null

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ДЕНЕЖНЫЙ ПОТОК</p>
          <h1>Операции</h1>
          <p>Разделяйте одно списание на обычный расход, налог и личную часть.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleKudirExport}><Download className="size-4" /> КУДиР</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="size-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}><Upload className="size-4" /> Импорт</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" onClick={() => openNew('in')} />}>
              <Plus className="size-4" /> Добавить
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTx ? 'Редактировать операцию' : 'Новая операция'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="segmented-control">
                  <button className={form.direction === 'in' ? 'active' : ''} onClick={() => changeDirection('in')}>
                    <ArrowDownLeft className="size-4" /> Деньги пришли
                  </button>
                  <button className={form.direction === 'out' ? 'active' : ''} onClick={() => changeDirection('out')}>
                    <ArrowUpRight className="size-4" /> Деньги ушли
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Дата</Label><Input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div>
                  <div className="space-y-2"><Label>Общая сумма, ₽</Label><Input inputMode="decimal" type="number" min="0" value={form.amount} onChange={event => handleAmount(event.target.value)} placeholder="0,00" /></div>
                  <div className="space-y-2"><Label>Контрагент</Label><Input value={form.counterparty} onChange={event => setForm({ ...form, counterparty: event.target.value })} placeholder="Название или ФИО" /></div>
                  <div className="space-y-2"><Label>Комментарий</Label><Input value={form.comment} onChange={event => setForm({ ...form, comment: event.target.value })} placeholder="Необязательно" /></div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Распределение</Label>
                      <p className="text-xs text-muted-foreground mt-1">Расход ИП не уменьшает налоговую базу УСН «Доходы».</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLines(current => [...current, line(form.direction === 'in' ? 'non_taxable' : 'business_expense')])}>
                      <Split className="size-4" /> Разделить
                    </Button>
                  </div>
                  {lines.map((item, index) => (
                    <div key={item.key} className="allocation-row">
                      <div className="allocation-index">{index + 1}</div>
                      <div className="grid sm:grid-cols-2 gap-3 flex-1">
                        <div className="space-y-1.5">
                          <Label>Назначение</Label>
                          <Select value={item.kind} onValueChange={value => updateLine(item.key, {
                            kind: value as AllocationKind,
                            taxPaymentKind: value === 'tax_payment' ? (item.taxPaymentKind ?? 'usn') : null,
                            obligationId: value === 'tax_payment' ? item.obligationId : null,
                          })}>
                            <SelectTrigger className="w-full min-w-0"><SelectValue>{ALLOCATION_LABELS[item.kind]}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {(form.direction === 'in' ? incomingKinds : outgoingKinds).map(kind => <SelectItem key={kind} value={kind}>{ALLOCATION_LABELS[kind]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5"><Label>Сумма, ₽</Label><Input type="number" min="0" value={item.amount} onChange={event => updateLine(item.key, { amount: event.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Категория / назначение</Label><Input value={item.category} onChange={event => updateLine(item.key, { category: event.target.value })} placeholder={item.kind === 'tax_payment' ? 'Например, аванс УСН' : 'Например, аренда'} /></div>
                        {item.kind === 'tax_payment' && (
                          <div className="space-y-1.5">
                            <Label>Какой платёж закрывает</Label>
                            <Select value={item.obligationId ? String(item.obligationId) : 'none'} onValueChange={value => {
                              const obligation = obligations.find(entry => entry.id === Number(value))
                              updateLine(item.key, {
                                obligationId: value === 'none' ? null : Number(value),
                                taxPeriod: obligation?.period ?? null,
                                taxPaymentKind: obligation?.type === 'ip_premium_fixed'
                                  ? 'fixed_premium'
                                  : obligation?.type === 'ip_premium_additional' ? 'additional_premium' : 'usn',
                              })
                            }}>
                              <SelectTrigger className="w-full min-w-0"><SelectValue>{item.obligationId
                                ? (() => {
                                    const obligation = obligations.find(entry => entry.id === item.obligationId)
                                    return obligation ? `${obligationLabels[obligation.type]} · ${formatObligationPeriod(obligation)}` : 'Обязательство не найдено'
                                  })()
                                : 'ЕНП без распределения'}</SelectValue></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">ЕНП без распределения</SelectItem>
                                {obligations.filter(entry => d(entry.amount).gt(d(entry.paidAmount))).map(entry => (
                                  <SelectItem key={entry.id} value={String(entry.id)}>{obligationLabels[entry.type]} · {formatObligationPeriod(entry)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {lines.length > 1 && <Button variant="ghost" size="icon" onClick={() => setLines(current => current.filter(lineItem => lineItem.key !== item.key))}><Trash2 className="size-4" /></Button>}
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Распределено</span>
                    <span className={validateAllocationTotal(form.amount || '0', lines) ? 'font-semibold' : 'font-semibold text-amber-600'}>
                      {formatCurrency(lines.reduce((sum, item) => sum.plus(d(item.amount || 0)), d(0)).toFixed(2))} из {formatCurrency(form.amount || 0)}
                    </span>
                  </div>
                </div>
                {error && <p className="form-error">{error}</p>}
                <Button className="w-full" onClick={handleSave}>{editingTx ? 'Сохранить изменения' : 'Добавить операцию'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="metric-grid">
        <Card className="metric-card"><CardContent><span>Доход УСН</span><MoneyDisplay amount={summary.netIncome} size="lg" /><small>с учётом возвратов</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Расходы ИП</span><MoneyDisplay amount={summary.netExpenses} size="lg" /><small>только для статистики</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Налоги и взносы</span><MoneyDisplay amount={summary.taxPayments} size="lg" /><small>не уменьшают базу как расход</small></CardContent></Card>
      </div>

      <div className="toolbar-card">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue>{filterMonth === 'all'
            ? `Весь ${currentIp.year} год`
            : new Date(`${filterMonth}-01T00:00:00`).toLocaleDateString('ru-RU', { month: 'long' })}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Весь {currentIp.year} год</SelectItem>
            {Array.from({ length: 12 }, (_, index) => <SelectItem key={index} value={`${currentIp.year}-${String(index + 1).padStart(2, '0')}`}>{new Date(currentIp.year, index).toLocaleDateString('ru-RU', { month: 'long' })}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue>{operationFilterLabels[filterType]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все назначения</SelectItem>
            <SelectItem value="income">Доходы и возвраты</SelectItem>
            <SelectItem value="expense">Расходы ИП</SelectItem>
            <SelectItem value="tax">Налоги и взносы</SelectItem>
            <SelectItem value="review">Требует проверки</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground sm:ml-auto">{filtered.length} операций</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Пока нет операций" description="Добавьте поступление вручную или импортируйте банковскую выписку" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Операция</TableHead><TableHead>Учёт</TableHead><TableHead className="text-right">Сумма</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
              <TableBody>
                {filtered.map(transaction => {
                  const parts = transaction.id && partsByTransaction.get(transaction.id)?.length
                    ? partsByTransaction.get(transaction.id)!
                    : [{ kind: legacyAllocationKind(transaction), amount: transaction.amount } as TransactionAllocation]
                  const incoming = directionFor(transaction) === 'in'
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{transaction.date}</TableCell>
                      <TableCell><p className="font-medium">{transaction.counterparty || 'Без контрагента'}</p><p className="text-xs text-muted-foreground mt-0.5">{transaction.comment || transaction.category || 'Без комментария'}</p></TableCell>
                      <TableCell><div className="flex flex-wrap gap-1">{parts.map((part, index) => <Badge key={`${part.kind}-${index}`} variant="outline">{ALLOCATION_LABELS[part.kind]}{parts.length > 1 ? ` · ${formatCurrency(part.amount)}` : ''}</Badge>)}</div></TableCell>
                      <TableCell className={`text-right font-mono tabular-nums font-semibold ${incoming ? 'text-emerald-600' : ''}`}>{incoming ? '+' : '−'}{formatCurrency(transaction.amount)}</TableCell>
                      <TableCell><div className="flex"><Button variant="ghost" size="icon" onClick={() => handleEdit(transaction)}><Edit3 className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(transaction)}><Trash2 className="size-4 text-red-500" /></Button></div></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} ipId={currentIp.id!} onImported={loadData} />
    </div>
  )
}
