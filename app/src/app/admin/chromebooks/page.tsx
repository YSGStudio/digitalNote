'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Student, Chromebook } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'
import { useSchool } from '@/lib/school-context'

type StudentWithDevice = Student & { chromebooks: Chromebook[] }
type ChromebookWithStudent = Chromebook & { students: Student | null }

type StudentUploadRow = {
  name: string
  grade: string
  class_name: string
  student_number: string
  device_number: string
  _isNew: boolean
}

type DeviceUploadRow = {
  device_number: string
  device_year: string
}

type PromoUploadRow = {
  name: string
  grade: string
  class_name: string
  student_number: string
  _status: 'matched' | 'new' | 'ambiguous'
  _studentId?: string
}

function findCol(row: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')
    const found = keys.find((k) => norm(k) === norm(c))
    if (found !== undefined) return String(row[found] ?? '').trim()
  }
  return ''
}

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function ChromebooksPage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [students, setStudents] = useState<StudentWithDevice[]>([])
  const [chromebooks, setChromebooks] = useState<ChromebookWithStudent[]>([])
  const [tab, setTab] = useState<'students' | 'devices'>('students')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Upload
  const [uploadType, setUploadType] = useState<'students' | 'devices' | null>(null)
  const [studentUploadRows, setStudentUploadRows] = useState<StudentUploadRow[]>([])
  const [deviceUploadRows, setDeviceUploadRows] = useState<DeviceUploadRow[]>([])
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const studentFileRef = useRef<HTMLInputElement>(null)
  const deviceFileRef = useRef<HTMLInputElement>(null)

  // Promotion (진급)
  const [promoModal, setPromoModal] = useState(false)
  const [promoBusy, setPromoBusy] = useState<'graduate' | 'promote' | null>(null)
  const [promoMsg, setPromoMsg] = useState('')
  const [promoErr, setPromoErr] = useState('')
  const [promoRows, setPromoRows] = useState<PromoUploadRow[]>([])
  const [promoSaving, setPromoSaving] = useState(false)
  const promoFileRef = useRef<HTMLInputElement>(null)

  // Assign device
  const [assignTarget, setAssignTarget] = useState<StudentWithDevice | null>(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Student add/edit form
  const [studentModal, setStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentWithDevice | null>(null)
  const [studentForm, setStudentForm] = useState({
    name: '', grade: '', class_name: '', student_number: '',
  })
  const [studentSaving, setStudentSaving] = useState(false)
  const [studentFormErr, setStudentFormErr] = useState('')
  const [deviceModal, setDeviceModal] = useState(false)
  const [deviceForm, setDeviceForm] = useState({ device_number: '', device_year: '' })
  const [deviceFormSaving, setDeviceFormSaving] = useState(false)
  const [deviceFormErr, setDeviceFormErr] = useState('')
  const [exporting, setExporting] = useState(false)
  const [filterGrade, setFilterGrade] = useState('')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [deletingDevices, setDeletingDevices] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    const supabase = createClient()
    const [{ data: studs }, { data: devs }] = await Promise.all([
      supabase
        .from('students')
        .select('*, chromebooks(*)')
        .eq('school_id', schoolId)
        .order('grade', { ascending: true })
        .order('class_name', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('chromebooks')
        .select('*, students(*)')
        .eq('school_id', schoolId)
        .order('device_number', { ascending: true }),
    ])
    // PostgREST treats UNIQUE FK (student_id) as 1:1, returning an object instead of array.
    // Normalize to always be an array.
    // PostgREST treats UNIQUE FK (student_id) as 1:1, returning an object instead of array.
    // Normalize to always be an array.
    const normalizedStuds: StudentWithDevice[] = (studs ?? []).map((s: unknown) => {
      const row = s as StudentWithDevice & { chromebooks: unknown }
      const cb = row.chromebooks
      return {
        ...row,
        chromebooks: cb == null ? [] : Array.isArray(cb) ? cb : [cb as Chromebook],
      }
    })
    setStudents(normalizedStuds)
    setChromebooks((devs as ChromebookWithStudent[]) ?? [])
    setLoading(false)
  }, [schoolId])

  useEffect(() => { load() }, [load])

  async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(new Uint8Array(buf), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
  }

  async function handleStudentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadErr('')
    try {
      const rows = await parseExcelFile(file)
      if (!rows.length) { setUploadErr('파일에 데이터가 없습니다.'); return }

      const parsed = rows
        .map((r) => ({
          name: findCol(r, ['이름', '성명', '학생명', 'name']),
          grade: findCol(r, ['학년', 'grade']),
          class_name: findCol(r, ['반', '학급', '학년반', 'class']),
          student_number: findCol(r, ['번호', '출석번호', '학번', 'number', 'no']),
          device_number: findCol(r, ['기기번호', '시리얼번호', '시리얼', 'serial', 'device']),
        }))
        .filter((r) => r.name)

      if (!parsed.length) {
        setUploadErr('"이름" 열을 찾을 수 없습니다. 열 제목을 확인해주세요.')
        return
      }

      const supabase = createClient()
      const { data: existing } = await supabase.from('students').select('name, grade, class_name')
      const existingSet = new Set(
        (existing ?? []).map((s) => `${s.name}|${s.grade ?? ''}|${s.class_name ?? ''}`)
      )

      setStudentUploadRows(
        parsed.map((r) => ({
          ...r,
          _isNew: !existingSet.has(`${r.name}|${r.grade}|${r.class_name}`),
        }))
      )
      setUploadType('students')
    } catch {
      setUploadErr('파일을 읽을 수 없습니다. .xlsx 또는 .csv 파일을 사용해주세요.')
    }
  }

  async function handleDeviceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploadErr('')
    try {
      const rows = await parseExcelFile(file)
      if (!rows.length) { setUploadErr('파일에 데이터가 없습니다.'); return }

      const parsed: DeviceUploadRow[] = rows
        .map((r) => ({
          device_number: findCol(r, ['기기번호', '시리얼번호', '시리얼', '번호', 'serial', 'device', 'number']),
          device_year: findCol(r, ['기기년도', '년도', '연도', '구입년도', '구매년도', 'year']),
        }))
        .filter((r) => r.device_number)

      if (!parsed.length) {
        setUploadErr('"기기번호" 열을 찾을 수 없습니다. 열 제목을 확인해주세요.')
        return
      }
      setDeviceUploadRows(parsed)
      setUploadType('devices')
    } catch {
      setUploadErr('파일을 읽을 수 없습니다.')
    }
  }

  async function confirmUpload() {
    if (!schoolId) return
    setUploadSaving(true)
    setUploadErr('')
    const supabase = createClient()

    try {
    if (uploadType === 'devices') {
      const { data: existing, error: fetchErr } = await supabase.from('chromebooks').select('id, device_number').eq('school_id', schoolId)
      if (fetchErr) throw new Error(`기기 목록 조회 실패: ${fetchErr.message}`)
      const existingMap = new Map((existing ?? []).map((c) => [c.device_number, c.id]))

      const toInsert = deviceUploadRows.filter((r) => !existingMap.has(r.device_number))
      const toUpdate = deviceUploadRows.filter((r) => existingMap.has(r.device_number))

      if (toInsert.length) {
        const { error: insertErr } = await supabase.from('chromebooks').insert(
          toInsert.map((r) => ({
            school_id: schoolId,
            device_number: r.device_number,
            device_year: r.device_year || null,
          }))
        )
        if (insertErr) throw new Error(`기기 등록 실패: ${insertErr.message}`)
      }
      for (const r of toUpdate) {
        const { error: updateErr } = await supabase
          .from('chromebooks')
          .update({ device_year: r.device_year || null })
          .eq('id', existingMap.get(r.device_number)!)
        if (updateErr) throw new Error(`기기 업데이트 실패: ${updateErr.message}`)
      }
    } else if (uploadType === 'students') {
      const { data: existing } = await supabase
        .from('students')
        .select('id, name, grade, class_name')
        .eq('school_id', schoolId)
      const existingMap = new Map<string, string>()
      for (const s of (existing ?? [])) {
        existingMap.set(`${s.name}|${s.grade ?? ''}|${s.class_name ?? ''}`, s.id)
      }

      for (const row of studentUploadRows) {
        const key = `${row.name}|${row.grade}|${row.class_name}`
        const existingId = existingMap.get(key)
        let studentId: string

        if (existingId) {
          await supabase
            .from('students')
            .update({
              grade: row.grade || null,
              class_name: row.class_name || null,
              student_number: row.student_number || null,
            })
            .eq('id', existingId)
          studentId = existingId
        } else {
          const { data: s } = await supabase
            .from('students')
            .insert({
              school_id: schoolId,
              name: row.name,
              grade: row.grade || null,
              class_name: row.class_name || null,
              student_number: row.student_number || null,
            })
            .select('id')
            .single()
          if (!s) continue
          studentId = s.id
        }

        if (row.device_number) {
          await supabase
            .from('chromebooks')
            .update({ student_id: null, assigned_at: null })
            .eq('student_id', studentId)
          await supabase.from('chromebooks').upsert(
            {
              school_id: schoolId,
              device_number: row.device_number,
              student_id: studentId,
              assigned_at: new Date().toISOString(),
            },
            { onConflict: 'device_number' }
          )
        }
      }
    }

    setUploadSaving(false)
    setUploadType(null)
    setStudentUploadRows([])
    setDeviceUploadRows([])
    load()
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
      setUploadSaving(false)
    }
  }

  async function handleAssign(device: ChromebookWithStudent) {
    if (!assignTarget) return
    setAssigning(true)
    const supabase = createClient()
    await supabase
      .from('chromebooks')
      .update({ student_id: null, assigned_at: null })
      .eq('student_id', assignTarget.id)
    await supabase
      .from('chromebooks')
      .update({ student_id: assignTarget.id, assigned_at: new Date().toISOString() })
      .eq('id', device.id)
    setAssigning(false)
    setAssignTarget(null)
    setDeviceSearch('')
    load()
  }

  async function handleUnassign(device: Chromebook) {
    const supabase = createClient()
    await supabase
      .from('chromebooks')
      .update({ student_id: null, assigned_at: null })
      .eq('id', device.id)
    load()
  }

  async function handleDeleteStudent(student: Student) {
    if (!confirm(`"${student.name}" 학생을 삭제하시겠습니까? 배정된 기기는 미배정 상태로 변경됩니다.`))
      return
    const supabase = createClient()
    await supabase.from('students').delete().eq('id', student.id)
    load()
  }

  const sixthGraders = students.filter((s) => s.grade === '6')

  async function handleGraduate() {
    if (!schoolId || !sixthGraders.length) return
    if (!confirm(`6학년 ${sixthGraders.length}명을 졸업 처리(삭제)하시겠습니까?\n배정된 크롬북은 자동으로 미배정 상태가 되어 재배정할 수 있습니다.`))
      return
    setPromoBusy('graduate')
    setPromoErr('')
    const supabase = createClient()
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('school_id', schoolId)
      .eq('grade', '6')
    setPromoBusy(null)
    if (error) { setPromoErr(`졸업 처리 실패: ${error.message}`); return }
    setPromoMsg(`졸업생 ${sixthGraders.length}명을 삭제했습니다.`)
    load()
  }

  async function handlePromote() {
    if (!schoolId) return
    if (sixthGraders.length > 0) {
      if (!confirm(`아직 6학년 ${sixthGraders.length}명이 남아 있습니다.\n먼저 1단계 졸업 처리를 하는 것을 권장합니다.\n\n그래도 진급을 실행할까요? (6학년은 그대로 유지됩니다)`))
        return
    } else if (!confirm('전체 학생의 학년을 +1 올리고, 반·번호를 초기화합니다.\n크롬북 배정은 그대로 유지됩니다. 실행할까요?')) {
      return
    }
    setPromoBusy('promote')
    setPromoErr('')
    const supabase = createClient()
    // 5학년부터 내림차순으로 처리해야 이미 올린 학년이 다시 올라가지 않음
    for (const g of [5, 4, 3, 2, 1]) {
      const { error } = await supabase
        .from('students')
        .update({ grade: String(g + 1), class_name: null, student_number: null })
        .eq('school_id', schoolId)
        .eq('grade', String(g))
      if (error) {
        setPromoErr(`진급 처리 실패 (${g}학년): ${error.message}`)
        setPromoBusy(null)
        return
      }
    }
    setPromoBusy(null)
    setPromoMsg('진급 완료 — 전체 학년 +1, 반·번호 초기화됨. 이제 3단계에서 새 반편성 명단을 업로드하세요.')
    load()
  }

  async function handlePromoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPromoErr('')
    try {
      const rows = await parseExcelFile(file)
      if (!rows.length) { setPromoErr('파일에 데이터가 없습니다.'); return }

      const parsed = rows
        .map((r) => ({
          name: findCol(r, ['이름', '성명', '학생명', 'name']),
          grade: findCol(r, ['학년', 'grade']),
          class_name: findCol(r, ['반', '학급', 'class']),
          student_number: findCol(r, ['번호', '출석번호', '학번', 'number', 'no']),
        }))
        .filter((r) => r.name)

      if (!parsed.length) {
        setPromoErr('"이름" 열을 찾을 수 없습니다. 열 제목을 확인해주세요.')
        return
      }

      // 이름+학년 우선 매칭, 실패 시 이름 단독 매칭 (이름이 유일할 때만)
      const byNameGrade = new Map<string, StudentWithDevice[]>()
      const byName = new Map<string, StudentWithDevice[]>()
      for (const s of students) {
        const kg = `${s.name}|${s.grade ?? ''}`
        byNameGrade.set(kg, [...(byNameGrade.get(kg) ?? []), s])
        byName.set(s.name, [...(byName.get(s.name) ?? []), s])
      }

      setPromoRows(
        parsed.map((r) => {
          const gradeMatches = byNameGrade.get(`${r.name}|${r.grade}`) ?? []
          if (gradeMatches.length === 1)
            return { ...r, _status: 'matched' as const, _studentId: gradeMatches[0].id }
          if (gradeMatches.length > 1) return { ...r, _status: 'ambiguous' as const }
          const nameMatches = byName.get(r.name) ?? []
          if (nameMatches.length === 1)
            return { ...r, _status: 'matched' as const, _studentId: nameMatches[0].id }
          if (nameMatches.length > 1) return { ...r, _status: 'ambiguous' as const }
          return { ...r, _status: 'new' as const }
        })
      )
    } catch {
      setPromoErr('파일을 읽을 수 없습니다. .xlsx 또는 .csv 파일을 사용해주세요.')
    }
  }

  async function confirmPromoUpload() {
    if (!schoolId) return
    setPromoSaving(true)
    setPromoErr('')
    const supabase = createClient()
    try {
      for (const row of promoRows) {
        if (row._status === 'ambiguous') continue
        if (row._status === 'matched' && row._studentId) {
          const { error } = await supabase
            .from('students')
            .update({
              grade: row.grade || null,
              class_name: row.class_name || null,
              student_number: row.student_number || null,
            })
            .eq('id', row._studentId)
          if (error) throw new Error(`${row.name} 업데이트 실패: ${error.message}`)
        } else if (row._status === 'new') {
          const { error } = await supabase.from('students').insert({
            school_id: schoolId,
            name: row.name,
            grade: row.grade || null,
            class_name: row.class_name || null,
            student_number: row.student_number || null,
          })
          if (error) throw new Error(`${row.name} 추가 실패: ${error.message}`)
        }
      }
      const ambiguousCount = promoRows.filter((r) => r._status === 'ambiguous').length
      setPromoMsg(
        ambiguousCount > 0
          ? `반편성 적용 완료. 동명이인 ${ambiguousCount}명은 자동 처리되지 않았으니 학생 현황에서 직접 수정해주세요.`
          : '새 반편성 적용 완료.'
      )
      setPromoRows([])
      load()
    } catch (err) {
      setPromoErr(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setPromoSaving(false)
    }
  }

  async function saveDevice() {
    if (!deviceForm.device_number.trim()) { setDeviceFormErr('기기번호를 입력해주세요.'); return }
    if (!schoolId) return
    setDeviceFormSaving(true)
    setDeviceFormErr('')
    const supabase = createClient()
    const { error } = await supabase.from('chromebooks').insert({
      school_id: schoolId,
      device_number: deviceForm.device_number.trim(),
      device_year: deviceForm.device_year.trim() || null,
    })
    if (error) {
      setDeviceFormErr(error.code === '23505' ? '이미 등록된 기기번호입니다.' : error.message)
      setDeviceFormSaving(false)
      return
    }
    setDeviceFormSaving(false)
    setDeviceModal(false)
    setDeviceForm({ device_number: '', device_year: '' })
    load()
  }

  async function handleDeleteDevice(id: string) {
    if (!confirm('기기를 삭제하시겠습니까? 배정된 학생 데이터는 유지됩니다.')) return
    const supabase = createClient()
    await supabase.from('chromebooks').delete().eq('id', id)
    setSelectedDeviceIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    load()
  }

  async function handleDeleteSelectedDevices() {
    if (!selectedDeviceIds.size) return
    if (!confirm(`선택한 기기 ${selectedDeviceIds.size}개를 삭제하시겠습니까?\n배정된 학생 데이터는 유지됩니다.`)) return
    setDeletingDevices(true)
    const supabase = createClient()
    await supabase.from('chromebooks').delete().in('id', [...selectedDeviceIds])
    setSelectedDeviceIds(new Set())
    setDeletingDevices(false)
    load()
  }

  async function handleExport() {
    setExporting(true)
    const { utils, writeFile } = await import('xlsx')

    const rows = students.map((s) => {
      const device = s.chromebooks?.[0]
      return {
        '학년': s.grade ?? '',
        '반': s.class_name ?? '',
        '번호': s.student_number ?? '',
        '이름': s.name,
        '기기번호': device?.device_number ?? '',
        '기기년도': device?.device_year ?? '',
      }
    })

    const ws = utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 10 },
    ]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, '크롬북 현황')
    writeFile(wb, '크롬북_현황.xlsx')
    setExporting(false)
  }

  function openAddStudent() {
    setEditingStudent(null)
    setStudentForm({ name: '', grade: '', class_name: '', student_number: '' })
    setStudentFormErr('')
    setStudentModal(true)
  }

  function openEditStudent(s: StudentWithDevice) {
    setEditingStudent(s)
    setStudentForm({
      name: s.name,
      grade: s.grade ?? '',
      class_name: s.class_name ?? '',
      student_number: s.student_number ?? '',
    })
    setStudentFormErr('')
    setStudentModal(true)
  }

  async function saveStudent() {
    if (!studentForm.name.trim()) { setStudentFormErr('이름을 입력해주세요.'); return }
    if (!schoolId) return
    setStudentSaving(true)
    setStudentFormErr('')
    const supabase = createClient()
    const payload = {
      name: studentForm.name.trim(),
      grade: studentForm.grade.trim() || null,
      class_name: studentForm.class_name.trim() || null,
      student_number: studentForm.student_number.trim() || null,
    }
    const { error } = editingStudent
      ? await supabase.from('students').update(payload).eq('id', editingStudent.id)
      : await supabase.from('students').insert({ ...payload, school_id: schoolId })

    if (error) {
      setStudentFormErr(`저장 실패: ${error.message}`)
      setStudentSaving(false)
      return
    }
    setStudentSaving(false)
    setStudentModal(false)
    load()
  }

  const filteredStudents = students.filter((s) => {
    if (filterGrade && s.grade !== filterGrade) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.chromebooks ?? []).some((c) => c.device_number?.toLowerCase().includes(q))
    )
  })

  const filteredDevices = chromebooks.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.device_number.toLowerCase().includes(q) ||
      (c.students?.name.toLowerCase().includes(q) ?? false) ||
      (c.device_year?.includes(q) ?? false)
    )
  })

  const unassignedForModal = chromebooks
    .filter((c) => !c.student_id)
    .filter((c) =>
      !deviceSearch || c.device_number.toLowerCase().includes(deviceSearch.toLowerCase())
    )

  const assignedCount = students.filter((s) => s.chromebooks?.length > 0).length
  const unassignedDeviceCount = chromebooks.filter((c) => !c.student_id).length

  function gradeLabel(s: Student) {
    return (
      [
        s.grade ? `${s.grade}학년` : '',
        s.class_name ? `${s.class_name}반` : '',
        s.student_number ? `${s.student_number}번` : '',
      ]
        .filter(Boolean)
        .join(' ') || '-'
    )
  }

  const newCount = studentUploadRows.filter((r) => r._isNew).length
  const updateCount = studentUploadRows.filter((r) => !r._isNew).length

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">크롬북 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            학생 {students.length}명 · 기기 배정 완료 {assignedCount}명 · 미배정 기기{' '}
            {unassignedDeviceCount}대
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={studentFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleStudentFile} />
          <input ref={deviceFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleDeviceFile} />
          <input ref={promoFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handlePromoFile} />
          {/* TODO: 새 학년도 시작 시 활성화 */}
          <Button variant="secondary" disabled title="새 학년도에 활성화 예정">
            진급 처리
          </Button>
          <Button variant="secondary" loading={exporting} onClick={handleExport}>
            내보내기
          </Button>
          <Button variant="secondary" onClick={() => { setDeviceForm({ device_number: '', device_year: '' }); setDeviceFormErr(''); setDeviceModal(true) }}>
            + 기기 추가
          </Button>
          <Button onClick={openAddStudent}>+ 학생 추가</Button>
          <Button variant="secondary" onClick={() => { setUploadErr(''); studentFileRef.current?.click() }}>
            학생 명단 업로드
          </Button>
          <Button variant="secondary" onClick={() => { setUploadErr(''); deviceFileRef.current?.click() }}>
            기기 목록 업로드
          </Button>
        </div>
      </div>

      {/* 엑셀 양식 안내 */}
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
        <strong>엑셀 열 제목 안내</strong>
        <span className="ml-2">
          학생 명단:{' '}
          {['이름', '학년', '반', '번호', '기기번호(선택)'].map((t) => (
            <code key={t} className="mr-1 rounded bg-blue-100 px-1">{t}</code>
          ))}
          &nbsp;·&nbsp; 기기 목록:{' '}
          {['기기번호', '기기년도(선택)'].map((t) => (
            <code key={t} className="mr-1 rounded bg-blue-100 px-1">{t}</code>
          ))}
        </span>
      </div>

      {uploadErr && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{uploadErr}</div>
      )}

      {/* Tabs + Search + Grade Filter */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex gap-2">
          {(
            [
              { value: 'students', label: `학생 현황 (${students.length})` },
              { value: 'devices', label: `기기 목록 (${chromebooks.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => { setTab(t.value); setSelectedDeviceIds(new Set()) }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
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
          placeholder="이름 또는 기기번호..."
          className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">전체 학년</option>
          {['1', '2', '3', '4', '5', '6'].map((g) => (
            <option key={g} value={g}>{g}학년</option>
          ))}
        </select>
        {tab === 'devices' && selectedDeviceIds.size > 0 && (
          <button
            onClick={handleDeleteSelectedDevices}
            disabled={deletingDevices}
            className="ml-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {deletingDevices ? '삭제 중...' : `선택 삭제 (${selectedDeviceIds.size}개)`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : tab === 'students' ? (
        /* Student Table */
        <div className="rounded-xl bg-white shadow-sm">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">
                {search || filterGrade ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
              </p>
              {!search && !filterGrade && (
                <button onClick={openAddStudent} className="mt-3 text-sm font-medium text-blue-600 hover:underline">
                  + 학생 직접 추가
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">이름</th>
                    <th className="px-4 py-3 font-medium">학년 / 반 / 번호</th>
                    <th className="px-4 py-3 font-medium">기기번호</th>
                    <th className="px-4 py-3 font-medium">기기년도</th>
                    <th className="px-4 py-3 font-medium">배정일</th>
                    <th className="px-4 py-3 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStudents.map((s) => {
                    const device = s.chromebooks?.[0]
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-gray-500">{gradeLabel(s)}</td>
                        <td className="px-4 py-3">
                          {device ? (
                            <span className="font-mono font-medium text-blue-700">{device.device_number}</span>
                          ) : (
                            <span className="text-gray-400">미배정</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {device?.device_year ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {device?.assigned_at ? formatDate(device.assigned_at) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button size="sm" onClick={() => { setAssignTarget(s); setDeviceSearch('') }}>
                              {device ? '기기 변경' : '기기 배정'}
                            </Button>
                            {device && (
                              <Button size="sm" variant="secondary" onClick={() => handleUnassign(device)}>
                                배정 해제
                              </Button>
                            )}
                            <Button size="sm" variant="secondary" onClick={() => openEditStudent(s)}>
                              수정
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleDeleteStudent(s)}>
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Device Table */
        <div className="rounded-xl bg-white shadow-sm">
          {filteredDevices.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {search ? '검색 결과가 없습니다.' : '등록된 기기가 없습니다. 기기 목록을 업로드해주세요.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={filteredDevices.length > 0 && filteredDevices.every((c) => selectedDeviceIds.has(c.id))}
                        onChange={(e) =>
                          setSelectedDeviceIds(
                            e.target.checked ? new Set(filteredDevices.map((c) => c.id)) : new Set()
                          )
                        }
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">기기번호</th>
                    <th className="px-4 py-3 font-medium">기기년도</th>
                    <th className="px-4 py-3 font-medium">배정 학생</th>
                    <th className="px-4 py-3 font-medium">학년 / 반</th>
                    <th className="px-4 py-3 font-medium">배정일</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDevices.map((c) => (
                    <tr key={c.id} className={`hover:bg-gray-50 ${selectedDeviceIds.has(c.id) ? 'bg-red-50/40' : ''}`}>
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedDeviceIds.has(c.id)}
                          onChange={(e) =>
                            setSelectedDeviceIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(c.id)
                              else next.delete(c.id)
                              return next
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-medium">{c.device_number}</td>
                      <td className="px-4 py-3 text-gray-500">{c.device_year ?? '-'}</td>
                      <td className="px-4 py-3">
                        {c.students ? (
                          <span className="font-medium">{c.students.name}</span>
                        ) : (
                          <span className="text-gray-400">미배정</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.students
                          ? [
                              c.students.grade ? `${c.students.grade}학년` : '',
                              c.students.class_name ? `${c.students.class_name}반` : '',
                            ]
                              .filter(Boolean)
                              .join(' ') || '-'
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.assigned_at ? formatDate(c.assigned_at) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {c.student_id ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            배정됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            미배정
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteDevice(c.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Upload Preview Modal */}
      <Modal
        open={uploadType !== null}
        onClose={() => { setUploadType(null); setStudentUploadRows([]); setDeviceUploadRows([]) }}
        title={uploadType === 'students' ? '학생 명단 업로드 확인' : '기기 목록 업로드 확인'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {uploadType === 'students' ? (
              <>
                총 <strong>{studentUploadRows.length}명</strong> —{' '}
                <span className="text-blue-600">신규 {newCount}명</span>
                {updateCount > 0 && (
                  <span className="ml-1 text-orange-600">
                    / 업데이트 {updateCount}명{' '}
                    <span className="font-normal text-gray-500">(학년·반·번호·기기번호 덮어쓰기)</span>
                  </span>
                )}
              </>
            ) : (
              <>
                총 <strong>{deviceUploadRows.length}개</strong> — 신규 기기는 추가, 기존 기기는 기기년도만 업데이트됩니다.
              </>
            )}
          </p>

          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {uploadType === 'students' ? (
                    <>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">구분</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">이름</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">학년</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">반</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">번호</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">기기번호</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">기기번호</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">기기년도</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {uploadType === 'students'
                  ? studentUploadRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={row._isNew ? '' : 'bg-orange-50/60'}>
                        <td className="px-3 py-1.5">
                          {row._isNew ? (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">신규</span>
                          ) : (
                            <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-orange-700">업데이트</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{row.name}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.grade || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.class_name || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.student_number || '-'}</td>
                        <td className="px-3 py-1.5 font-mono text-blue-700">{row.device_number || '-'}</td>
                      </tr>
                    ))
                  : deviceUploadRows.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 font-mono">{r.device_number}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.device_year || '-'}</td>
                      </tr>
                    ))}
                {(uploadType === 'students' ? studentUploadRows : deviceUploadRows).length > 50 && (
                  <tr>
                    <td colSpan={uploadType === 'students' ? 6 : 2} className="px-3 py-2 text-center text-gray-400">
                      ... 외 {(uploadType === 'students' ? studentUploadRows : deviceUploadRows).length - 50}개
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setUploadType(null); setStudentUploadRows([]); setDeviceUploadRows([]) }}>
              취소
            </Button>
            <Button loading={uploadSaving} onClick={confirmUpload}>등록</Button>
          </div>
        </div>
      </Modal>

      {/* Device Assignment Modal */}
      <Modal
        open={assignTarget !== null}
        onClose={() => { setAssignTarget(null); setDeviceSearch('') }}
        title={`기기 배정 — ${assignTarget?.name}`}
      >
        <div className="space-y-3">
          {assignTarget?.chromebooks?.[0] && (
            <div className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
              현재 배정 기기:{' '}
              <strong className="font-mono">{assignTarget.chromebooks[0].device_number}</strong>
              에서 변경됩니다.
            </div>
          )}
          <p className="text-sm text-gray-500">미배정 기기 목록에서 선택해주세요.</p>
          <input
            type="text"
            value={deviceSearch}
            onChange={(e) => setDeviceSearch(e.target.value)}
            placeholder="기기번호 검색..."
            className={INPUT_CLS}
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {unassignedForModal.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                {deviceSearch ? '검색 결과가 없습니다.' : '미배정 기기가 없습니다. 기기 목록을 먼저 업로드해주세요.'}
              </p>
            ) : (
              <div className="divide-y">
                {unassignedForModal.map((device) => (
                  <button
                    key={device.id}
                    disabled={assigning}
                    onClick={() => handleAssign(device)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-blue-50 disabled:opacity-50"
                  >
                    <div>
                      <span className="font-mono text-sm font-medium text-gray-900">{device.device_number}</span>
                      {device.device_year && (
                        <span className="ml-2 text-xs text-gray-400">{device.device_year}년</span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-blue-600">배정 →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Student Add / Edit Modal */}
      <Modal
        open={studentModal}
        onClose={() => setStudentModal(false)}
        title={editingStudent ? '학생 정보 수정' : '학생 추가'}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">이름 *</label>
            <input
              type="text"
              value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
              placeholder="홍길동"
              className={INPUT_CLS}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">학년</label>
              <input
                type="text"
                value={studentForm.grade}
                onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
                placeholder="3"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">반</label>
              <input
                type="text"
                value={studentForm.class_name}
                onChange={(e) => setStudentForm({ ...studentForm, class_name: e.target.value })}
                placeholder="2"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">번호</label>
              <input
                type="text"
                value={studentForm.student_number}
                onChange={(e) => setStudentForm({ ...studentForm, student_number: e.target.value })}
                placeholder="15"
                className={INPUT_CLS}
              />
            </div>
          </div>
          {studentFormErr && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{studentFormErr}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setStudentModal(false)}>취소</Button>
            <Button loading={studentSaving} onClick={saveStudent}>저장</Button>
          </div>
        </div>
      </Modal>

      {/* Promotion Modal */}
      <Modal
        open={promoModal}
        onClose={() => { setPromoModal(false); setPromoRows([]) }}
        title="진급 처리 (새 학년도)"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            크롬북 배정은 그대로 유지되고 학생의 학년·반·번호만 변경됩니다. 순서대로 진행해주세요.
          </p>

          {promoMsg && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ {promoMsg}</p>
          )}
          {promoErr && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{promoErr}</p>
          )}

          {promoRows.length === 0 ? (
            <div className="space-y-3">
              {/* 1단계 */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">1단계 — 졸업생 처리</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      6학년 {sixthGraders.length}명 삭제 · 배정 기기는 자동으로 미배정 전환
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={promoBusy === 'graduate'}
                    onClick={handleGraduate}
                    disabled={sixthGraders.length === 0}
                  >
                    {sixthGraders.length === 0 ? '완료됨' : '졸업 처리'}
                  </Button>
                </div>
              </div>

              {/* 2단계 */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">2단계 — 학년 올리기</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      전체 학년 +1 · 반/번호 초기화 (기기 배정 유지)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={promoBusy === 'promote'}
                    onClick={handlePromote}
                  >
                    진급 실행
                  </Button>
                </div>
              </div>

              {/* 3단계 */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">3단계 — 새 반편성 업로드</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      엑셀 열 제목: <code className="rounded bg-gray-100 px-1">이름</code>{' '}
                      <code className="rounded bg-gray-100 px-1">학년</code>{' '}
                      <code className="rounded bg-gray-100 px-1">반</code>{' '}
                      <code className="rounded bg-gray-100 px-1">번호</code> · 이름으로 기존 학생과 매칭
                    </p>
                  </div>
                  <Button size="sm" onClick={() => promoFileRef.current?.click()}>
                    파일 선택
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* 3단계 업로드 미리보기 */
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                총 <strong>{promoRows.length}명</strong> —{' '}
                <span className="text-green-600">매칭 {promoRows.filter((r) => r._status === 'matched').length}명</span>
                <span className="ml-1 text-blue-600">/ 신규(전입) {promoRows.filter((r) => r._status === 'new').length}명</span>
                {promoRows.some((r) => r._status === 'ambiguous') && (
                  <span className="ml-1 text-red-600">
                    / 동명이인 {promoRows.filter((r) => r._status === 'ambiguous').length}명 (수동 처리 필요)
                  </span>
                )}
              </p>

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">구분</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">이름</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">학년</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">반</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">번호</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {promoRows.slice(0, 100).map((row, i) => (
                      <tr key={i} className={row._status === 'ambiguous' ? 'bg-red-50/60' : row._status === 'new' ? 'bg-blue-50/40' : ''}>
                        <td className="px-3 py-1.5">
                          {row._status === 'matched' && (
                            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-green-700">매칭</span>
                          )}
                          {row._status === 'new' && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700">신규</span>
                          )}
                          {row._status === 'ambiguous' && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-red-700">동명이인</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-medium">{row.name}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.grade || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.class_name || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{row.student_number || '-'}</td>
                      </tr>
                    ))}
                    {promoRows.length > 100 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-center text-gray-400">
                          ... 외 {promoRows.length - 100}명
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {promoRows.some((r) => r._status === 'ambiguous') && (
                <p className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
                  동명이인은 기기 배정이 엉킬 수 있어 자동 처리하지 않습니다. 적용 후 학생 현황에서 직접 수정해주세요.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => setPromoRows([])}>뒤로</Button>
                <Button loading={promoSaving} onClick={confirmPromoUpload}>반편성 적용</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Device Add Modal */}
      <Modal
        open={deviceModal}
        onClose={() => setDeviceModal(false)}
        title="기기 추가"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">기기번호 *</label>
            <input
              type="text"
              value={deviceForm.device_number}
              onChange={(e) => setDeviceForm({ ...deviceForm, device_number: e.target.value })}
              placeholder="예) ABC-12345"
              className={INPUT_CLS}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              기기년도 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={deviceForm.device_year}
              onChange={(e) => setDeviceForm({ ...deviceForm, device_year: e.target.value })}
              placeholder="예) 2023"
              className={INPUT_CLS}
            />
          </div>
          {deviceFormErr && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{deviceFormErr}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setDeviceModal(false)}>취소</Button>
            <Button loading={deviceFormSaving} onClick={saveDevice}>추가</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
