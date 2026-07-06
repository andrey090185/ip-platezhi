import { Badge } from '@/components/ui/badge'
import type { PaymentStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<PaymentStatus, { label: string; variant: string; className: string }> = {
  paid: { label: 'Оплачено', variant: 'default', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800' },
  planned: { label: 'Запланировано', variant: 'default', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  overdue: { label: 'Просрочено', variant: 'default', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800' },
  draft: { label: 'Черновик', variant: 'default', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn('text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}
