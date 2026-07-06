import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Pencil } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'

interface ManualOverrideProps {
  calculatedAmount: string
  manualAmount: string | null
  reason: string
  label: string
  onOverride: (amount: string, reason: string) => void
}

export function ManualOverride({ calculatedAmount, manualAmount, reason, label, onOverride }: ManualOverrideProps) {
  const [open, setOpen] = useState(false)
  const [newAmount, setNewAmount] = useState(manualAmount || calculatedAmount)
  const [newReason, setNewReason] = useState(reason)

  const hasOverride = manualAmount !== null && manualAmount !== calculatedAmount
  const difference = hasOverride ? parseFloat(manualAmount!) - parseFloat(calculatedAmount) : 0

  const handleSave = () => {
    onOverride(newAmount, newReason)
    setOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className={cn(hasOverride && 'line-through text-muted-foreground')}>
          {formatCurrency(calculatedAmount)}
        </span>
        {hasOverride && (
          <>
            <span className="text-sm">→</span>
            <span className="font-medium">{formatCurrency(manualAmount!)}</span>
            {difference !== 0 && (
              <span className={cn('text-xs', difference > 0 ? 'text-green-600' : 'text-red-600')}>
                ({difference > 0 ? '+' : ''}{formatCurrency(difference)})
              </span>
            )}
          </>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(true)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ручная корректировка: {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Расчётная сумма: {formatCurrency(calculatedAmount)}</p>
            </div>
            <div className="space-y-2">
              <Label>Новая сумма (₽)</Label>
              <Input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Причина корректировки</Label>
              <Textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Укажите причину..."
              />
            </div>
            <Button onClick={handleSave} className="w-full">Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
