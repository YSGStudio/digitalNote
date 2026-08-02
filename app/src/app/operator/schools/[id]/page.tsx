'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SchoolOverview, SchoolTabActivity } from '@/types'
import { formatDate } from '@/lib/utils'
import {
  TAB_ORDER,
  TAB_ROUTES,
  formatRelative,
  schoolStatus,
  SCHOOL_STATUS_STYLES,
  SCHOOL_STATUS_DOT,
  STATUS_STYLES,
} from '@/lib/operator'

export default function OperatorSchoolDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [school, setSchool] = useState<SchoolOverview | null>(null)
  const [activity, setActivity] = useState<SchoolTabActivity[]>([])
  const [adminEmail, setAdminEmail] = useState('-')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!params.id) return
    async function load() {
      const supabase = createClient()
      const [{ data: sc }, { data: act }, { data: emails }] = await Promise.all([
        supabase.from('school_overview').select('*').eq('school_id', params.id).maybeSingle(),
        supabase.from('school_tab_activity').select('*').eq('school_id', params.id),
        supabase.rpc('operator_school_admins'),
      ])
      if (!sc) { setNotFound(true); setLoading(false); return }
      setSchool(sc as SchoolOverview)
      setActivity((act as SchoolTabActivity[]) ?? [])
      const match = (emails as { school_id: string; admin_email: string }[] ?? []).find(
        (r) => r.school_id === params.id
      )
      setAdminEmail(match?.admin_email ?? '-')
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  if (notFound || !school) {
    return <div className="py-20 text-center text-sm text-gray-400">학교를 찾을 수 없습니다.</div>
  }

  const activityMap = new Map(activity.map((a) => [a.tab, a]))
  const recentTotal = activity.reduce((sum, a) => sum + a.recent_count, 0)
  const status = schoolStatus(school.classroom_count, school.last_activity, recentTotal)
  const sortedActivity = [...activity].sort(
    (a, b) => new Date(b.last_activity ?? 0).getTime() - new Date(a.last_activity ?? 0).getTime()
  )

  return (
    <div>
      <button
        onClick={() => router.push('/operator/schools')}
        className="mb-4 text-sm text-gray-400 hover:text-gray-600"
      >
        ← 학교 목록으로
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{school.school_name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            학교코드 <span className="font-mono">{school.school_code}</span> · 관리자 {adminEmail} · 가입일 {formatDate(school.joined_at)}
          </p>
        </div>
        <span className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${SCHOOL_STATUS_STYLES[status]}`}>
          {SCHOOL_STATUS_DOT[status]} {status}
        </span>
      </div>

      {school.stale_repair_count > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ 30일 이상 처리되지 않은 고장 신고가 {school.stale_repair_count}건 있습니다.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '학급 수', value: school.classroom_count },
          { label: '크롬북 수', value: school.chromebook_count },
          { label: '공유기기 수', value: school.shared_device_count },
          { label: '최근 활동', value: formatRelative(school.last_activity) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-400">{c.label}</p>
            <p className="mt-1.5 text-xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">탭별 사용 현황</h2>
        <div className="space-y-2">
          {TAB_ORDER.map((tab) => {
            const a = activityMap.get(tab)
            const status2 = a?.status ?? '미사용'
            return (
              <a
                key={tab}
                href={TAB_ROUTES[tab]}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${STATUS_STYLES[status2]}`} />
                  <span className="text-sm font-medium text-gray-700">{tab}</span>
                </div>
                <span className="text-xs text-gray-400">
                  총 {a?.total_count ?? 0}건 · 최근 30일 {a?.recent_count ?? 0}건 · {formatRelative(a?.last_activity)}
                </span>
              </a>
            )
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">최근 활동 타임라인</h2>
        {sortedActivity.filter((a) => a.last_activity).length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">활동 이력이 없습니다.</p>
        ) : (
          <div className="divide-y">
            {sortedActivity
              .filter((a) => a.last_activity)
              .map((a) => (
                <div key={a.tab} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-gray-700">{a.tab}</span>
                  <span className="text-gray-400">{formatRelative(a.last_activity)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
