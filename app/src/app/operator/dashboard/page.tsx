'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SchoolOverview, SchoolTabActivity } from '@/types'
import { TAB_ORDER, STATUS_STYLES, formatRelative, daysSince } from '@/lib/operator'

interface Kpis {
  totalSchools: number
  newThisWeek: number
  activeSchools: number
  dormantSchools: number
  unconfiguredSchools: number
  totalDevices: number
}

export default function OperatorDashboardPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<SchoolOverview[]>([])
  const [activity, setActivity] = useState<SchoolTabActivity[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: ov }, { data: act }] = await Promise.all([
      supabase.from('school_overview').select('*').order('school_name'),
      supabase.from('school_tab_activity').select('*'),
    ])
    setOverview((ov as SchoolOverview[]) ?? [])
    setActivity((act as SchoolTabActivity[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const kpis: Kpis = overview.reduce(
    (acc, s) => {
      const days = daysSince(s.last_activity)
      return {
        totalSchools: acc.totalSchools + 1,
        newThisWeek: acc.newThisWeek + (daysSince(s.joined_at)! < 7 ? 1 : 0),
        activeSchools: acc.activeSchools + (days !== null && days < 30 ? 1 : 0),
        dormantSchools: acc.dormantSchools + (days !== null && days >= 30 ? 1 : 0),
        unconfiguredSchools: acc.unconfiguredSchools + (s.classroom_count === 0 ? 1 : 0),
        totalDevices: acc.totalDevices + s.chromebook_count + s.shared_device_count,
      }
    },
    { totalSchools: 0, newThisWeek: 0, activeSchools: 0, dormantSchools: 0, unconfiguredSchools: 0, totalDevices: 0 }
  )

  const activityMap = new Map<string, SchoolTabActivity>()
  for (const a of activity) activityMap.set(`${a.school_id}|${a.tab}`, a)

  function cell(schoolId: string, tab: string) {
    return activityMap.get(`${schoolId}|${tab}`) ?? {
      school_id: schoolId, tab, total_count: 0, recent_count: 0, last_activity: null, status: '미사용' as const,
    }
  }

  const kpiCards = [
    { label: '총 학교 수', value: kpis.totalSchools, warn: false, filter: null },
    { label: '이번 주 신규 가입', value: kpis.newThisWeek, warn: false, filter: null },
    { label: '활성 학교 수', value: kpis.activeSchools, warn: false, filter: null },
    { label: '휴면 학교 수', value: kpis.dormantSchools, warn: true, filter: '휴면' },
    { label: '미설정 학교 수', value: kpis.unconfiguredSchools, warn: true, filter: '미설정' },
    { label: '총 등록 기기 수', value: kpis.totalDevices, warn: false, filter: null },
  ]

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">운영자 대시보드</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((c) => (
          <button
            key={c.label}
            onClick={() => c.filter && router.push(`/operator/schools?status=${encodeURIComponent(c.filter)}`)}
            className={`rounded-xl bg-white p-4 text-left shadow-sm transition-transform ${c.filter ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'}`}
          >
            <p className="text-xs font-medium text-gray-400">
              {c.label} {c.warn && '⚠️'}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">탭 사용 현황 히트맵</h2>
        <p className="mb-4 text-xs text-gray-400">
          진할수록 최근 활동이 많은 탭입니다. 셀을 클릭하면 해당 학교 상세로 이동합니다.
        </p>

        {overview.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">등록된 학교가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-2 py-2 text-left font-medium text-gray-500">학교</th>
                  {TAB_ORDER.map((tab) => (
                    <th key={tab} className="px-1.5 py-2 text-center font-medium text-gray-500">
                      {tab}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.map((s) => (
                  <tr key={s.school_id} className="border-t border-gray-50">
                    <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-1.5 font-medium text-gray-700">
                      {s.school_name}
                    </td>
                    {TAB_ORDER.map((tab) => {
                      const c = cell(s.school_id, tab)
                      return (
                        <td key={tab} className="px-1.5 py-1.5 text-center">
                          <button
                            title={`${tab} · 최근 30일 ${c.recent_count}건 · 마지막 활동 ${formatRelative(c.last_activity)}`}
                            onClick={() => router.push(`/operator/schools/${s.school_id}`)}
                            className={`h-5 w-8 rounded ${STATUS_STYLES[c.status]}`}
                          />
                        </td>
                      )
                    })}
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
