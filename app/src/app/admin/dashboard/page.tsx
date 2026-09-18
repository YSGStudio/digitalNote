'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TutorSupport } from '@/types'
import { useSchool } from '@/lib/school-context'

// 교사기기 장기 미반납 기준일 (학교별로 달라지면 school_config 로 이동)
const OVERDUE_DAYS = 30

interface Stats {
  classroomCount: number
  pendingRepairs: number
  inProgressRepairs: number
  activeRentals: number
  returnRequests: number
  sharedDeviceCount: number
  softwarePending: number
  approvedSoftwareCount: number
  overdueLoans: number
  chromebookTotal: number
  chromebookAssigned: number
  studentCount: number
}

const EMPTY_STATS: Stats = {
  classroomCount: 0,
  pendingRepairs: 0,
  inProgressRepairs: 0,
  activeRentals: 0,
  returnRequests: 0,
  sharedDeviceCount: 0,
  softwarePending: 0,
  approvedSoftwareCount: 0,
  overdueLoans: 0,
  chromebookTotal: 0,
  chromebookAssigned: 0,
  studentCount: 0,
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AdminDashboardPage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const [recentRepairs, setRecentRepairs] = useState<Array<{
    id: string
    status: string
    reported_at: string
    classrooms: { class_name: string } | null
    devices: { device_type: string } | null
  }>>([])
  const [todaySupports, setTodaySupports] = useState<TutorSupport[]>([])

  useEffect(() => {
    if (!schoolId) return
    async function load() {
      const supabase = createClient()
      const today = toLocalDateString(new Date())
      const overdueBefore = toLocalDateString(
        new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000)
      )
      const countOf = (table: string) =>
        supabase.from(table).select('*', { count: 'exact', head: true }).eq('school_id', schoolId)

      const [
        { count: classroomCount },
        { count: pendingRepairs },
        { count: inProgressRepairs },
        { count: activeRentals },
        { count: returnRequests },
        { count: sharedDeviceCount },
        { count: softwarePending },
        { count: approvedSoftwareCount },
        { count: overdueLoans },
        { count: chromebookTotal },
        { count: chromebookAssigned },
        { count: studentCount },
        { data: repairs },
        { data: supports },
      ] = await Promise.all([
        countOf('classrooms'),
        countOf('repair_reports').eq('status', '접수 대기'),
        countOf('repair_reports').eq('status', '수리 중'),
        countOf('rentals').eq('status', '대여 중'),
        countOf('rentals').eq('status', '반납 요청 중'),
        countOf('shared_devices').eq('is_active', true),
        countOf('software_requests').eq('status', '처리중'),
        countOf('approved_software').eq('is_active', true),
        countOf('teacher_device_loans').eq('status', '대여중').lt('rent_date', overdueBefore),
        countOf('chromebooks'),
        countOf('chromebooks').not('student_id', 'is', null),
        countOf('students'),
        supabase
          .from('repair_reports')
          .select('id, status, reported_at, classrooms(class_name), devices(device_type)')
          .eq('school_id', schoolId)
          .order('reported_at', { ascending: false })
          .limit(5),
        supabase
          .from('tutor_supports')
          .select('*, classrooms(class_name)')
          .eq('school_id', schoolId)
          .eq('support_date', today)
          .order('created_at', { ascending: true }),
      ])

      setStats({
        classroomCount: classroomCount ?? 0,
        pendingRepairs: pendingRepairs ?? 0,
        inProgressRepairs: inProgressRepairs ?? 0,
        activeRentals: activeRentals ?? 0,
        returnRequests: returnRequests ?? 0,
        sharedDeviceCount: sharedDeviceCount ?? 0,
        softwarePending: softwarePending ?? 0,
        approvedSoftwareCount: approvedSoftwareCount ?? 0,
        overdueLoans: overdueLoans ?? 0,
        chromebookTotal: chromebookTotal ?? 0,
        chromebookAssigned: chromebookAssigned ?? 0,
        studentCount: studentCount ?? 0,
      })
      setRecentRepairs((repairs as unknown as typeof recentRepairs) ?? [])
      setTodaySupports((supports as TutorSupport[]) ?? [])
    }
    load()
  }, [schoolId])

  const unassignedChromebooks = Math.max(stats.chromebookTotal - stats.chromebookAssigned, 0)
  const studentsWithoutDevice = Math.max(stats.studentCount - stats.chromebookAssigned, 0)

  const todos = [
    {
      key: 'repairs',
      href: '/admin/repairs',
      icon: '🔧',
      label: '접수 대기 고장',
      count: stats.pendingRepairs,
      tone: 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900',
    },
    {
      key: 'returns',
      href: '/admin/rentals',
      icon: '📦',
      label: '반납 요청 승인',
      count: stats.returnRequests,
      tone: 'border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-900',
    },
    {
      key: 'software',
      href: '/admin/software',
      icon: '🧩',
      label: '소프트웨어 심의 대기',
      count: stats.softwarePending,
      tone: 'border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900',
    },
    {
      key: 'loans',
      href: '/admin/teacher-rentals',
      icon: '📝',
      label: `${OVERDUE_DAYS}일 이상 미반납 교사기기`,
      count: stats.overdueLoans,
      tone: 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900',
    },
  ].filter((t) => t.count > 0)

  const cards = [
    {
      label: '등록된 학급',
      href: '/admin/classrooms',
      value: String(stats.classroomCount),
      icon: '🏫',
      color: 'text-blue-700 bg-white/70',
      card: 'border-blue-200 bg-blue-50/80',
    },
    {
      label: '공유 기기 종류',
      href: '/admin/devices',
      value: String(stats.sharedDeviceCount),
      icon: '💻',
      color: 'text-violet-700 bg-white/70',
      card: 'border-violet-200 bg-violet-50/80',
    },
    {
      label: '현재 대여 중',
      href: '/admin/rentals',
      value: String(stats.activeRentals),
      icon: '📦',
      color: 'text-emerald-700 bg-white/70',
      card: 'border-emerald-200 bg-emerald-50/80',
    },
    {
      label: '크롬북 배정',
      href: '/admin/chromebooks',
      value: `${stats.chromebookAssigned} / ${stats.chromebookTotal}`,
      sub: `미배정 ${unassignedChromebooks}대`,
      icon: '🖥️',
      color: 'text-cyan-700 bg-white/70',
      card: 'border-cyan-200 bg-cyan-50/80',
    },
    {
      label: '미지급 학생',
      href: '/admin/chromebooks',
      value: String(studentsWithoutDevice),
      sub: `전체 학생 ${stats.studentCount}명`,
      icon: '🧑‍🎓',
      color: 'text-orange-700 bg-white/70',
      card: 'border-orange-200 bg-orange-50/80',
    },
    {
      label: '심의 완료 소프트웨어',
      href: '/admin/software',
      value: String(stats.approvedSoftwareCount),
      icon: '🧩',
      color: 'text-slate-700 bg-white/70',
      card: 'border-slate-200 bg-slate-50',
    },
  ]

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">관리자 대시보드</h1>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">오늘 처리할 일</h2>
        {todos.length === 0 ? (
          <p className="py-3 text-center text-sm text-gray-400">처리할 일이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {todos.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${t.tone}`}
              >
                <span className="text-base">{t.icon}</span>
                <span className="flex-1">{t.label}</span>
                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold">
                  {t.count}건
                </span>
                <span aria-hidden className="text-xs opacity-60">→</span>
              </Link>
            ))}
          </div>
        )}
        {stats.inProgressRepairs > 0 && (
          <p className="mt-3 text-xs text-gray-500">현재 수리 중 {stats.inProgressRepairs}건</p>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${card.card}`}
          >
            <div className={`mb-3 inline-flex rounded-lg p-2.5 ${card.color}`}>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-0.5 text-sm text-gray-500">{card.label}</p>
            {card.sub && <p className="mt-0.5 text-xs text-gray-400">{card.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-900">
            <span className="text-xl">📚</span> 오늘의 튜터 지원
          </h2>
          <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            {todaySupports.length}건
          </span>
        </div>
        {todaySupports.length === 0 ? (
          <p className="py-4 text-center text-sm text-emerald-700/60">오늘 등록된 튜터 수업 지원이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {todaySupports.map((s) => (
              <div key={s.id} className="flex items-start gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
                <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {s.period}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{s.classrooms?.class_name ?? '알 수 없는 학급'}</p>
                  <p className="mt-0.5 text-sm text-gray-600">{s.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">최근 고장 신고</h2>
        {recentRepairs.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">신고 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">학급</th>
                  <th className="pb-2 font-medium">기기</th>
                  <th className="pb-2 font-medium">신고일</th>
                  <th className="pb-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentRepairs.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5">{r.classrooms?.class_name ?? '-'}</td>
                    <td className="py-2.5">{r.devices?.device_type ?? '-'}</td>
                    <td className="py-2.5 text-gray-500">
                      {new Date(r.reported_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === '처리 완료' ? 'bg-green-100 text-green-700' :
                        r.status === '수리 중' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
