'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getTeacherSession } from '@/lib/teacher-auth'
import { ApprovedSoftware, SoftwareRequest } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { SoftwareList } from '@/components/software/SoftwareList'
import { logAudit } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { LIMITS, normalizeUrl, safeHref } from '@/lib/software'

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

const EMPTY_FORM = {
  name: '',
  company: '',
  eduzip_registered: false,
  eduzip_url: '',
  requester_name: '',
  purpose: '',
}

export default function TeacherSoftwarePage() {
  const router = useRouter()
  const [session, setSession] = useState<{
    schoolId: string
    classroomId: string
    className: string
    teacherName: string
  } | null>(null)

  const [tab, setTab] = useState<'approved' | 'requests'>('approved')
  const [software, setSoftware] = useState<ApprovedSoftware[]>([])
  const [requests, setRequests] = useState<SoftwareRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = getTeacherSession()
    if (!s) { router.push('/login/teacher'); return }
    setSession({
      schoolId: s.school_id,
      classroomId: s.classroomId,
      className: s.className,
      teacherName: s.teacherName,
    })
  }, [router])

  const load = useCallback(async (schoolId: string) => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: sw }, { data: reqs }] = await Promise.all([
      supabase
        .from('approved_software')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
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
  }, [])

  useEffect(() => {
    if (session) load(session.schoolId)
  }, [session, load])

  const myRequests = useMemo(
    () => requests.filter((r) => r.classroom_id === session?.classroomId),
    [requests, session]
  )
  const visibleRequests = showAll ? requests : myRequests

  // ── 중복 신청 안내 (S-13) ─────────────────────────────────
  const duplicateNotice = useMemo(() => {
    const key = form.name.trim().toLowerCase()
    if (key.length < 2) return null
    const inApproved = software.find((s) => s.name.trim().toLowerCase() === key)
    if (inApproved) {
      return `"${inApproved.name}"은(는) 이미 심의받은 소프트웨어 목록에 있습니다. 심의 목록 탭에서 확인해보세요.`
    }
    const inRequests = requests.find(
      (r) => r.name.trim().toLowerCase() === key && r.status === '처리중'
    )
    if (inRequests) {
      return `"${inRequests.name}"은(는) ${inRequests.classrooms?.class_name ?? '다른 학급'}에서 이미 신청해 처리중입니다.`
    }
    const done = requests.find((r) => r.name.trim().toLowerCase() === key)
    if (done) return `"${done.name}"은(는) 이미 신청되어 ${done.status} 상태입니다.`
    return null
  }, [form.name, software, requests])

  function openModal() {
    setForm({ ...EMPTY_FORM, requester_name: session?.teacherName ?? '' })
    setFormErr('')
    setModalOpen(true)
  }

  async function submit() {
    if (!session) return
    const name = form.name.trim()
    const company = form.company.trim()
    const requester = form.requester_name.trim()
    if (!name) { setFormErr('소프트웨어명을 입력해주세요.'); return }
    if (!company) { setFormErr('회사(제작사)를 입력해주세요.'); return }
    if (!requester) { setFormErr('신청 교사명을 입력해주세요.'); return }
    if (!form.eduzip_url.trim()) { setFormErr('주소(URL)를 입력해주세요.'); return }
    const { url, error: urlErr } = normalizeUrl(form.eduzip_url)
    if (urlErr) { setFormErr(urlErr); return }

    setSaving(true)
    setFormErr('')
    const supabase = createClient()
    const { data: inserted, error } = await supabase
      .from('software_requests')
      .insert({
        school_id: session.schoolId,
        classroom_id: session.classroomId,
        requester_name: requester,
        name,
        company,
        eduzip_registered: form.eduzip_registered,
        eduzip_url: url,
        purpose: form.purpose.trim() || null,
      })
      .select('id')
      .single()
    setSaving(false)
    if (error) { setFormErr(`신청 실패: ${error.message}`); return }

    await logAudit({
      schoolId: session.schoolId,
      tableName: 'software_requests',
      recordId: inserted?.id,
      action: 'insert',
      summary: `소프트웨어 신청: ${name} (${company})`,
      changes: { name, company, eduzip_url: url, requester_name: requester },
      actor: `${session.className} (교사)`,
    })

    setModalOpen(false)
    setTab('requests')
    load(session.schoolId)
  }

  if (!session) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">소프트웨어 조회</h1>
        <p className="mt-1 text-sm text-gray-500">
          학교에서 심의받은 소프트웨어를 찾아보고, 없는 것은 신청할 수 있습니다.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          { value: 'approved', label: `심의 목록 (${software.length})` },
          { value: 'requests', label: `내 신청 (${myRequests.length})` },
        ] as const).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : tab === 'approved' ? (
        <>
          <SoftwareList
            items={software}
            accent="emerald"
            emptyMessage="아직 등록된 심의 소프트웨어가 없습니다. 정보 담당 선생님께 문의해주세요."
          />
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            찾는 소프트웨어가 없나요?{' '}
            <button onClick={openModal} className="font-semibold underline">
              소프트웨어 신청하기
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openModal}>
              + 소프트웨어 신청
            </Button>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-4 w-4"
              />
              학교 전체 신청 보기 ({requests.length})
            </label>
          </div>

          {visibleRequests.length === 0 ? (
            <div className="rounded-xl bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
              {showAll ? '아직 신청된 소프트웨어가 없습니다.' : '우리 학급의 신청 내역이 없습니다.'}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRequests.map((r) => {
                const href = safeHref(r.eduzip_url)
                const mine = r.classroom_id === session.classroomId
                return (
                  <div key={r.id} className="rounded-xl bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          {r.name} <span className="font-normal text-gray-400">·</span>{' '}
                          <span className="font-normal text-gray-600">{r.company}</span>
                          {showAll && mine && (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              우리 학급
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {r.eduzip_registered ? '에듀집 등록' : '에듀집 미등록'}
                          {href && (
                            <>
                              {' · '}
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all font-medium text-emerald-700 hover:underline"
                              >
                                {r.eduzip_url} ↗
                              </a>
                            </>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          신청 {r.requester_name} · {r.classrooms?.class_name ?? '학급 정보 없음'} ·{' '}
                          {formatDate(r.created_at)}
                        </p>
                      </div>
                      <Badge
                        label={r.status}
                        className={
                          r.status === '처리중'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }
                      />
                    </div>
                    {r.purpose && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        사용 목적: {r.purpose}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-400">
            신청 내용을 고치거나 취소하려면 정보 담당 선생님께 말씀해주세요. 상태 변경은 관리자만 할 수 있습니다.
          </p>
        </div>
      )}

      {/* 신청 모달 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="소프트웨어 신청">
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

          {duplicateNotice && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">⚠ {duplicateNotice}</p>
          )}

          <Field label="회사(제작사)" required>
            <input
              type="text"
              value={form.company}
              maxLength={LIMITS.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className={INPUT_CLS}
            />
          </Field>

          <Field label="에듀집 등록 여부" required>
            <div className="flex gap-4">
              {[
                { label: '등록', v: true },
                { label: '미등록', v: false },
              ].map((o) => (
                <label key={o.label} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={form.eduzip_registered === o.v}
                    onChange={() => setForm({ ...form, eduzip_registered: o.v })}
                    className="h-4 w-4"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="주소(URL)" required>
            <input
              type="text"
              value={form.eduzip_url}
              maxLength={LIMITS.url}
              onChange={(e) => setForm({ ...form, eduzip_url: e.target.value })}
              className={INPUT_CLS}
              placeholder="www.example.com"
            />
          </Field>

          <Field label="신청 교사명" required>
            <input
              type="text"
              value={form.requester_name}
              maxLength={LIMITS.name}
              onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
              className={INPUT_CLS}
              placeholder="학급 계정을 함께 쓰므로 이름을 적어주세요"
            />
          </Field>

          <Field label="사용 목적">
            <textarea
              value={form.purpose}
              maxLength={LIMITS.text}
              rows={3}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className={`${INPUT_CLS} resize-none`}
              placeholder="어떤 수업에 어떻게 쓸지 적어주세요."
            />
          </Field>

          {formErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formErr}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button loading={saving} onClick={submit} className="bg-emerald-600 hover:bg-emerald-700">
              보내기
            </Button>
          </div>
        </div>
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
