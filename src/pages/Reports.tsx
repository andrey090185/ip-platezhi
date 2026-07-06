import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { payrollRepo } from '@/db/repositories/payrollRepo'
import { exportToCSV } from '@/utils/csv'
import { generatePdf } from '@/utils/pdf'
import { Download, FileText } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'

export default function Reports() {
  const { currentIp, taxSettings } = useAppStore()
  const [usnSummary, setUsnSummary] = useState({ income: '0', expenses: '0', base: '0' })
  const [payrollSummary, setPayrollSummary] = useState<any[]>([])
  const [totalNdf, setTotalNdf] = useState('0')
  const [totalInsurance, setTotalInsurance] = useState('0')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentIp?.id) loadSummaries()
  }, [currentIp])

  const loadSummaries = async () => {
    if (!currentIp?.id) return
    const year = currentIp.year
    const { income, expenses } = await transactionRepo.getYearTotals(currentIp.id, year)
    const base = parseFloat(income) - parseFloat(expenses)
    setUsnSummary({ income, expenses, base: base.toFixed(2) })

    const records = await payrollRepo.getAll(currentIp.id)
    const yearRecords = records.filter(r => r.period.startsWith(String(year)))
    const empMap = new Map<number, any>()
    for (const rec of yearRecords) {
      const existing = empMap.get(rec.employeeId) || { salary: 0, ndfl: 0, insurance: 0, trauma: 0 }
      existing.salary += parseFloat(rec.baseSalary || '0')
      existing.ndfl += parseFloat(rec.ndflAmount || '0')
      existing.insurance += parseFloat(rec.insuranceAmount || '0')
      existing.trauma += parseFloat(rec.traumaAmount || '0')
      empMap.set(rec.employeeId, existing)
    }

    const summary = Array.from(empMap.entries()).map(([empId, data]) => ({
      employeeId: empId,
      ...data,
    }))
    setPayrollSummary(summary)

    const totalN = yearRecords.reduce((a, r) => a + parseFloat(r.ndflAmount || '0'), 0)
    const totalI = yearRecords.reduce((a, r) => a + parseFloat(r.insuranceAmount || '0'), 0)
    setTotalNdf(totalN.toFixed(2))
    setTotalInsurance(totalI.toFixed(2))
  }

  const handleExportCSV = () => {
    const data = [
      { 'Показатель': 'Доходы за год', 'Сумма': usnSummary.income },
      { 'Показатель': 'Расходы за год', 'Сумма': usnSummary.expenses },
      { 'Показатель': 'База УСН', 'Сумма': usnSummary.base },
      { 'Показатель': 'Итого НДФЛ', 'Сумма': totalNdf },
      { 'Показатель': 'Итого страховые взносы', 'Сумма': totalInsurance },
    ]
    exportToCSV(data, `svodka_${currentIp?.year || 2026}.csv`)
  }

  const handleExportPDF = () => {
    if (printRef.current) {
      generatePdf(printRef.current, `svodka_${currentIp?.year || 2026}.pdf`)
    }
  }

  if (!currentIp) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Отчёты и экспорт</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Сводка по УСН за {currentIp.year} год</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Доходы</p>
                <MoneyDisplay amount={usnSummary.income} size="lg" className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Расходы</p>
                <MoneyDisplay amount={usnSummary.expenses} size="lg" className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">База УСН</p>
                <MoneyDisplay amount={usnSummary.base} size="lg" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сводка по зарплатным налогам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Итого НДФЛ</p>
                <MoneyDisplay amount={totalNdf} size="lg" className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Итого страховые взносы</p>
                <MoneyDisplay amount={totalInsurance} size="lg" className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сводка по сотрудникам</CardTitle>
          </CardHeader>
          <CardContent>
            {payrollSummary.length === 0 ? (
              <EmptyState title="Нет данных по сотрудникам" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Начислено</TableHead>
                    <TableHead>НДФЛ</TableHead>
                    <TableHead>Взносы</TableHead>
                    <TableHead>Травматизм</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollSummary.map((row: any) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>Сотрудник #{row.employeeId}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(row.salary)}</TableCell>
                      <TableCell className="font-mono text-red-600">{formatCurrency(row.ndfl)}</TableCell>
                      <TableCell className="font-mono text-blue-600">{formatCurrency(row.insurance)}</TableCell>
                      <TableCell className="font-mono text-orange-600">{formatCurrency(row.trauma)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Данная сводка не является юридически значимой декларацией и не отправляется в ФНС/СФР.
      </p>
    </div>
  )
}
