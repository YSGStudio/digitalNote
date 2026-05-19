'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getTeacherSession } from '@/lib/teacher-auth'
import { RepairReport } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

export default function TeacherDashboardPage() {
  const router = useRouter()
  const [className, setClassName] = useState('')
  const [deviceCount, setDeviceCount] = useState(0)
  const [activeRentals, setActiveRentals] = useState(0)
  const [recentRepairs, setRecentRepairs] = useState<RepairReport[]>([])

  useEffect(() => {
    const session = getTeacherSession()
    if (!session) { router.push('/login/teacher'); return }

    setClassName(session.className)

    const cid = session.classroomId
    async function load() {
      const supabase = createClient()
      const [{ count: dc }, { count: ar }, { data: repairs }] = await Promise.all([
        supabase.from('classroom_devices').select('*', { count: 'exact', head: true }).eq('classroom_id', cid),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('classroom_id', cid).eq('status', '대여 중'),
        supabase
          .from('repair_reports')
          .select('*, devices(device_type)')
          .eq('classroom_id', cid)
          .order('reported_at', { ascending: false })
          .limit(5),
      ])
      setDeviceCount(dc ?? 0)
      setActiveRentals(ar ?? 0)
      setRecentRepairs((repairs as RepairReport[]) ?? [])
    }
    load()
  }, [router])

  const quickLinks = [
    { href: '/teacher/my-devices', icon: '💻', label: '기기 현황', desc: '학급 기기 등록 및 수량 관리' },
    { href: '/teacher/repair', icon: '🔧', label: '고장 신고', desc: '고장 기기 신고 및 이력 확인' },
    { href: '/teacher/rentals', icon: '📦', label: '대여·반납', desc: '공유 기기 대여 및 반납 처리' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{className}</h1>
        <p className="mt-1 text-sm text-gray-500">학급 현황 대시보드</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{deviceCount}</p>
          <p className="mt-0.5 text-sm text-gray-500">기기 종류 등록됨</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-orange-600">{activeRentals}</p>
          <p className="mt-0.5 text-sm text-gray-500">현재 대여 중</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        {quickLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-3xl">{l.icon}</span>
            <p className="mt-3 font-semibold text-gray-900">{l.label}</p>
            <p className="mt-0.5 text-xs text-gray-400">{l.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">내 고장 신고 내역</h2>
        {recentRepairs.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">신고 내역이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">신고일</th>
                <th className="pb-2 font-medium">기기</th>
                <th className="pb-2 font-medium">수량</th>
                <th className="pb-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentRepairs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 text-gray-500">{formatDate(r.reported_at)}</td>
                  <td className="py-2.5">{r.devices?.device_type ?? '-'}</td>
                  <td className="py-2.5">{r.quantity}대</td>
                  <td className="py-2.5"><Badge label={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
