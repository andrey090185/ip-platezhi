import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { HowCalculated } from '@/components/shared/HowCalculated'
import { employeeRepo } from '@/db/repositories/employeeRepo'
import { payrollRepo } from '@/db/repositories/payrollRepo'
import { calcNdflForPeriod, NDFL_BRACKETS } from '@/engine/ndflFormulas'
import { d, dMul, dToString } from '@/engine/decimal'
import type { Employee, PayrollRecord } from '@/types'
import { Calculator, Users } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'

export default function Payroll() {
  const { currentIp, taxSettings } = useAppStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [payrollData, setPayrollData] = useState<Record<number, {
    baseSalary: string
    bonus: string
    sickLeave: string
    nonTaxable: string
    deductions: string
  }>>({})

  useEffect(() => {
    if (currentIp?.id) loadData()
  }, [currentIp, selectedPeriod])

  const loadData = async () => {
    if (!currentIp?.id) return
    const emps = await employeeRepo.getActive(currentIp.id)
    setEmployees(emps)
    const recs = await payrollRepo.getByPeriod(currentIp.id, selectedPeriod)
    setRecords(recs)

    const initial: typeof payrollData = {}
    emps.forEach(emp => {
      const existing = recs.find(r => r.employeeId === emp.id)
      initial[emp.id!] = {
        baseSalary: existing?.baseSalary || emp.salary,
        bonus: existing?.bonus || '0',
        sickLeave: existing?.sickLeave || '0',
        nonTaxable: existing?.nonTaxable || '0',
        deductions: existing?.deductions || '0',
      }
    })
    setPayrollData(initial)
  }

  const calcPayroll = (emp: Employee, data: typeof payrollData[0]) => {
    const baseSalary = d(data.baseSalary)
    const bonus = d(data.bonus)
    const sickLeave = d(data.sickLeave)
    const nonTaxable = d(data.nonTaxable)
    const deductions = d(data.deductions)

    const totalIncome = baseSalary.plus(bonus).plus(sickLeave)
    const taxableIncome = totalIncome.minus(nonTaxable).minus(deductions)

    const year = parseInt(selectedPeriod.split('-')[0])
    const ndflResult = calcNdflForPeriod(
      emp.fullName,
      taxableIncome.toFixed(2),
      '0',
      '0',
      1,
      22
    )

    const netPay = totalIncome.minus(d(ndflResult.ndflAmount))
    const insuranceRate = d(taxSettings?.insuranceMainRate || 30).div(100)
    const insurance = dMul(totalIncome, insuranceRate)

    const traumaRate = emp.traumaRate ? parseFloat(emp.traumaRate) : (taxSettings?.traumaRate || 0.2)
    const trauma = dMul(totalIncome, d(traumaRate).div(100))

    return {
      totalIncome: totalIncome.toFixed(2),
      ndfl: ndflResult.ndflAmount,
      ndflFormula: ndflResult.formula,
      netPay: netPay.toFixed(2),
      insurance: insurance.toFixed(2),
      trauma: trauma.toFixed(2),
    }
  }

  const handleSave = async () => {
    if (!currentIp?.id) return
    const now = new Date().toISOString()
    const periodType = parseInt(selectedPeriod.split('-')[1]) <= 15 ? 'first_half' : 'second_half'

    for (const emp of employees) {
      if (!emp.id || !payrollData[emp.id]) continue
      const data = payrollData[emp.id]
      const calc = calcPayroll(emp, data)

      const existing = records.find(r => r.employeeId === emp.id)
      if (existing?.id) {
        await payrollRepo.update(existing.id, {
          baseSalary: data.baseSalary,
          bonus: data.bonus,
          sickLeave: data.sickLeave,
          nonTaxable: data.nonTaxable,
          deductions: data.deductions,
          ndflAmount: calc.ndfl,
          netPay: calc.netPay,
          insuranceAmount: calc.insurance,
          traumaAmount: calc.trauma,
          totalIncomeYtd: calc.totalIncome,
          ndflRate: '13%',
        })
      } else {
        await payrollRepo.add({
          ipId: currentIp.id,
          employeeId: emp.id,
          period: selectedPeriod,
          periodType,
          baseSalary: data.baseSalary,
          bonus: data.bonus,
          sickLeave: data.sickLeave,
          nonTaxable: data.nonTaxable,
          deductions: data.deductions,
          ndflAmount: calc.ndfl,
          netPay: calc.netPay,
          insuranceAmount: calc.insurance,
          traumaAmount: calc.trauma,
          totalIncomeYtd: calc.totalIncome,
          ndflRate: '13%',
          ndflManualOverride: null,
          insuranceManualOverride: null,
          overrideReason: '',
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    loadData()
  }

  if (!currentIp) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Зарплата</h1>
          <p className="text-muted-foreground">Начисление зарплаты и расчёт налогов</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={`${currentIp.year}-${String(i + 1).padStart(2, '0')}`}>
                  {new Date(currentIp.year, i).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave}>
            <Calculator className="w-4 h-4 mr-1" /> Сохранить начисления
          </Button>
        </div>
      </div>

      {employees.length === 0 ? (
        <EmptyState
          title="Нет активных сотрудников"
          description="Добавьте сотрудников на странице «Сотрудники»"
          icon={<Users className="w-6 h-6 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-4">
          {employees.map(emp => {
            const data = payrollData[emp.id!] || { baseSalary: emp.salary, bonus: '0', sickLeave: '0', nonTaxable: '0', deductions: '0' }
            const calc = calcPayroll(emp, data)
            return (
              <Card key={emp.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{emp.fullName}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      Таб. №{emp.personnelNumber} · {emp.contractType === 'labor' ? 'Трудовой' : 'ГПХ'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Оклад (₽)</Label>
                      <Input
                        type="number"
                        value={data.baseSalary}
                        onChange={(e) => setPayrollData({ ...payrollData, [emp.id!]: { ...data, baseSalary: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Премия (₽)</Label>
                      <Input
                        type="number"
                        value={data.bonus}
                        onChange={(e) => setPayrollData({ ...payrollData, [emp.id!]: { ...data, bonus: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Больничные (₽)</Label>
                      <Input
                        type="number"
                        value={data.sickLeave}
                        onChange={(e) => setPayrollData({ ...payrollData, [emp.id!]: { ...data, sickLeave: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Необлагаемые (₽)</Label>
                      <Input
                        type="number"
                        value={data.nonTaxable}
                        onChange={(e) => setPayrollData({ ...payrollData, [emp.id!]: { ...data, nonTaxable: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Вычеты (₽)</Label>
                      <Input
                        type="number"
                        value={data.deductions}
                        onChange={(e) => setPayrollData({ ...payrollData, [emp.id!]: { ...data, deductions: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">НДФЛ</Label>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm">{formatCurrency(calc.ndfl)}</span>
                        <HowCalculated formula={calc.ndflFormula} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Начислено</p>
                      <MoneyDisplay amount={calc.totalIncome} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">НДФЛ</p>
                      <MoneyDisplay amount={calc.ndfl} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Страховые взносы</p>
                      <MoneyDisplay amount={calc.insurance} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Травматизм</p>
                      <MoneyDisplay amount={calc.trauma} className="text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Начисленные записи за период</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Начислено</TableHead>
                  <TableHead>НДФЛ</TableHead>
                  <TableHead>Взносы</TableHead>
                  <TableHead>Травматизм</TableHead>
                  <TableHead>К выплате</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(rec => {
                  const emp = employees.find(e => e.id === rec.employeeId)
                  return (
                    <TableRow key={rec.id}>
                      <TableCell>{emp?.fullName || '-'}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(rec.baseSalary)}</TableCell>
                      <TableCell className="font-mono text-red-600">{formatCurrency(rec.ndflAmount)}</TableCell>
                      <TableCell className="font-mono text-blue-600">{formatCurrency(rec.insuranceAmount)}</TableCell>
                      <TableCell className="font-mono text-orange-600">{formatCurrency(rec.traumaAmount)}</TableCell>
                      <TableCell className="font-mono font-medium">{formatCurrency(rec.netPay)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
