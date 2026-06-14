'use client'
import { Badge } from '@/components/ui/badge'

type StatusType = 'completed' | 'pending' | 'cancelled' | 'refunded' | 'paid' | 'partial' | 'overdue' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'active' | 'inactive'

const STATUS_STYLES: Record<StatusType, { className: string; label: string }> = {
  completed: { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Completed' },
  pending: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', label: 'Pending' },
  cancelled: { className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', label: 'Cancelled' },
  refunded: { className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300', label: 'Refunded' },
  paid: { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Paid' },
  partial: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', label: 'Partial' },
  overdue: { className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', label: 'Overdue' },
  in_stock: { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'In Stock' },
  low_stock: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', label: 'Low Stock' },
  out_of_stock: { className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', label: 'Out of Stock' },
  active: { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', label: 'Active' },
  inactive: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300', label: 'Inactive' },
}

interface StatusBadgeProps {
  status: string
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_STYLES[status as StatusType]
  if (!config) {
    return <Badge variant="outline" className={className}>{label || status}</Badge>
  }
  return (
    <Badge className={`${config.className} ${className || ''}`}>
      {label || config.label}
    </Badge>
  )
}
