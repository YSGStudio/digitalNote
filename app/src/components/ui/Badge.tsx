import { RepairStatus, RentalStatus } from '@/types'
import { cn } from '@/lib/utils'

const repairColors: Record<RepairStatus, string> = {
  '접수 대기': 'border-amber-200 bg-amber-50 text-amber-800',
  '수리 중': 'border-sky-200 bg-sky-50 text-sky-800',
  '처리 완료': 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

const rentalColors: Record<RentalStatus, string> = {
  '대여 중': 'border-orange-200 bg-orange-50 text-orange-800',
  '반납 요청 중': 'border-violet-200 bg-violet-50 text-violet-800',
  '반납 완료': 'border-slate-200 bg-slate-50 text-slate-600',
}

interface BadgeProps {
  label: RepairStatus | RentalStatus | string
  className?: string
}

export function Badge({ label, className }: BadgeProps) {
  const color =
    repairColors[label as RepairStatus] ??
    rentalColors[label as RentalStatus] ??
    'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <span className={cn('inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold', color, className)}>
      {label}
    </span>
  )
}
