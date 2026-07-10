import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { exportToCSV } from '@/utils/csv'
import { generatePdf } from '@/utils/pdf'
import { Download, FileText } from 'lucide-react'

export default function Reports() {
  const { currentIp, taxSettings } = useAppStore()
  const [usnSummary, setUsnSummary] = useState({ income: '0', expenses: '0', base: '0' })
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentIp?.id) loadSummaries()
  }, [currentIp])

  const loadSummaries = async () => {
    if (!currentIp?.id) return
    const year = currentIp.year
    const { income, expenses } = await transactionRepo.getYearTotals(currentIp.id, year)
    const base = currentIp.usnObject === 'income' ? parseFloat(income) : parseFloat(income) - parseFloat(expenses)
    setUsnSummary({ income, expenses, base: base.toFixed(2) })
  }

  const handleExportCSV = () => {
    const data = [
      { 'Показатель': 'Доходы за год', 'Сумма': usnSummary.income },
      { 'Показатель': 'Расходы за год', 'Сумма': usnSummary.expenses },
      { 'Показатель': 'База УСН', 'Сумма': usnSummary.base },
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
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Данная сводка не является юридически значимой декларацией и не отправляется в ФНС/СФР.
      </p>
    </div>
  )
}
