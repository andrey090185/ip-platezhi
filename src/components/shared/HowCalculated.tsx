import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Info } from 'lucide-react'

interface HowCalculatedProps {
  formula: string
  details?: Record<string, string>
}

export function HowCalculated({ formula, details }: HowCalculatedProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6" />}>
        <Info className="w-3.5 h-3.5 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Как рассчитано</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{formula}</p>
          {details && (
            <div className="space-y-1 border-t pt-3">
              {Object.entries(details).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
