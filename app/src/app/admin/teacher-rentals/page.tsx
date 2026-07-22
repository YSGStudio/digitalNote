'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TeacherDeviceLoan, TeacherLoanStatus } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SignaturePad, SignaturePadHandle } from '@/components/ui/SignaturePad'
import { formatDate } from '@/lib/utils'
import { useSchool } from '@/lib/school-context'

const DEVICE_TYPES = ['iPad', '노트북', '기타']
const PART_OPTIONS = ['충전기', '케이블', '케이스', '펜', '기타']
const CONDITIONS = ['정상', '일부 손상', '고장', '기타']

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const LOAN_NOTICE =
  '고장 및 분실 시 수리해서 반납하고, 분실했을 경우 동일한 사양의 컴퓨터로 반납한다.'

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function deviceLabel(loan: TeacherDeviceLoan) {
  return loan.device_type === '기타' ? loan.device_etc || '기타' : loan.device_type || '-'
}

function partsLabel(loan: TeacherDeviceLoan) {
  const parts = loan.parts ?? []
  if (!parts.length) return null
  return parts
    .map((p) => (p === '기타' ? loan.parts_etc || '기타' : p))
    .join(', ')
}

export default function TeacherRentalsPage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [loans, setLoans] = useState<TeacherDeviceLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeacherLoanStatus | 'all'>('all')

  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    borrower_name: '',
    rent_date: todayStr(),
    device_type: '',
    device_etc: '',
    model: '',
    asset_no: '',
    parts: [] as string[],
    parts_etc: '',
    note: '',
  })
  const [addSaving, setAddSaving] = useState(false)
  const [addErr, setAddErr] = useState('')
  const borrowerSigRef = useRef<SignaturePadHandle>(null)
  const managerOutSigRef = useRef<SignaturePadHandle>(null)

  const [returnTarget, setReturnTarget] = useState<TeacherDeviceLoan | null>(null)
  const [returnForm, setReturnForm] = useState({
    return_date: todayStr(),
    condition: '',
    condition_etc: '',
    return_note: '',
    manager_in_name: '',
  })
  const [returnSaving, setReturnSaving] = useState(false)
  const [returnErr, setReturnErr] = useState('')
  const returnerSigRef = useRef<SignaturePadHandle>(null)
  const managerInSigRef = useRef<SignaturePadHandle>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('teacher_device_loans')
      .select('*')
      .eq('school_id', schoolId)
      .order('rent_date', { ascending: false })
      .order('created_at', { ascending: false })
    setLoans((data as TeacherDeviceLoan[]) ?? [])
    setLoading(false)
  }, [schoolId])

  useEffect(() => { load() }, [load])

  function openAddModal() {
    setAddForm({
      borrower_name: '',
      rent_date: todayStr(),
      device_type: '',
      device_etc: '',
      model: '',
      asset_no: '',
      parts: [],
      parts_etc: '',
      note: '',
    })
    setAddErr('')
    setAddModal(true)
  }

  function toggleAddPart(part: string) {
    setAddForm((f) => ({
      ...f,
      parts: f.parts.includes(part) ? f.parts.filter((p) => p !== part) : [...f.parts, part],
    }))
  }

  async function handleAddSave() {
    if (!schoolId) return
    if (!addForm.borrower_name.trim()) { setAddErr('빌리는 교사의 성명을 입력해주세요.'); return }
    if (borrowerSigRef.current?.isEmpty()) { setAddErr('대여자 서명을 받아주세요.'); return }
    if (managerOutSigRef.current?.isEmpty()) { setAddErr('담당자 서명을 받아주세요.'); return }

    setAddSaving(true)
    setAddErr('')
    const supabase = createClient()
    const { error } = await supabase.from('teacher_device_loans').insert({
      school_id: schoolId,
      status: '대여중',
      borrower_name: addForm.borrower_name.trim(),
      rent_date: addForm.rent_date,
      device_type: addForm.device_type || null,
      device_etc: addForm.device_type === '기타' ? addForm.device_etc.trim() || null : null,
      model: addForm.model.trim() || null,
      asset_no: addForm.asset_no.trim() || null,
      parts: addForm.parts.length ? addForm.parts : null,
      parts_etc: addForm.parts.includes('기타') ? addForm.parts_etc.trim() || null : null,
      note: addForm.note.trim() || null,
      sig_borrower: borrowerSigRef.current!.toDataURL(),
      sig_manager_out: managerOutSigRef.current!.toDataURL(),
    })
    setAddSaving(false)
    if (error) { setAddErr(`저장 실패: ${error.message}`); return }
    setAddModal(false)
    load()
  }

  function openReturnModal(loan: TeacherDeviceLoan) {
    setReturnForm({
      return_date: todayStr(),
      condition: '',
      condition_etc: '',
      return_note: '',
      manager_in_name: '',
    })
    setReturnErr('')
    setReturnTarget(loan)
  }

  async function handleReturnSave() {
    if (!returnTarget) return
    if (!returnForm.condition) { setReturnErr('기기 상태를 선택해주세요.'); return }
    if (!returnForm.manager_in_name.trim()) { setReturnErr('처리 담당자 이름을 입력해주세요.'); return }
    if (returnerSigRef.current?.isEmpty()) { setReturnErr('반납자 서명을 받아주세요.'); return }
    if (managerInSigRef.current?.isEmpty()) { setReturnErr('담당자 서명을 받아주세요.'); return }

    setReturnSaving(true)
    setReturnErr('')
    const supabase = createClient()
    const { error } = await supabase
      .from('teacher_device_loans')
      .update({
        status: '반납완료',
        return_date: returnForm.return_date,
        condition: returnForm.condition,
        condition_etc: returnForm.condition === '기타' ? returnForm.condition_etc.trim() || null : null,
        return_note: returnForm.return_note.trim() || null,
        sig_returner: returnerSigRef.current!.toDataURL(),
        sig_manager_in: managerInSigRef.current!.toDataURL(),
        manager_in_name: returnForm.manager_in_name.trim(),
      })
      .eq('id', returnTarget.id)
    setReturnSaving(false)
    if (error) { setReturnErr(`저장 실패: ${error.message}`); return }
    setReturnTarget(null)
    load()
  }

  const filteredLoans = loans.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.borrower_name.toLowerCase().includes(q) ||
      (l.model ?? '').toLowerCase().includes(q) ||
      (l.asset_no ?? '').toLowerCase().includes(q) ||
      deviceLabel(l).toLowerCase().includes(q)
    )
  })

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교사기기대여</h1>
          <p className="mt-1 text-sm text-gray-500">
            교사 개인용 iPad·노트북 등의 대여증·반납증을 관리합니다. (계정 없이 서명만 받습니다)
          </p>
        </div>
        <Button onClick={openAddModal}>+ 새 대여</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {(
            [
              { value: 'all', label: '전체' },
              { value: '대여중', label: '대여중' },
              { value: '반납완료', label: '반납완료' },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === t.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="성명·모델명·자산관리번호 검색..."
          className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : filteredLoans.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">
            {search || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 대여 기록이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLoans.map((loan) => (
            <div key={loan.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">대여</span>
                    <span className="text-sm text-gray-500">{formatDate(loan.rent_date)}</span>
                  </div>
                  <p className="mt-1 font-semibold text-gray-900">
                    {loan.borrower_name} · {deviceLabel(loan)}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {[loan.model, loan.asset_no ? `자산 ${loan.asset_no}` : '', partsLabel(loan)]
                      .filter(Boolean)
                      .join(' · ') || '-'}
                  </p>
                </div>
                <Link href={`/admin/teacher-rentals/${loan.id}/document`} target="_blank">
                  <Button size="sm" variant="secondary">대여증</Button>
                </Link>
              </div>

              <div className="border-t border-dashed border-gray-200 px-5 py-4">
                {loan.status === '대여중' ? (
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      대여중
                    </span>
                    <span className="text-sm text-gray-400">아직 반납되지 않았습니다.</span>
                    <Button size="sm" onClick={() => openReturnModal(loan)}>반납 처리</Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">반납</span>
                        <span className="text-sm text-gray-500">{formatDate(loan.return_date)}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        기기 상태 {loan.condition === '기타' ? loan.condition_etc || '기타' : loan.condition}
                      </p>
                    </div>
                    <Link href={`/admin/teacher-rentals/${loan.id}/document`} target="_blank">
                      <Button size="sm" variant="secondary">반납증</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 대여 등록 모달 */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="새 대여 등록" className="max-w-lg">
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">성명 (빌리는 교사) *</label>
            <input
              type="text"
              value={addForm.borrower_name}
              onChange={(e) => setAddForm({ ...addForm, borrower_name: e.target.value })}
              className={INPUT_CLS}
              placeholder="김하늘"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">대여일</label>
            <input
              type="date"
              value={addForm.rent_date}
              onChange={(e) => setAddForm({ ...addForm, rent_date: e.target.value })}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">기기 종류</label>
            <div className="flex flex-wrap gap-2">
              {DEVICE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAddForm({ ...addForm, device_type: t })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    addForm.device_type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {addForm.device_type === '기타' && (
              <input
                type="text"
                value={addForm.device_etc}
                onChange={(e) => setAddForm({ ...addForm, device_etc: e.target.value })}
                className={`${INPUT_CLS} mt-2`}
                placeholder="기기 종류 직접 입력"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">모델명</label>
              <input
                type="text"
                value={addForm.model}
                onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                className={INPUT_CLS}
                placeholder="iPad 10세대 64GB"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">자산관리번호</label>
              <input
                type="text"
                value={addForm.asset_no}
                onChange={(e) => setAddForm({ ...addForm, asset_no: e.target.value })}
                className={INPUT_CLS}
                placeholder="A-1024"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">구성품</label>
            <div className="flex flex-wrap gap-2">
              {PART_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleAddPart(p)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    addForm.parts.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {addForm.parts.includes('기타') && (
              <input
                type="text"
                value={addForm.parts_etc}
                onChange={(e) => setAddForm({ ...addForm, parts_etc: e.target.value })}
                className={`${INPUT_CLS} mt-2`}
                placeholder="기타 구성품 직접 입력"
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              특이사항 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <textarea
              value={addForm.note}
              onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
              rows={2}
              className={INPUT_CLS}
            />
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {LOAN_NOTICE}
          </p>

          <SignaturePad ref={borrowerSigRef} label="대여자 서명 (빌리는 교사)" />
          <SignaturePad ref={managerOutSigRef} label="담당자 서명" />

          {addErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{addErr}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setAddModal(false)}>취소</Button>
            <Button loading={addSaving} onClick={handleAddSave}>저장 및 대여증 발급</Button>
          </div>
        </div>
      </Modal>

      {/* 반납 처리 모달 */}
      <Modal open={returnTarget !== null} onClose={() => setReturnTarget(null)} title="반납 처리" className="max-w-lg">
        {returnTarget && (
          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              <p className="font-medium text-gray-900">{returnTarget.borrower_name} · {deviceLabel(returnTarget)}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {[returnTarget.model, returnTarget.asset_no ? `자산 ${returnTarget.asset_no}` : '', partsLabel(returnTarget)]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">반납일</label>
              <input
                type="date"
                value={returnForm.return_date}
                onChange={(e) => setReturnForm({ ...returnForm, return_date: e.target.value })}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">기기 상태 *</label>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setReturnForm({ ...returnForm, condition: c })}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      returnForm.condition === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {returnForm.condition === '기타' && (
                <input
                  type="text"
                  value={returnForm.condition_etc}
                  onChange={(e) => setReturnForm({ ...returnForm, condition_etc: e.target.value })}
                  className={`${INPUT_CLS} mt-2`}
                  placeholder="기기 상태 직접 입력"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                반납 특이사항 <span className="font-normal text-gray-400">(선택)</span>
              </label>
              <textarea
                value={returnForm.return_note}
                onChange={(e) => setReturnForm({ ...returnForm, return_note: e.target.value })}
                rows={2}
                className={INPUT_CLS}
                placeholder="손상 부위, 분실 구성품 등"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">처리 담당자 이름 *</label>
              <input
                type="text"
                value={returnForm.manager_in_name}
                onChange={(e) => setReturnForm({ ...returnForm, manager_in_name: e.target.value })}
                className={INPUT_CLS}
                placeholder="담당자 성명"
              />
            </div>

            <SignaturePad ref={returnerSigRef} label="반납자 서명 (돌려주는 교사)" />
            <SignaturePad ref={managerInSigRef} label="담당자 서명" />

            {returnErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{returnErr}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setReturnTarget(null)}>취소</Button>
              <Button loading={returnSaving} onClick={handleReturnSave}>저장 및 반납증 발급</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
