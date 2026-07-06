import { formatCurrency } from '@/utils/currency'
import { cn } from '@/lib/utils'

interface MoneyDisplayProps {
  amount: string | number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function MoneyDisplay({ amount, className, size = 'md' }: MoneyDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  }

  return (
    <span className={cn('font-mono tabular-nums', sizeClasses[size], className)}>
      {formatCurrency(amount)}
    </span>
  )
}
