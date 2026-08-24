'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { ApprovedSoftware, SoftwareRequest, SoftwareRequestStatus } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { SoftwareList } from '@/components/software/SoftwareList'
import { useSchool } from '@/lib/school-context'
import { logAudit, diffFields } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import {
  EXCEL_COLS,
  LIMITS,
  dedupeKey,
  findCol,
  normalizeUrl,
  parseEduzip,
  safeHref,
} from '@/lib/software'

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

type UploadRow = {
  name: string
  company: string
  eduzip_registered: boolean
  eduzip_url: string
  note: string
  _isNew: boolean
  _existingId?: string
}

type SoftwareForm = {
  name: string
  company: string
  eduzip_registered: boolean
  eduzip_url: string
  note: string
}

const EMPTY_FORM: SoftwareForm = {
  name: '',
  company: '',
  eduzip_registered: false,
  eduzip_url: '',
  note: '',
}

export default function AdminSoftwarePage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [tab, setTab] = useState<'approved' | 'requests'>('approved')
  const [software, setSoftware] = useState<ApprovedSoftware[]>([])
  const [requests, setRequests] = useState<SoftwareRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [viewInactive, setViewInactive] = useState(false)

  // 개별 추가 / 수정
  const [formModal, setFormModal] = useState(false)
  const [editing, setEditing] = useState<ApprovedSoftware | null>(null)
  const [form, setForm] = useState<SoftwareForm>(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  // 엑셀 업로드
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([])
  const [uploadSkipped, setUploadSkipped] = useState(0)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [uploadSaving, setUploadSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  // 신청 현황
  const [reqFilter, setReqFilter] = useState<'전체' | SoftwareRequestStatus>('전체')
  const [reqSearch, setReqSearch] = useState('')
  const [statusTarget, setStatusTarget] = useState<SoftwareRequest | null>(null)
  const [alsoApprove, setAlsoApprove] = useState(true)
  const [approveForm, setApproveForm] = useState<SoftwareForm>(EMPTY_FORM)
  const [statusErr, setStatusErr] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: sw }, { data: reqs }] = await Promise.all([
      supabase
        .from('approved_software')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
      supabase
        .from('software_requests')
        .select('*, classrooms(*)')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
    ])
    setSoftware((sw as ApprovedSoftware[]) ?? [])
    setRequests((reqs as SoftwareRequest[]) ?? [])
    setLoading(false)
  }, [schoolId])

  useEffect(() => { load() }, [load])

  const activeSoftware = useMemo(() => software.filter((s) => s.is_active), [software])
  const inactiveSoftware = useMemo(() => software.filter((s) => !s.is_active), [software])
  const pendingCount = requests.filter((r) => r.status === '처리중').length

  // ── 개별 추가 / 수정 ───────────────────────────────────────
  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErr('')
    setFormModal(true)
  }

  function openEdit(item: ApprovedSoftware) {
    setEditing(item)
    setForm({
      name: item.name,
      company: item.company ?? '',
      eduzip_registered: item.eduzip_registered,
      eduzip_url: item.eduzip_url ?? '',
      note: item.note ?? '',
    })
    setFormErr('')
    setFormModal(true)
  }

  async function saveForm() {
    if (!schoolId) return
    const name = form.name.trim()
    if (!name) { setFormErr('소프트웨어명을 입력해주세요.'); return }
    const { url, error: urlErr } = normalizeUrl(form.eduzip_url)
    if (urlErr) { setFormErr(urlErr); return }

    setFormSaving(true)
    setFormErr('')
    const supabase = createClient()
    const payload = {
      name,
      company: form.company.trim() || null,
      eduzip_registered: form.eduzip_registered,
      eduzip_url: url || null,
      note: form.note.trim() || null,
    }

    if (editing) {
      const { error } = await supabase
        .from('approved_software')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
      setFormSaving(false)
      if (error) { setFormErr(duplicateMessage(error.message)); return }
      const changes = diffFields(
        editing as unknown as Record<string, unknown>,
        payload as unknown as Record<string, unknown>,
        ['name', 'company', 'eduzip_registered', 'eduzip_url', 'note']
      )
      await logAudit({
        schoolId,
        tableName: 'approved_software',
        recordId: editing.id,
        action: 'update',
        summary: `심의 소프트웨어 수정: ${name}`,
        changes,
      })
    } else {
      const { data: inserted, error } = await supabase
        .from('approved_software')
        .insert({ school_id: schoolId, ...payload })
        .select('id')
        .single()
      setFormSaving(false)
      if (error) { setFormErr(duplicateMessage(error.message)); return }
      await logAudit({
        schoolId,
        tableName: 'approved_software',
        recordId: inserted?.id,
        action: 'insert',
        summary: `심의 소프트웨어 추가: ${name}`,
        changes: payload,
      })
    }
    setFormModal(false)
    load()
  }

  async function toggleActive() {
    if (!editing || !schoolId) return
    const next = !editing.is_active
    setFormSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('approved_software')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
    setFormSaving(false)
    if (error) { setFormErr(`저장 실패: ${error.message}`); return }
    await logAudit({
      schoolId,
      tableName: 'approved_software',
      recordId: editing.id,
      action: 'update',
      summary: `심의 소프트웨어 ${next ? '사용재개' : '사용중지'}: ${editing.name}`,
      changes: { is_active: { old: editing.is_active, new: next } },
    })
    setFormModal(false)
    load()
  }

  // ── 엑셀 업로드 ────────────────────────────────────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !schoolId) return
    e.target.value = ''
    setUploadErr('')
    try {
      const { read, utils } = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = read(new Uint8Array(buf), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      if (!rows.length) { setUploadErr('파일에 데이터가 없습니다.'); return }

      const parsed = rows.map((r) => ({
        name: findCol(r, [...EXCEL_COLS.name]),
        company: findCol(r, [...EXCEL_COLS.company]),
        eduzip_registered: parseEduzip(findCol(r, [...EXCEL_COLS.eduzip])),
        eduzip_url: normalizeUrl(findCol(r, [...EXCEL_COLS.url])).url,
        note: findCol(r, [...EXCEL_COLS.note]),
      }))

      const named = parsed.filter((r) => r.name)
      if (!named.length) {
        setUploadErr('"소프트웨어명" 열을 찾을 수 없습니다. 열 제목을 확인해주세요.')
        return
      }

      // 파일 내 중복 — 뒤 행이 앞 행을 덮어쓴다
      const byKey = new Map<string, (typeof named)[number]>()
      for (const r of named) byKey.set(dedupeKey(r.name, r.company), r)

      const supabase = createClient()
      const { data: existing } = await supabase
        .from('approved_software')
        .select('id, name, company')
        .eq('school_id', schoolId)
      const existingMap = new Map(
        (existing ?? []).map((s) => [dedupeKey(s.name, s.company), s.id as string])
      )

      setUploadRows(
        [...byKey.values()].map((r) => {
          const id = existingMap.get(dedupeKey(r.name, r.company))
          return { ...r, _isNew: !id, _existingId: id }
        })
      )
      setUploadSkipped(parsed.length - named.length)
      setUploadOpen(true)
    } catch {
      setUploadErr('파일을 읽을 수 없습니다. .xlsx 또는 .csv 파일을 사용해주세요.')
    }
  }

  async function confirmUpload() {
    if (!schoolId) return
    setUploadSaving(true)
    setUploadErr('')
    const supabase = createClient()
    const toInsert = uploadRows.filter((r) => r._isNew)
    const toUpdate = uploadRows.filter((r) => !r._isNew)

    try {
      if (toInsert.length) {
        const { error } = await supabase.from('approved_software').insert(
          toInsert.map((r) => ({
            school_id: schoolId,
            name: r.name,
            company: r.company || null,
            eduzip_registered: r.eduzip_registered,
            eduzip_url: r.eduzip_url || null,
            note: r.note || null,
          }))
        )
        if (error) throw new Error(`등록 실패: ${error.message}`)
      }

      for (const r of toUpdate) {
        // 엑셀에 빈칸인 열은 기존 값을 덮어쓰지 않는다 (기획서 7.3)
        const patch: Record<string, unknown> = {
          eduzip_registered: r.eduzip_registered,
          is_active: true, // 사용중지였던 항목은 되살린다
          updated_at: new Date().toISOString(),
        }
        if (r.company) patch.company = r.company
        if (r.eduzip_url) patch.eduzip_url = r.eduzip_url
        if (r.note) patch.note = r.note
        const { error } = await supabase.from('approved_software').update(patch).eq('id', r._existingId!)
        if (error) throw new Error(`갱신 실패: ${error.message}`)
      }

      await logAudit({
        schoolId,
        tableName: 'approved_software',
        action: 'update',
        summary: `심의 소프트웨어 엑셀 등록 — 신규 ${toInsert.length}건, 갱신 ${toUpdate.length}건`,
        changes: {
          inserted: toInsert.map((r) => r.name),
          updated: toUpdate.map((r) => r.name),
          skipped: uploadSkipped,
        },
      })

      setUploadSaving(false)
      setUploadOpen(false)
      setUploadRows([])
      setUploadSkipped(0)
      load()
    } catch (err) {
      setUploadSaving(false)
      setUploadErr(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.')
    }
  }

  async function downloadTemplate() {
    const { utils, writeFile } = await import('xlsx')
    const ws = utils.json_to_sheet([
      { '소프트웨어명': '', '회사': '', '에듀집 등록여부': '', '주소': '', '비고': '' },
    ])
    ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 34 }, { wch: 24 }]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '심의 소프트웨어')
    writeFile(wb, '심의소프트웨어_양식.xlsx')
  }

  async function handleExport() {
    setExporting(true)
    const { utils, writeFile } = await import('xlsx')
    const ws = utils.json_to_sheet(
      activeSoftware.map((s) => ({
        '소프트웨어명': s.name,
        '회사': s.company ?? '',
        '에듀집 등록여부': s.eduzip_registered ? 'O' : '',
        '주소': s.eduzip_url ?? '',
        '비고': s.note ?? '',
      }))
    )
    ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 34 }, { wch: 24 }]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '심의 소프트웨어')
    writeFile(wb, '심의소프트웨어_목록.xlsx')
    setExporting(false)
  }

  // ── 신청 상태 변경 ─────────────────────────────────────────
  function openStatus(req: SoftwareRequest) {
    setStatusTarget(req)
    setStatusErr('')
    const goingToApproved = req.status === '처리중'
    setAlsoApprove(goingToApproved)
    setApproveForm({
      name: req.name,
      company: req.company,
      eduzip_registered: req.eduzip_registered,
      eduzip_url: req.eduzip_url,
      note: '',
    })
    setStatusSaving(false)
  }

  async function saveStatus() {
    if (!statusTarget || !schoolId) return
    const nextStatus: SoftwareRequestStatus = statusTarget.status === '처리중' ? '심의완료' : '처리중'
    setStatusSaving(true)
    setStatusErr('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let approvedId: string | null = statusTarget.approved_software_id

    try {
      if (nextStatus === '심의완료' && alsoApprove) {
        const name = approveForm.name.trim()
        if (!name) throw new Error('심의 목록에 넣을 소프트웨어명을 입력해주세요.')
        const { url, error: urlErr } = normalizeUrl(approveForm.eduzip_url)
        if (urlErr) throw new Error(urlErr)

        // 같은 이름·회사가 이미 있으면 새로 만들지 않고 기존 항목에 연결한다 (기획서 4.5)
        const { data: existing } = await supabase
          .from('approved_software')
          .select('id, name, company')
          .eq('school_id', schoolId)
        const match = (existing ?? []).find(
          (s) => dedupeKey(s.name, s.company) === dedupeKey(name, approveForm.company)
        )

        const payload = {
          name,
          company: approveForm.company.trim() || null,
          eduzip_registered: approveForm.eduzip_registered,
          eduzip_url: url || null,
          source_request_id: statusTarget.id,
          updated_at: new Date().toISOString(),
        }

        if (match) {
          const { error } = await supabase
            .from('approved_software')
            .update({ ...payload, is_active: true })
            .eq('id', match.id)
          if (error) throw new Error(`심의 목록 갱신 실패: ${error.message}`)
          approvedId = match.id as string
        } else {
          const { data: created, error } = await supabase
            .from('approved_software')
            .insert({ school_id: schoolId, ...payload })
            .select('id')
            .single()
          if (error) throw new Error(duplicateMessage(error.message))
          approvedId = created?.id ?? null
        }
      }

      const { error: reqErr } = await supabase
        .from('software_requests')
        .update({
          status: nextStatus,
          processed_at: new Date().toISOString(),
          processed_by: user?.email ?? null,
          approved_software_id: approvedId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', statusTarget.id)
      if (reqErr) throw new Error(`상태 변경 실패: ${reqErr.message}`)

      await logAudit({
        schoolId,
        tableName: 'software_requests',
        recordId: statusTarget.id,
        action: 'update',
        summary: `소프트웨어 신청 상태 변경: ${statusTarget.name} — ${statusTarget.status} → ${nextStatus}`,
        changes: {
          status: { old: statusTarget.status, new: nextStatus },
          심의목록편입: nextStatus === '심의완료' ? alsoApprove : false,
        },
      })

      setStatusSaving(false)
      setStatusTarget(null)
      load()
    } catch (err) {
      setStatusSaving(false)
      setStatusErr(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    }
  }

  const filteredRequests = useMemo(() => {
    const q = reqSearch.trim().toLowerCase()
    return requests.filter((r) => {
      if (reqFilter !== '전체' && r.status !== reqFilter) return false
      if (q) {
        const hay = `${r.name} ${r.company} ${r.requester_name} ${r.classrooms?.class_name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [requests, reqFilter, reqSearch])

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  const newCount = uploadRows.filter((r) => r._isNew).length
  const updateCount = uploadRows.length - newCount

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">소프트웨어 조회</h1>
          <p className="mt-1 text-sm text-gray-500">
            심의 소프트웨어 {activeSoftware.length}건 · 신청 {requests.length}건 (처리중 {pendingCount}건)
          </p>
        </div>
        {tab === 'approved' && (
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button variant="secondary" onClick={downloadTemplate}>양식 다운로드</Button>
            <Button variant="secondary" loading={exporting} onClick={handleExport}>내보내기</Button>
            <Button variant="secondary" onClick={() => { setUploadErr(''); fileRef.current?.click() }}>
              엑셀로 추가
            </Button>
            <Button onClick={openAdd}>+ 개별 추가</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { value: 'approved', label: `심의 목록 (${activeSoftware.length})` },
          { value: 'requests', label: `신청 현황 (${pendingCount}/${requests.length})` },
        ] as const).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
        {tab === 'approved' && inactiveSoftware.length > 0 && (
          <label className="ml-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={viewInactive}
              onChange={(e) => setViewInactive(e.target.checked)}
              className="h-4 w-4"
            />
            사용중지 목록 보기 ({inactiveSoftware.length})
          </label>
        )}
      </div>

      {uploadErr && !uploadOpen && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{uploadErr}</div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : tab === 'approved' ? (
        <>
          {viewInactive && (
            <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              사용중지된 항목입니다. 교사 화면에는 보이지 않습니다. 수정 창에서 <strong>사용재개</strong>할 수 있습니다.
            </div>
          )}
          <SoftwareList
            items={viewInactive ? inactiveSoftware : activeSoftware}
            onEdit={openEdit}
            emptyMessage={viewInactive ? '사용중지된 항목이 없습니다.' : '등록된 심의 소프트웨어가 없습니다. 엑셀로 추가하거나 개별 추가해주세요.'}
          />
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
            <div className="flex gap-1">
              {(['전체', '처리중', '심의완료'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setReqFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    reqFilter === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reqSearch}
              onChange={(e) => setReqSearch(e.target.value)}
              placeholder="소프트웨어명·회사·신청자·학급 검색"
              className={`min-w-0 flex-1 ${INPUT_CLS}`}
            />
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-xl bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
              {requests.length === 0 ? '아직 신청된 소프트웨어가 없습니다.' : '조건에 맞는 신청이 없습니다.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((r) => {
                const href = safeHref(r.eduzip_url)
                return (
                  <div key={r.id} className="rounded-xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {r.name} <span className="font-normal text-gray-400">·</span>{' '}
                          <span className="font-normal text-gray-600">{r.company}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          신청 {r.requester_name} · {r.classrooms?.class_name ?? '학급 정보 없음'} ·{' '}
                          {formatDate(r.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          label={r.eduzip_registered ? '에듀집 등록' : '에듀집 미등록'}
                          className={r.eduzip_registered ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ''}
                        />
                        <button
                          onClick={() => openStatus(r)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            r.status === '처리중'
                              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          {r.status} ▾
                        </button>
                      </div>
                    </div>

                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block break-all text-xs font-medium text-blue-600 hover:underline"
                      >
                        {r.eduzip_url} ↗
                      </a>
                    )}
                    {r.purpose && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        사용 목적: {r.purpose}
                      </p>
                    )}
                    {r.processed_at && (
                      <p className="mt-2 text-xs text-gray-400">
                        {formatDate(r.processed_at)} 처리 · {r.processed_by ?? '알 수 없음'}
                        {r.approved_software_id && ' · 심의 목록 편입됨'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 개별 추가 / 수정 모달 */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={editing ? '심의 소프트웨어 수정' : '심의 소프트웨어 추가'}
      >
        <div className="space-y-3">
          <Field label="소프트웨어명" required>
            <input
              type="text"
              value={form.name}
              maxLength={LIMITS.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={INPUT_CLS}
              placeholder="예: 미리캔버스"
            />
          </Field>
          <Field label="회사(제작사)">
            <input
              type="text"
              value={form.company}
              maxLength={LIMITS.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="에듀집 등록 여부" required>
            <EduzipRadio
              value={form.eduzip_registered}
              onChange={(v) => setForm({ ...form, eduzip_registered: v })}
            />
          </Field>
          <Field label="주소(URL)">
            <input
              type="text"
              value={form.eduzip_url}
              maxLength={LIMITS.url}
              onChange={(e) => setForm({ ...form, eduzip_url: e.target.value })}
              className={INPUT_CLS}
              placeholder="www.example.com"
            />
          </Field>
          <Field label="비고">
            <textarea
              value={form.note}
              maxLength={LIMITS.text}
              rows={3}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={`${INPUT_CLS} resize-none`}
              placeholder="사용 조건, 학년 제한 등"
            />
          </Field>

          {formErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            {editing ? (
              <Button
                variant={editing.is_active ? 'danger' : 'secondary'}
                onClick={toggleActive}
                disabled={formSaving}
              >
                {editing.is_active ? '사용중지' : '사용재개'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setFormModal(false)}>취소</Button>
              <Button loading={formSaving} onClick={saveForm}>저장</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 엑셀 미리보기 모달 */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="엑셀 미리보기"
        className="max-w-3xl"
      >
        <p className="mb-3 text-sm text-gray-600">
          읽어들인 목록 {uploadRows.length}건 (신규 {newCount} · 갱신 {updateCount})
        </p>

        <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">소프트웨어명</th>
                <th className="px-3 py-2 font-medium">회사</th>
                <th className="px-3 py-2 font-medium">에듀집</th>
                <th className="px-3 py-2 font-medium">주소</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {uploadRows.map((r, i) => (
                <tr key={`${r.name}-${i}`}>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r._isNew ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {r._isNew ? '신규' : '갱신'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-2 text-gray-600">{r.company || '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.eduzip_registered ? '등록' : '미등록'}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-gray-500">{r.eduzip_url || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {uploadSkipped > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠ 이름이 비어 있는 {uploadSkipped}개 행은 제외됩니다.
          </p>
        )}
        {updateCount > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            갱신 항목은 엑셀에 값이 있는 열만 반영되고, 빈칸인 열은 기존 값을 유지합니다.
          </p>
        )}
        {uploadErr && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{uploadErr}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setUploadOpen(false)}>취소</Button>
          <Button loading={uploadSaving} onClick={confirmUpload}>확인하고 등록</Button>
        </div>
      </Modal>

      {/* 상태 변경 모달 */}
      <Modal
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        title="신청 상태 변경"
      >
        {statusTarget && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <strong>{statusTarget.name}</strong> 신청을{' '}
              <strong>{statusTarget.status === '처리중' ? '심의완료' : '처리중'}</strong>(으)로
              변경하시겠습니까?
            </p>

            {statusTarget.status === '처리중' ? (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={alsoApprove}
                    onChange={(e) => setAlsoApprove(e.target.checked)}
                    className="h-4 w-4"
                  />
                  심의받은 소프트웨어 목록에도 추가
                </label>

                {alsoApprove && (
                  <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <Field label="소프트웨어명" required>
                      <input
                        type="text"
                        value={approveForm.name}
                        maxLength={LIMITS.name}
                        onChange={(e) => setApproveForm({ ...approveForm, name: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </Field>
                    <Field label="회사(제작사)">
                      <input
                        type="text"
                        value={approveForm.company}
                        maxLength={LIMITS.company}
                        onChange={(e) => setApproveForm({ ...approveForm, company: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </Field>
                    <Field label="에듀집 등록 여부">
                      <EduzipRadio
                        value={approveForm.eduzip_registered}
                        onChange={(v) => setApproveForm({ ...approveForm, eduzip_registered: v })}
                      />
                    </Field>
                    <Field label="주소(URL)">
                      <input
                        type="text"
                        value={approveForm.eduzip_url}
                        maxLength={LIMITS.url}
                        onChange={(e) => setApproveForm({ ...approveForm, eduzip_url: e.target.value })}
                        className={INPUT_CLS}
                      />
                    </Field>
                    <p className="text-xs text-gray-500">
                      같은 이름·회사가 이미 목록에 있으면 새로 만들지 않고 기존 항목에 연결합니다.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                처리중으로 되돌려도 이미 심의 목록에 편입된 항목은 자동으로 사라지지 않습니다.
                목록에서 빼려면 해당 항목을 <strong>사용중지</strong> 처리해주세요.
              </p>
            )}

            {statusErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{statusErr}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setStatusTarget(null)}>취소</Button>
              <Button loading={statusSaving} onClick={saveStatus}>변경</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function EduzipRadio({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-4">
      {[
        { label: '등록', v: true },
        { label: '미등록', v: false },
      ].map((o) => (
        <label key={o.label} className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="radio"
            checked={value === o.v}
            onChange={() => onChange(o.v)}
            className="h-4 w-4"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** unique index 위반을 사람이 읽을 수 있는 안내로 바꾼다 */
function duplicateMessage(message: string): string {
  if (message.includes('idx_approved_software_unique') || message.includes('duplicate key')) {
    return '같은 이름·회사의 소프트웨어가 이미 목록에 있습니다.'
  }
  return `저장 실패: ${message}`
}
