import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MoneyDisplay } from './MoneyDisplay'
import type { CalculationTrace, TaxObligation } from '@/types'
import { Info } from 'lucide-react'

export function CalculationDetails({ obligation }: { obligation: TaxObligation }) {
  let trace: CalculationTrace | null = null
  try {
    trace = obligation.trace ? JSON.parse(obligation.trace) as CalculationTrace : null
  } catch {
    trace = null
  }
  if (!trace?.steps?.length) return null

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Info className="size-4" /> Как рассчитано
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Расчёт за {obligation.period}</DialogTitle></DialogHeader>
        <div className="calculation-trace">
          {trace.steps.map((step, index) => (
            <div key={`${step.label}-${index}`} className={index === trace!.steps.length - 1 ? 'total' : ''}>
              <span><strong>{step.label}</strong><small>{step.detail}</small></span>
              <MoneyDisplay amount={step.amount} />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
          <p>Правила: {trace.ruleSetVersion} · актуальность {trace.normativeDate}</p>
          <p>{trace.rounding}</p>
          <p>{trace.normativeSource}</p>
        </div>
        {trace.warnings.length > 0 && <div className="form-error">{trace.warnings.join(' ')}</div>}
      </DialogContent>
    </Dialog>
  )
}
