'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { TutorSupport } from '@/types'

interface Stats {
  classroomCount: number
  pendingRepairs: number
  activeRentals: number
  sharedDeviceCount: number
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    classroomCount: 0,
    pendingRepairs: 0,
    activeRentals: 0,
    sharedDeviceCount: 0,
  })
  const [recentRepairs, setRecentRepairs] = useState<Array<{
    id: string
    status: string
    reported_at: string
    classrooms: { class_name: string } | null
    devices: { device_type: string } | null
  }>>([])
  const [todaySupports, setTodaySupports] = useState<TutorSupport[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const today = toLocalDateString(new Date())
      const [
        { count: classroomCount },
        { count: pendingRepairs },
        { count: activeRentals },
        { count: sharedDeviceCount },
        { data: repairs },
        { data: supports },
      ] = await Promise.all([
        supabase.from('classrooms').select('*', { count: 'exact', head: true }),
        supabase.from('repair_reports').select('*', { count: 'exact', head: true }).neq('status', '처리 완료'),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', '대여 중'),
        supabase.from('shared_devices').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase
          .from('repair_reports')
          .select('id, status, reported_at, classrooms(class_name), devices(device_type)')
          .order('reported_at', { ascending: false })
          .limit(5),
        supabase
          .from('tutor_supports')
          .select('*, classrooms(class_name)')
          .eq('support_date', today)
          .order('created_at', { ascending: true }),
      ])
      setStats({
        classroomCount: classroomCount ?? 0,
        pendingRepairs: pendingRepairs ?? 0,
        activeRentals: activeRentals ?? 0,
        sharedDeviceCount: sharedDeviceCount ?? 0,
      })
      setRecentRepairs((repairs as unknown as typeof recentRepairs) ?? [])
      setTodaySupports((supports as TutorSupport[]) ?? [])
    }
    load()
  }, [])

  const cards = [
    { label: '등록된 학급', value: stats.classroomCount, icon: '🏫', color: 'text-blue-700 bg-blue-50' },
    { label: '처리 중인 고장', value: stats.pendingRepairs, icon: '🔧', color: 'text-orange-700 bg-orange-50' },
    { label: '현재 대여 중', value: stats.activeRentals, icon: '📦', color: 'text-emerald-700 bg-emerald-50' },
    { label: '공유 기기 종류', value: stats.sharedDeviceCount, icon: '💻', color: 'text-purple-700 bg-purple-50' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">관리자 대시보드</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex rounded-lg p-2.5 ${card.color}`}>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-0.5 text-sm text-gray-500">{card.label}</p>
          </div>
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
