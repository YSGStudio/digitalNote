'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Stats {
  classroomCount: number
  pendingRepairs: number
  activeRentals: number
  sharedDeviceCount: number
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

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [
        { count: classroomCount },
        { count: pendingRepairs },
        { count: activeRentals },
        { count: sharedDeviceCount },
        { data: repairs },
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
      ])
      setStats({
        classroomCount: classroomCount ?? 0,
        pendingRepairs: pendingRepairs ?? 0,
        activeRentals: activeRentals ?? 0,
        sharedDeviceCount: sharedDeviceCount ?? 0,
      })
      setRecentRepairs((repairs as unknown as typeof recentRepairs) ?? [])
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
