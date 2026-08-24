import { TabActivityStatus } from '@/types'

export const TAB_ORDER = ['학급관리', '고장신고', '공유기기', '대여관리', '크롬북', '튜터지원', '교사대여', '소프트웨어']

export const TAB_ROUTES: Record<string, string> = {
  학급관리: '/admin/classrooms',
  고장신고: '/admin/repairs',
  공유기기: '/admin/devices',
  대여관리: '/admin/rentals',
  크롬북: '/admin/chromebooks',
  튜터지원: '/admin/tutor',
  교사대여: '/admin/teacher-rentals',
  소프트웨어: '/admin/software',
}

export const STATUS_STYLES: Record<TabActivityStatus, string> = {
  미사용: 'bg-slate-100',
  초기설정만: 'bg-slate-200',
  저조: 'bg-blue-200',
  활발: 'bg-blue-600',
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return '오늘'
  if (days === 1) return '1일 전'
  return `${days}일 전`
}

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export type SchoolStatus = '활발' | '저조' | '휴면' | '미설정'

export function schoolStatus(
  classroomCount: number,
  lastActivity: string | null,
  recentCountAcrossTabs: number
): SchoolStatus {
  if (classroomCount === 0) return '미설정'
  const days = daysSince(lastActivity)
  if (days === null) return '미설정'
  if (days > 30) return '휴면'
  return recentCountAcrossTabs >= 5 ? '활발' : '저조'
}

export const SCHOOL_STATUS_STYLES: Record<SchoolStatus, string> = {
  활발: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  저조: 'border-blue-200 bg-blue-50 text-blue-800',
  휴면: 'border-amber-200 bg-amber-50 text-amber-800',
  미설정: 'border-red-200 bg-red-50 text-red-800',
}

export const SCHOOL_STATUS_DOT: Record<SchoolStatus, string> = {
  활발: '🟢',
  저조: '🟡',
  휴면: '🟡',
  미설정: '🔴',
}
