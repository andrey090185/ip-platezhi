import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { HowCalculated } from '@/components/shared/HowCalculated'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { calcUsnAdvance } from '@/engine/usnFormulas'
import { calcFixedPremium, calcAdditionalPremium } from '@/engine/insuranceFormulas'
import { formatDate } from '@/engine/dateUtils'
import { RefreshCw } from 'lucide-react'

export default function TaxCalculation() {
  const { currentIp, taxSettings } = useAppStore()
  const [usnResult, setUsnResult] = useState<any>(null)
  const [ipPremiumResult, setIpPremiumResult] = useState<any>(null)
  const [additionalResult, setAdditionalResult] = useState<any>(null)

  useEffect(() => {
    if (currentIp?.id && taxSettings) calculate()
  }, [currentIp, taxSettings])

  const calculate = async () => {
    if (!currentIp?.id || !taxSettings) return
    const ipId = currentIp.id
    const year = currentIp.year
    const quarter = Math.ceil((new Date().getMonth() + 1) / 3)

    const { income, expenses } = await transactionRepo.getYearTotals(ipId, year)

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
      false,
      currentIp.usnObject
    )
    setUsnResult(usn)
  }

  if (!currentIp || !taxSettings) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Платежи</h1>
        <Button variant="outline" size="sm" onClick={calculate}>
          <RefreshCw className="w-4 h-4 mr-1" /> Пересчитать
        </Button>
      </div>

      <Tabs defaultValue="usn">
        <TabsList>
          <TabsTrigger value="usn">УСН</TabsTrigger>
          <TabsTrigger value="premium">Взносы ИП</TabsTrigger>
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
                    Применён минимальный налог (1% от дохода): {usnResult.minimumTaxAmount}
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
      </Tabs>
    </div>
  )
}
