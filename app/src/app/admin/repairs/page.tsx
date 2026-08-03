'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { RepairReport, RepairStatus } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { useSchool } from '@/lib/school-context'
import { logAudit } from '@/lib/audit'

const STATUS_ORDER: RepairStatus[] = ['접수 대기', '수리 중', '처리 완료']

export default function AdminRepairsPage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [reports, setReports] = useState<RepairReport[]>([])
  const [filterStatus, setFilterStatus] = useState<RepairStatus | 'all'>('all')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    const supabase = createClient()
    let query = supabase
      .from('repair_reports')
      .select('*, classrooms(class_name), devices(device_type)')
      .eq('school_id', schoolId)
      .order('reported_at', { ascending: false })

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus)
    }

    const { data } = await query
    setReports((data as RepairReport[]) ?? [])
  }, [filterStatus, schoolId])

  useEffect(() => { load() }, [load])

  async function nextStatus(report: RepairReport) {
    const idx = STATUS_ORDER.indexOf(report.status)
    if (idx >= STATUS_ORDER.length - 1) return
    const next = STATUS_ORDER[idx + 1]
    setUpdating(report.id)
    const supabase = createClient()
    await supabase
      .from('repair_reports')
      .update({ status: next, resolved_at: next === '처리 완료' ? new Date().toISOString() : null })
      .eq('id', report.id)
    await logAudit({
      schoolId,
      tableName: 'repair_reports',
      recordId: report.id,
      action: 'update',
      summary: `고장 신고 처리 상태 변경 (${report.classrooms?.class_name ?? '-'} · ${report.devices?.device_type ?? '-'})`,
      changes: { status: { old: report.status, new: next } },
    })
    await load()
    setUpdating(null)
  }

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">고장 신고 관리</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s === 'all' ? '전체' : s}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {reports.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">신고 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-3 font-medium whitespace-nowrap">신고일</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">학급</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">기기</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">수량</th>
                  <th className="px-3 py-3 font-medium w-full min-w-[18rem]">내용</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.reported_at)}</td>
                    <td className="px-3 py-3 font-medium whitespace-nowrap">{r.classrooms?.class_name ?? '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.devices?.device_type ?? '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.quantity}대</td>
                    <td className="px-3 py-3 text-gray-500 w-full">
                      {r.description ? (
                        <div className="group relative">
                          <span className="block truncate max-w-sm">{r.description}</span>
                          <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-64 rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                            {r.description}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><Badge label={r.status} /></td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {r.status !== '처리 완료' && (
                        <Button size="sm" variant="secondary" loading={updating === r.id} onClick={() => nextStatus(r)}>
                          {r.status === '접수 대기' ? '수리 중으로' : '완료 처리'}
                        </Button>
                      )}
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
