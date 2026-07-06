'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Student, Chromebook } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

type StudentWithDevice = Student & { chromebooks: Chromebook[] }
type ChromebookWithStudent = Chromebook & { students: Student | null }

function findCol(row: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(row)
  for (const c of candidates) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')
    const found = keys.find((k) => norm(k) === norm(c))
    if (found !== undefined) return String(row[found] ?? '').trim()
  }
  return ''
}

export default function ChromebooksPage() {
  const [students, setStudents] = useState<StudentWithDevice[]>([])
  const [chromebooks, setChromebooks] = useState<ChromebookWithStudent[]>([])
  const [tab, setTab] = useState<'students' | 'devices'>('students')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Upload
  const [uploadType, setUploadType] = useState<'students' | 'devices' | null>(null)
  const [uploadRows, setUploadRows] = useState<Record<string, string>[]>([])
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const studentFileRef = useRef<HTMLInputElement>(null)
  const deviceFileRef = useRef<HTMLInputElement>(null)

  // Assign
  const [assignTarget, setAssignTarget] = useState<StudentWithDevice | null>(null)
  const [deviceSearch, setDeviceSearch] = useState('')
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: studs }, { data: devs }] = await Promise.all([
      supabase
        .from('students')
        .select('*, chromebooks(*)')
        .order('grade', { ascending: true })
        .order('class_name', { ascending: true })
        .order('student_number', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('chromebooks')
        .select('*, students(*)')
        .order('device_number', { ascending: true }),
    ])
    setStudents((studs as StudentWithDevice[]) ?? [])
    setChromebooks((devs as ChromebookWithStudent[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(buf, { type: 'array' })
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
        .filter((r) => r.name) as Record<string, string>[]
      if (!parsed.length) {
        setUploadErr('"이름" 열을 찾을 수 없습니다. 열 제목을 확인해주세요.')
        return
      }
      setUploadRows(parsed)
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
      const parsed = rows
        .map((r) => ({
          device_number: findCol(r, ['기기번호', '시리얼번호', '시리얼', '번호', 'serial', 'device', 'number']),
        }))
        .filter((r) => r.device_number) as Record<string, string>[]
      if (!parsed.length) {
        setUploadErr('"기기번호" 열을 찾을 수 없습니다. 열 제목을 확인해주세요.')
        return
      }
      setUploadRows(parsed)
      setUploadType('devices')
    } catch {
      setUploadErr('파일을 읽을 수 없습니다.')
    }
  }

  async function confirmUpload() {
    setUploadSaving(true)
    const supabase = createClient()

    if (uploadType === 'devices') {
      await supabase
        .from('chromebooks')
        .upsert(
          uploadRows.map((r) => ({ device_number: r.device_number })),
          { onConflict: 'device_number', ignoreDuplicates: true }
        )
    } else if (uploadType === 'students') {
      for (const row of uploadRows) {
        const { data: student } = await supabase
          .from('students')
          .insert({
            name: row.name,
            grade: row.grade || null,
            class_name: row.class_name || null,
            student_number: row.student_number || null,
          })
          .select('id')
          .single()

        if (student && row.device_number) {
          // 이미 이 학생에게 배정된 기기가 있으면 해제 후 새 기기 배정
          await supabase
            .from('chromebooks')
            .update({ student_id: null, assigned_at: null })
            .eq('student_id', student.id)
          await supabase.from('chromebooks').upsert(
            {
              device_number: row.device_number,
              student_id: student.id,
              assigned_at: new Date().toISOString(),
            },
            { onConflict: 'device_number' }
          )
        }
      }
    }

    setUploadSaving(false)
    setUploadType(null)
    setUploadRows([])
    load()
  }

  async function handleAssign(device: ChromebookWithStudent) {
    if (!assignTarget) return
    setAssigning(true)
    const supabase = createClient()
    // 기존 배정 기기 해제
    await supabase
      .from('chromebooks')
      .update({ student_id: null, assigned_at: null })
      .eq('student_id', assignTarget.id)
    // 새 기기 배정
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
    if (!confirm(`"${student.name}" 학생을 삭제하시겠습니까? 배정된 기기는 미배정 상태로 변경됩니다.`)) return
    const supabase = createClient()
    await supabase.from('students').delete().eq('id', student.id)
    load()
  }

  const filteredStudents = students.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.chromebooks.some((c) => c.device_number.toLowerCase().includes(q))
    )
  })

  const filteredDevices = chromebooks.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.device_number.toLowerCase().includes(q) ||
      (c.students?.name.toLowerCase().includes(q) ?? false)
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
    return [
      s.grade ? `${s.grade}학년` : '',
      s.class_name ? `${s.class_name}반` : '',
      s.student_number ? `${s.student_number}번` : '',
    ]
      .filter(Boolean)
      .join(' ') || '-'
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">크롬북 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            학생 {students.length}명 · 기기 배정 완료 {assignedCount}명 · 미배정 기기 {unassignedDeviceCount}대
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={studentFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleStudentFile}
          />
          <input
            ref={deviceFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleDeviceFile}
          />
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
        <span className="ml-2 text-blue-600">
          학생 명단: <code className="rounded bg-blue-100 px-1">이름</code>{' '}
          <code className="rounded bg-blue-100 px-1">학년</code>{' '}
          <code className="rounded bg-blue-100 px-1">반</code>{' '}
          <code className="rounded bg-blue-100 px-1">번호</code>{' '}
          <code className="rounded bg-blue-100 px-1">기기번호</code>(선택)
          &nbsp;·&nbsp; 기기 목록:{' '}
          <code className="rounded bg-blue-100 px-1">기기번호</code>
        </span>
      </div>

      {uploadErr && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{uploadErr}</div>
      )}

      {/* Tabs + Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('students')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'students'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            학생 현황 ({students.length})
          </button>
          <button
            onClick={() => setTab('devices')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'devices'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            기기 목록 ({chromebooks.length})
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 기기번호로 검색..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Student Table */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : tab === 'students' ? (
        <div className="rounded-xl bg-white shadow-sm">
          {filteredStudents.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              {search
                ? '검색 결과가 없습니다.'
                : '등록된 학생이 없습니다. 학생 명단을 업로드해주세요.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">이름</th>
                    <th className="px-4 py-3 font-medium">학년 / 반 / 번호</th>
                    <th className="px-4 py-3 font-medium">기기번호</th>
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
                            <span className="font-mono font-medium text-blue-700">
                              {device.device_number}
                            </span>
                          ) : (
                            <span className="text-gray-400">미배정</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {device?.assigned_at ? formatDate(device.assigned_at) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => {
                                setAssignTarget(s)
                                setDeviceSearch('')
                              }}
                            >
                              {device ? '기기 변경' : '기기 배정'}
                            </Button>
                            {device && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleUnassign(device)}
                              >
                                배정 해제
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeleteStudent(s)}
                            >
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
              {search
                ? '검색 결과가 없습니다.'
                : '등록된 기기가 없습니다. 기기 목록을 업로드해주세요.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">기기번호</th>
                    <th className="px-4 py-3 font-medium">배정 학생</th>
                    <th className="px-4 py-3 font-medium">학년 / 반</th>
                    <th className="px-4 py-3 font-medium">배정일</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDevices.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium">{c.device_number}</td>
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
        onClose={() => {
          setUploadType(null)
          setUploadRows([])
        }}
        title={uploadType === 'students' ? '학생 명단 업로드 확인' : '기기 목록 업로드 확인'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {uploadType === 'students' ? (
              <>
                총 <strong>{uploadRows.length}명</strong>의 학생 데이터를 등록합니다.
                <span className="ml-1 text-yellow-600">
                  (같은 파일을 중복 업로드하면 학생이 중복 등록될 수 있습니다.)
                </span>
              </>
            ) : (
              <>
                총 <strong>{uploadRows.length}개</strong>의 기기 번호를 등록합니다. 이미 등록된 기기번호는 무시됩니다.
              </>
            )}
          </p>

          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {uploadType === 'students' ? (
                    <>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">이름</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">학년</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">반</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">번호</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">기기번호</th>
                    </>
                  ) : (
                    <th className="px-3 py-2 text-left font-medium text-gray-500">기기번호</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {uploadRows.slice(0, 50).map((row, i) =>
                  uploadType === 'students' ? (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium">{row.name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.grade || '-'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.class_name || '-'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.student_number || '-'}</td>
                      <td className="px-3 py-1.5 font-mono text-blue-700">
                        {row.device_number || '-'}
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono">{row.device_number}</td>
                    </tr>
                  )
                )}
                {uploadRows.length > 50 && (
                  <tr>
                    <td
                      colSpan={uploadType === 'students' ? 5 : 1}
                      className="px-3 py-2 text-center text-gray-400"
                    >
                      ... 외 {uploadRows.length - 50}개
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setUploadType(null)
                setUploadRows([])
              }}
            >
              취소
            </Button>
            <Button loading={uploadSaving} onClick={confirmUpload}>
              등록
            </Button>
          </div>
        </div>
      </Modal>

      {/* Device Assignment Modal */}
      <Modal
        open={assignTarget !== null}
        onClose={() => {
          setAssignTarget(null)
          setDeviceSearch('')
        }}
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {unassignedForModal.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                {deviceSearch
                  ? '검색 결과가 없습니다.'
                  : '미배정 기기가 없습니다. 기기 목록을 먼저 업로드해주세요.'}
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
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {device.device_number}
                    </span>
                    <span className="text-xs font-medium text-blue-600">배정 →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
