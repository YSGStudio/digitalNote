'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Classroom, ClassroomDevice } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export default function AdminClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [devices, setDevices] = useState<ClassroomDevice[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ class_name: '', teacher_name: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('classrooms').select('*').order('class_name')
    setClassrooms((data as Classroom[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const loadDevices = useCallback(async (id: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('classroom_devices')
      .select('*, devices(device_type)')
      .eq('classroom_id', id)
    setDevices((data as ClassroomDevice[]) ?? [])
  }, [])

  useEffect(() => {
    if (selected) loadDevices(selected)
    else setDevices([])
  }, [selected, loadDevices])

  function openModal() {
    setForm({ class_name: '', teacher_name: '' })
    setSaveError('')
    setModalOpen(true)
  }

  async function handleAdd() {
    if (!form.class_name.trim()) { setSaveError('학급명을 입력해주세요.'); return }
    setSaving(true)
    setSaveError('')
    const supabase = createClient()
    const { error } = await supabase.from('classrooms').insert({
      class_name: form.class_name.trim(),
      teacher_name: form.teacher_name.trim() || null,
    })
    setSaving(false)
    if (error) {
      setSaveError(error.message.includes('unique') ? '이미 존재하는 학급명입니다.' : `오류: ${error.message}`)
      return
    }
    setModalOpen(false)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 학급을 삭제하면 기기 현황, 고장 신고, 대여 이력이 모두 삭제됩니다.\n정말 삭제할까요?`)) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('classrooms').delete().eq('id', id)
    if (selected === id) setSelected(null)
    setDeleting(null)
    load()
  }

  const selectedClassroom = classrooms.find((c) => c.id === selected)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학급 등록·관리</h1>
          <p className="mt-1 text-sm text-gray-500">교사가 로그인할 학급 목록을 관리합니다.</p>
        </div>
        <Button onClick={openModal}>+ 학급 추가</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 학급 목록 */}
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold text-gray-700">등록된 학급 ({classrooms.length})</p>
          </div>
          {classrooms.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-gray-400">등록된 학급이 없습니다.</p>
              <p className="mt-1 text-xs text-gray-400">"+ 학급 추가"로 등록하세요.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {classrooms.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-gray-50 ${selected === c.id ? 'bg-blue-50' : ''}`}
                >
                  <button
                    onClick={() => setSelected(selected === c.id ? null : c.id)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-gray-900">{c.class_name}</p>
                    <p className="text-xs text-gray-400">
                      {c.teacher_name ? `${c.teacher_name} 선생님` : '담당 교사 미입력'}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.class_name)}
                    disabled={deleting === c.id}
                    className="flex-shrink-0 rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    title="학급 삭제"
                  >
                    {deleting === c.id ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 기기 현황 */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="rounded-xl bg-white shadow-sm">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold text-gray-700">
                  {selectedClassroom?.class_name} — 기기 현황
                </p>
                {selectedClassroom?.teacher_name && (
                  <p className="text-xs text-gray-400">{selectedClassroom.teacher_name} 선생님</p>
                )}
              </div>
              {devices.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-400">
                  교사가 등록한 기기가 없습니다.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">기기 종류</th>
                      <th className="px-4 py-3 font-medium">수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {devices.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2.5">{d.devices?.device_type ?? '-'}</td>
                        <td className="px-4 py-2.5">{d.quantity}대</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
              <div className="text-center">
                <p className="text-sm text-gray-400">왼쪽에서 학급을 선택하면</p>
                <p className="text-sm text-gray-400">기기 현황이 표시됩니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="학급 추가">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              학급명 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 3학년 2반"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              담당 교사명 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              value={form.teacher_name}
              onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 홍길동"
            />
          </div>
          {saveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button loading={saving} onClick={handleAdd}>추가</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
