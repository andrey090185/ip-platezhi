import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { employeeRepo } from '@/db/repositories/employeeRepo'
import type { Employee } from '@/types'
import { Plus, Archive, Edit, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'

export default function Employees() {
  const { currentIp } = useAppStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  const [form, setForm] = useState({
    fullName: '',
    personnelNumber: '',
    hireDate: new Date().toISOString().split('T')[0],
    fireDate: '',
    contractType: 'labor' as Employee['contractType'],
    salary: '',
    traumaRate: '',
    reducedTariff: false,
  })

  useEffect(() => {
    if (currentIp?.id) loadEmployees()
  }, [currentIp])

  const loadEmployees = async () => {
    if (!currentIp?.id) return
    const emps = await employeeRepo.getAll(currentIp.id)
    setEmployees(emps)
  }

  const handleSave = async () => {
    if (!currentIp?.id || !form.fullName || !form.salary) return
    const now = new Date().toISOString()
    if (editingEmp?.id) {
      await employeeRepo.update(editingEmp.id, {
        ...form,
        fireDate: form.fireDate || null,
        traumaRate: form.traumaRate || null,
        taxResidentStatus: 'resident',
        status: 'active',
      })
    } else {
      await employeeRepo.add({
        ipId: currentIp.id,
        ...form,
        fireDate: form.fireDate || null,
        traumaRate: form.traumaRate || null,
        taxResidentStatus: 'resident',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
    }
    setDialogOpen(false)
    setEditingEmp(null)
    setForm({
      fullName: '', personnelNumber: '',
      hireDate: new Date().toISOString().split('T')[0],
      fireDate: '', contractType: 'labor', salary: '', traumaRate: '', reducedTariff: false,
    })
    loadEmployees()
  }

  const handleArchive = async (emp: Employee) => {
    if (emp.id) {
      const hasPayroll = await employeeRepo.hasPayroll(emp.id)
      if (hasPayroll) {
        await employeeRepo.archive(emp.id)
      } else {
        await employeeRepo.archive(emp.id)
      }
      loadEmployees()
    }
  }

  const handleEdit = (emp: Employee) => {
    setEditingEmp(emp)
    setForm({
      fullName: emp.fullName,
      personnelNumber: emp.personnelNumber,
      hireDate: emp.hireDate,
      fireDate: emp.fireDate || '',
      contractType: emp.contractType,
      salary: emp.salary,
      traumaRate: emp.traumaRate || '',
      reducedTariff: emp.reducedTariff,
    })
    setDialogOpen(true)
  }

  const activeCount = employees.filter(e => e.status === 'active').length
  const archivedCount = employees.filter(e => e.status === 'archived').length

  if (!currentIp) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Сотрудники</h1>
          <p className="text-muted-foreground">
            Активных: {activeCount} · Архивных: {archivedCount}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" onClick={() => {
            setEditingEmp(null)
            setForm({ fullName: '', personnelNumber: '', hireDate: new Date().toISOString().split('T')[0], fireDate: '', contractType: 'labor', salary: '', traumaRate: '', reducedTariff: false })
          }} />}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingEmp ? 'Редактировать сотрудника' : 'Новый сотрудник'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ФИО</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Табельный номер</Label>
                <Input value={form.personnelNumber} onChange={(e) => setForm({ ...form, personnelNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Дата приёма</Label>
                  <Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Дата увольнения</Label>
                  <Input type="date" value={form.fireDate} onChange={(e) => setForm({ ...form, fireDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Тип договора</Label>
                <Select value={form.contractType} onValueChange={(v) => setForm({ ...form, contractType: v as Employee['contractType'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">Трудовой</SelectItem>
                    <SelectItem value="gph">ГПХ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Оклад (₽)</Label>
                <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Индивидуальная ставка травматизма (%)</Label>
                <Input type="number" value={form.traumaRate} onChange={(e) => setForm({ ...form, traumaRate: e.target.value })} placeholder="По умолчанию" step="0.1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.reducedTariff} onChange={(e) => setForm({ ...form, reducedTariff: e.target.checked })} />
                Пониженный тариф взносов
              </label>
              <Button onClick={handleSave} className="w-full">
                {editingEmp ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeCount > 10 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              При {activeCount} сотрудниках отчётность сдаётся только в электронном виде
            </p>
          </CardContent>
        </Card>
      )}

      {employees.length === 0 ? (
        <EmptyState title="Пока нет сотрудников" description="Добавьте первого сотрудника" />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Таб. номер</TableHead>
                <TableHead>Договор</TableHead>
                <TableHead>Оклад</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.fullName}</TableCell>
                  <TableCell>{emp.personnelNumber}</TableCell>
                  <TableCell>
                    <Badge variant={emp.contractType === 'labor' ? 'default' : 'secondary'}>
                      {emp.contractType === 'labor' ? 'Трудовой' : 'ГПХ'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{formatCurrency(emp.salary)}</TableCell>
                  <TableCell>
                    <Badge variant={emp.status === 'active' ? 'default' : 'secondary'}>
                      {emp.status === 'active' ? 'Активен' : 'Архив'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(emp)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      {emp.status === 'active' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchive(emp)}>
                          <Archive className="w-3.5 h-3.5 text-amber-500" />
                        </Button>
                      )}
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
