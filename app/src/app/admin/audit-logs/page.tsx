'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { AuditAction, AuditLog } from '@/types'
import { formatDate } from '@/lib/utils'
import { useSchool } from '@/lib/school-context'

const TABLE_LABELS: Record<string, string> = {
  classrooms: '학급',
  classroom_devices: '학급 기기 수량',
  devices: '기기 종류',
  shared_devices: '공유 기기',
  repair_reports: '고장 신고',
  rentals: '대여',
  students: '학생',
  chromebooks: '크롬북',
  teacher_device_loans: '교사기기대여',
  school_config: '학교 설정',
}

const ACTION_LABELS: Record<AuditAction, string> = {
  insert: '추가',
  update: '수정',
  delete: '삭제',
}

const ACTION_STYLES: Record<AuditAction, string> = {
  insert: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  update: 'border-blue-200 bg-blue-50 text-blue-800',
  delete: 'border-red-200 bg-red-50 text-red-800',
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AdminAuditLogsPage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tableFilter, setTableFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(300)
    setLogs((data as AuditLog[]) ?? [])
    setLoading(false)
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const usedTables = Array.from(new Set(logs.map((l) => l.table_name)))

  const filtered = logs.filter((l) => {
    if (tableFilter !== 'all' && l.table_name !== tableFilter) return false
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return l.actor_email.toLowerCase().includes(q) || l.summary.toLowerCase().includes(q)
  })

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">감사 로그</h1>
        <p className="mt-1 text-sm text-gray-500">관리자가 데이터를 추가·수정·삭제할 때마다 자동으로 기록됩니다.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {(['all', 'insert', 'update', 'delete'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                actionFilter === a ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {a === 'all' ? '전체' : ACTION_LABELS[a]}
            </button>
          ))}
        </div>
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">전체 항목</option>
          {usedTables.map((t) => (
            <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="담당자·내용 검색..."
          className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            {search || tableFilter !== 'all' || actionFilter !== 'all' ? '검색 결과가 없습니다.' : '기록된 활동이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">일시</th>
                  <th className="px-4 py-3 font-medium">수정 주체</th>
                  <th className="px-4 py-3 font-medium">항목</th>
                  <th className="px-4 py-3 font-medium">구분</th>
                  <th className="px-4 py-3 font-medium">내용</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-gray-700">{log.actor_email}</td>
                      <td className="px-4 py-3 text-gray-500">{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLES[log.action]}`}>
                          {ACTION_LABELS[log.action]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {log.summary}
                        {log.changes && (
                          <span className="ml-1.5 text-xs text-blue-500">
                            {expandedId === log.id ? '접기 ▲' : '상세 ▼'}
                          </span>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && log.changes && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-4 py-3">
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-gray-600">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && logs.length >= 300 && (
        <p className="mt-3 text-center text-xs text-gray-400">최근 300건만 표시됩니다.</p>
      )}
    </div>
  )
}
