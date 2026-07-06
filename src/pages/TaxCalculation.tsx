import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { HowCalculated } from '@/components/shared/HowCalculated'
import { ManualOverride } from '@/components/shared/ManualOverride'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { payrollRepo } from '@/db/repositories/payrollRepo'
import { employeeRepo } from '@/db/repositories/employeeRepo'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { calcUsnAdvance, calcUsnAnnual } from '@/engine/usnFormulas'
import { calcFixedPremium, calcAdditionalPremium, calcEmployeeInsurance } from '@/engine/insuranceFormulas'
import { getEffectiveRate } from '@/engine/taxRules'
import { formatDate } from '@/engine/dateUtils'
import { formatCurrency } from '@/utils/currency'
import { d, dSum } from '@/engine/decimal'
import { RefreshCw } from 'lucide-react'

export default function TaxCalculation() {
  const { currentIp, taxSettings } = useAppStore()
  const [usnResult, setUsnResult] = useState<any>(null)
  const [ipPremiumResult, setIpPremiumResult] = useState<any>(null)
  const [additionalResult, setAdditionalResult] = useState<any>(null)
  const [employeeResults, setEmployeeResults] = useState<any[]>([])
  const [ndflSummary, setNdflSummary] = useState({ total: '0', byEmployee: [] as any[] })
  const [traumaSummary, setTraumaSummary] = useState({ total: '0', byEmployee: [] as any[] })

  useEffect(() => {
    if (currentIp?.id && taxSettings) calculate()
  }, [currentIp, taxSettings])

  const calculate = async () => {
    if (!currentIp?.id || !taxSettings) return
    const ipId = currentIp.id
    const year = currentIp.year
    const quarter = Math.ceil((new Date().getMonth() + 1) / 3)

    const { income, expenses } = await transactionRepo.getYearTotals(ipId, year)
    const employees = await employeeRepo.getActive(ipId)
    const hasEmployees = employees.length > 0

    const fixedPremium = calcFixedPremium(taxSettings)
    setIpPremiumResult(fixedPremium)

    const additional = calcAdditionalPremium(taxSettings, income)
    setAdditionalResult(additional)

    const usn = calcUsnAdvance(
      taxSettings, income, expenses,
      fixedPremium.annualAmount,
      '0',
      '0',
      quarter,
      hasEmployees,
      currentIp.usnObject
    )
    setUsnResult(usn)

    const empResults = []
    let totalInsurance = d(0)
    let totalTrauma = d(0)
    const allPayrollRecords = await payrollRepo.getAll(ipId)
    const yearRecords = allPayrollRecords.filter(r => r.period.startsWith(String(year)))

    for (const emp of employees) {
      const empRecords = yearRecords.filter(r => r.employeeId === emp.id)
      const ytdIncome = empRecords.reduce((a, r) => a + parseFloat(r.baseSalary || '0'), 0).toFixed(2)
      const empInsurance = calcEmployeeInsurance(taxSettings, emp.fullName, ytdIncome)
      empResults.push(empInsurance)
      totalInsurance = totalInsurance.plus(d(empInsurance.totalInsurance))

      const traumaRate = emp.traumaRate ? parseFloat(emp.traumaRate) : taxSettings.traumaRate
      const trauma = d(ytdIncome).times(d(traumaRate).div(100))
      totalTrauma = totalTrauma.plus(trauma)
    }
    setEmployeeResults(empResults)

    const totalNdfl = yearRecords.reduce((a, r) => a + parseFloat(r.ndflAmount || '0'), 0)
    setNdflSummary({
      total: totalNdfl.toFixed(2),
      byEmployee: employees.map(emp => {
        const empRecords = yearRecords.filter(r => r.employeeId === emp.id)
        return {
          name: emp.fullName,
          total: empRecords.reduce((a, r) => a + parseFloat(r.ndflAmount || '0'), 0).toFixed(2),
        }
      })
    })

    setTraumaSummary({
      total: totalTrauma.toFixed(2),
      byEmployee: employees.map(emp => {
        const traumaRate = emp.traumaRate ? parseFloat(emp.traumaRate) : taxSettings.traumaRate
        const empRecords = yearRecords.filter(r => r.employeeId === emp.id)
        const ytdIncome = empRecords.reduce((a, r) => a + parseFloat(r.baseSalary || '0'), 0).toFixed(2)
        return {
          name: emp.fullName,
          total: d(ytdIncome).times(d(traumaRate).div(100)).toFixed(2),
        }
      })
    })
  }

  if (!currentIp || !taxSettings) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Расчёт налогов</h1>
        <Button variant="outline" size="sm" onClick={calculate}>
          <RefreshCw className="w-4 h-4 mr-1" /> Пересчитать
        </Button>
      </div>

      <Tabs defaultValue="usn">
        <TabsList className="flex-wrap">
          <TabsTrigger value="usn">УСН</TabsTrigger>
          <TabsTrigger value="premium">Взносы ИП</TabsTrigger>
          {currentIp.hasEmployees && <TabsTrigger value="ndfl">НДФЛ</TabsTrigger>}
          {currentIp.hasEmployees && <TabsTrigger value="insurance">Страховые</TabsTrigger>}
          {currentIp.hasEmployees && <TabsTrigger value="trauma">Травматизм</TabsTrigger>}
        </TabsList>

        <TabsContent value="usn" className="space-y-4">
          {usnResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  УСН «{currentIp.usnObject === 'income' ? 'Доходы' : 'Доходы минус расходы'}»
                  <HowCalculated formula={usnResult.formula} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">База</p>
                    <MoneyDisplay amount={usnResult.base} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ставка</p>
                    <p className="font-medium">{usnResult.rate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Начислено</p>
                    <MoneyDisplay amount={usnResult.taxBeforeReduction} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Уменьшение</p>
                    <MoneyDisplay amount={usnResult.reduction} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">После уменьшения</p>
                    <MoneyDisplay amount={usnResult.taxAfterReduction} size="lg" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Уплачено ранее</p>
                    <MoneyDisplay amount={usnResult.previouslyPaid} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">К уплате</p>
                    <MoneyDisplay amount={usnResult.dueAmount} size="lg" className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Срок</p>
                    <p className="font-medium">{formatDate(usnResult.dueDate)}</p>
                  </div>
                </div>
                {usnResult.isMinimumTax && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                    Применён минимальный налог (1% от дохода): {formatCurrency(usnResult.minimumTaxAmount)}
                  </div>
                )}
                <div className="text-xs text-muted-foreground border-t pt-3">
                  Формула: {usnResult.formula}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="premium" className="space-y-4">
          {ipPremiumResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Фиксированные взносы ИП
                  <HowCalculated formula={ipPremiumResult.formula} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Годовая сумма</p>
                    <MoneyDisplay amount={ipPremiumResult.annualAmount} size="lg" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ежеквартально</p>
                    <MoneyDisplay amount={ipPremiumResult.quarterlyAmount} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Срок</p>
                    <p className="font-medium">{formatDate(ipPremiumResult.dueDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {additionalResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Дополнительный 1%
                  <HowCalculated formula={additionalResult.formula} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Доход ИП</p>
                    <MoneyDisplay amount={additionalResult.incomeYtd} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Облагаемый доход</p>
                    <MoneyDisplay amount={additionalResult.taxableIncome} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">К уплате</p>
                    <MoneyDisplay amount={additionalResult.finalAmount} size="lg" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Срок</p>
                    <p className="font-medium">{formatDate(additionalResult.dueDate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ndfl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>НДФЛ — итого за год</CardTitle>
            </CardHeader>
            <CardContent>
              <MoneyDisplay amount={ndflSummary.total} size="lg" />
              <div className="mt-4 space-y-2">
                {ndflSummary.byEmployee.map((e: any) => (
                  <div key={e.name} className="flex justify-between text-sm">
                    <span>{e.name}</span>
                    <MoneyDisplay amount={e.total} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="space-y-4">
          {employeeResults.map((result: any) => (
            <Card key={result.employeeName}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {result.employeeName}
                  <HowCalculated formula={result.formula} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Доход (нар. итог)</p>
                    <MoneyDisplay amount={result.incomeYtd} />
                  </div>
                  <div>
                    <p className="text-muted-foreground">30% до базы</p>
                    <MoneyDisplay amount={result.baseInsurance} />
                  </div>
                  <div>
                    <p className="text-muted-foreground">15.1% сверх базы</p>
                    <MoneyDisplay amount={result.excessInsurance} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="trauma" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Взносы на травматизм — итого за год</CardTitle>
            </CardHeader>
            <CardContent>
              <MoneyDisplay amount={traumaSummary.total} size="lg" />
              <div className="mt-4 space-y-2">
                {traumaSummary.byEmployee.map((e: any) => (
                  <div key={e.name} className="flex justify-between text-sm">
                    <span>{e.name}</span>
                    <MoneyDisplay amount={e.total} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
