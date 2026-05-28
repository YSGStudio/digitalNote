import { RepairStatus, RentalStatus } from '@/types'
import { cn } from '@/lib/utils'

const repairColors: Record<RepairStatus, string> = {
  '접수 대기': 'bg-yellow-100 text-yellow-800',
  '수리 중': 'bg-blue-100 text-blue-800',
  '처리 완료': 'bg-green-100 text-green-800',
}

const rentalColors: Record<RentalStatus, string> = {
  '대여 중': 'bg-orange-100 text-orange-800',
  '반납 요청 중': 'bg-purple-100 text-purple-800',
  '반납 완료': 'bg-gray-100 text-gray-700',
}

interface BadgeProps {
  label: RepairStatus | RentalStatus | string
  className?: string
}

export function Badge({ label, className }: BadgeProps) {
  const color =
    repairColors[label as RepairStatus] ??
    rentalColors[label as RentalStatus] ??
    'bg-gray-100 text-gray-700'

  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', color, className)}>
      {label}
    </span>
  )
}
