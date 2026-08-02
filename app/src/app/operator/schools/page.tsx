'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { SchoolOverview, SchoolTabActivity } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  formatRelative,
  schoolStatus,
  SchoolStatus,
  SCHOOL_STATUS_STYLES,
  SCHOOL_STATUS_DOT,
} from '@/lib/operator'

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

type SortKey = 'school_name' | 'classroom_count' | 'device_count' | 'last_activity'

export default function OperatorSchoolsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [overview, setOverview] = useState<SchoolOverview[]>([])
  const [activity, setActivity] = useState<SchoolTabActivity[]>([])
  const [adminEmails, setAdminEmails] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SchoolStatus | 'all'>(
    (searchParams.get('status') as SchoolStatus | null) ?? 'all'
  )
  const [sortKey, setSortKey] = useState<SortKey>('school_name')
  const [sortAsc, setSortAsc] = useState(true)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [codeTarget, setCodeTarget] = useState<SchoolOverview | null>(null)
  const [newCode, setNewCode] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [codeSaving, setCodeSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<SchoolOverview | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [actionMsg, setActionMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: ov }, { data: act }, { data: emails }] = await Promise.all([
      supabase.from('school_overview').select('*'),
      supabase.from('school_tab_activity').select('*'),
      supabase.rpc('operator_school_admins'),
    ])
    setOverview((ov as SchoolOverview[]) ?? [])
    setActivity((act as SchoolTabActivity[]) ?? [])
    const map = new Map<string, string>()
    for (const row of (emails as { school_id: string; admin_email: string }[]) ?? []) {
      map.set(row.school_id, row.admin_email)
    }
    setAdminEmails(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const recentCountBySchool = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of activity) {
      m.set(a.school_id, (m.get(a.school_id) ?? 0) + a.recent_count)
    }
    return m
  }, [activity])

  const staleRepairBySchool = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of overview) m.set(s.school_id, s.stale_repair_count)
    return m
  }, [overview])

  const rows = useMemo(() => {
    return overview.map((s) => ({
      ...s,
      device_count: s.chromebook_count + s.shared_device_count,
      admin_email: adminEmails.get(s.school_id) ?? '-',
      status: schoolStatus(s.classroom_count, s.last_activity, recentCountBySchool.get(s.school_id) ?? 0),
    }))
  }, [overview, adminEmails, recentCountBySchool])

  const filtered = rows
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) => {
      if (!search) return true
      const q = search.toLowerCase()
      return r.school_name.toLowerCase().includes(q) || r.school_code.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'school_name') cmp = a.school_name.localeCompare(b.school_name)
      else if (sortKey === 'classroom_count') cmp = a.classroom_count - b.classroom_count
      else if (sortKey === 'device_count') cmp = a.device_count - b.device_count
      else cmp = new Date(a.last_activity ?? 0).getTime() - new Date(b.last_activity ?? 0).getTime()
      return sortAsc ? cmp : -cmp
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  async function handleSendReset(email: string) {
    setOpenMenuId(null)
    setActionMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })
    setActionMsg(error ? `전송 실패: ${error.message}` : `${email}로 비밀번호 재설정 메일을 보냈습니다.`)
  }

  function openCodeModal(s: SchoolOverview) {
    setOpenMenuId(null)
    setCodeTarget(s)
    setNewCode(s.school_code)
    setCodeErr('')
  }

  async function handleCodeSave() {
    if (!codeTarget) return
    if (!newCode.trim()) { setCodeErr('학교코드를 입력해주세요.'); return }
    setCodeSaving(true)
    setCodeErr('')
    const supabase = createClient()
    const { data: dup } = await supabase
      .from('school_config')
      .select('id')
      .eq('school_code', newCode.trim())
      .neq('id', codeTarget.school_id)
      .maybeSingle()
    if (dup) { setCodeErr('이미 다른 학교에서 사용 중인 코드입니다.'); setCodeSaving(false); return }

    const { error } = await supabase
      .from('school_config')
      .update({ school_code: newCode.trim() })
      .eq('id', codeTarget.school_id)
    setCodeSaving(false)
    if (error) { setCodeErr(`변경 실패: ${error.message}`); return }
    setCodeTarget(null)
    load()
  }

  function openDeleteModal(s: SchoolOverview) {
    setOpenMenuId(null)
    setDeleteTarget(s)
    setDeleteConfirmText('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (deleteConfirmText !== deleteTarget.school_name) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('school_config').delete().eq('id', deleteTarget.school_id)
    setDeleting(false)
    if (error) { setActionMsg(`삭제 실패: ${error.message}`); return }
    setDeleteTarget(null)
    setActionMsg(`${deleteTarget.school_name} 학교 데이터를 모두 삭제했습니다.`)
    load()
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">학교 목록</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {(['all', '활발', '저조', '휴면', '미설정'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? '전체' : s}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학교명·학교코드 검색..."
          className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {actionMsg && (
        <div className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">{actionMsg}</div>
      )}

      <div className="overflow-visible rounded-xl bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">조건에 맞는 학교가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('school_name')}>학교명</th>
                  <th className="px-4 py-3 font-medium">학교코드</th>
                  <th className="px-4 py-3 font-medium">관리자 이메일</th>
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('classroom_count')}>학급 수</th>
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('device_count')}>기기 수</th>
                  <th className="cursor-pointer px-4 py-3 font-medium" onClick={() => toggleSort('last_activity')}>최근 활동</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.school_id} className="hover:bg-gray-50">
                    <td
                      className="cursor-pointer px-4 py-3 font-medium text-blue-700"
                      onClick={() => router.push(`/operator/schools/${s.school_id}`)}
                    >
                      {s.school_name}
                      {(staleRepairBySchool.get(s.school_id) ?? 0) > 0 && (
                        <span
                          className="ml-1.5"
                          title={`30일 이상 미처리 고장 신고 ${staleRepairBySchool.get(s.school_id)}건`}
                        >
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">{s.school_code}</td>
                    <td className="px-4 py-3 text-gray-500">{s.admin_email}</td>
                    <td className="px-4 py-3">{s.classroom_count}</td>
                    <td className="px-4 py-3">{s.device_count}</td>
                    <td className="px-4 py-3 text-gray-500">{formatRelative(s.last_activity)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SCHOOL_STATUS_STYLES[s.status]}`}>
                        {SCHOOL_STATUS_DOT[s.status]} {s.status}
                      </span>
                    </td>
                    <td className="relative px-4 py-3">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === s.school_id ? null : s.school_id)}
                        className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        ⋯
                      </button>
                      {openMenuId === s.school_id && (
                        <div className="absolute right-4 top-10 z-10 w-56 rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg">
                          <button
                            onClick={() => handleSendReset(s.admin_email)}
                            disabled={s.admin_email === '-'}
                            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-300"
                          >
                            관리자 비밀번호 재설정 메일 발송
                          </button>
                          <button
                            onClick={() => openCodeModal(s)}
                            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            학교코드 변경
                          </button>
                          <button
                            onClick={() => openDeleteModal(s)}
                            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            학교 삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 학교코드 변경 모달 */}
      <Modal open={codeTarget !== null} onClose={() => setCodeTarget(null)} title="학교코드 변경">
        {codeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{codeTarget.school_name}의 학교코드를 변경합니다.</p>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className={INPUT_CLS}
              autoFocus
            />
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              변경 즉시 기존 코드로는 교사 로그인이 불가능해집니다. 학교 담당자에게 새 코드를 안내해야 합니다.
            </p>
            {codeErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{codeErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setCodeTarget(null)}>취소</Button>
              <Button loading={codeSaving} onClick={handleCodeSave}>변경</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 학교 삭제 모달 */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="학교 삭제">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              이 작업은 되돌릴 수 없습니다. <strong>{deleteTarget.school_name}</strong>의 학급·기기·대여·고장신고 등
              모든 데이터가 함께 삭제됩니다. (학급 {deleteTarget.classroom_count}개, 크롬북 {deleteTarget.chromebook_count}대)
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                확인을 위해 학교명 <strong>{deleteTarget.school_name}</strong>을 정확히 입력하세요.
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className={INPUT_CLS}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>취소</Button>
              <Button
                variant="danger"
                loading={deleting}
                disabled={deleteConfirmText !== deleteTarget.school_name}
                onClick={handleDelete}
              >
                영구 삭제
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
