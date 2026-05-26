'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Classroom, ClassroomDevice } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface DeviceSummary {
  device_type: string
  quantity: number
}

interface ClassroomWithDevices extends Classroom {
  deviceSummary: DeviceSummary[]
  totalDevices: number
}

export default function AdminClassroomsPage() {
  const [classrooms, setClassrooms] = useState<ClassroomWithDevices[]>([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailClassroom, setDetailClassroom] = useState<ClassroomWithDevices | null>(null)
  const [form, setForm] = useState({ class_name: '', teacher_name: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: rooms }, { data: allDevices }] = await Promise.all([
      supabase.from('classrooms').select('*').order('class_name'),
      supabase
        .from('classroom_devices')
        .select('classroom_id, quantity, devices(device_type)')
        .gt('quantity', 0),
    ])

    // 학급별 기기 맵 구성
    const deviceMap: Record<string, DeviceSummary[]> = {}
    ;(allDevices as unknown as ClassroomDevice[])?.forEach((d) => {
      if (!deviceMap[d.classroom_id]) deviceMap[d.classroom_id] = []
      if (d.devices?.device_type) {
        deviceMap[d.classroom_id].push({ device_type: d.devices.device_type, quantity: d.quantity })
      }
    })

    const withDevices: ClassroomWithDevices[] = ((rooms as Classroom[]) ?? []).map((c) => {
      const summary = deviceMap[c.id] ?? []
      return {
        ...c,
        deviceSummary: summary,
        totalDevices: summary.reduce((sum, d) => sum + d.quantity, 0),
      }
    })

    setClassrooms(withDevices)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAddModal() {
    setForm({ class_name: '', teacher_name: '' })
    setSaveError('')
    setAddModalOpen(true)
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
    setAddModalOpen(false)
    load()
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 학급을 삭제하면 기기 현황, 고장 신고, 대여 이력이 모두 삭제됩니다.\n정말 삭제할까요?`)) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('classrooms').delete().eq('id', id)
    if (detailClassroom?.id === id) setDetailClassroom(null)
    setDeleting(null)
    load()
  }

  const totalDevicesAll = classrooms.reduce((s, c) => s + c.totalDevices, 0)

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">학급 등록·관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            {classrooms.length > 0
              ? `총 ${classrooms.length}개 학급 · 전체 기기 ${totalDevicesAll}대 등록됨`
              : '교사가 로그인할 학급 목록을 관리합니다.'}
          </p>
        </div>
        <Button onClick={openAddModal}>+ 학급 추가</Button>
      </div>

      {/* 스켈레톤 로딩 */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && classrooms.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-24">
          <span className="mb-4 text-5xl">🏫</span>
          <p className="text-sm font-medium text-gray-500">등록된 학급이 없습니다.</p>
          <p className="mt-1 text-xs text-gray-400">아래 버튼으로 학급을 추가하세요.</p>
          <Button className="mt-5" onClick={openAddModal}>+ 학급 추가</Button>
        </div>
      )}

      {/* 그리드 */}
      {!loading && classrooms.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {classrooms.map((c) => (
            <div
              key={c.id}
              onClick={() => setDetailClassroom(c)}
              className="group relative flex cursor-pointer flex-col rounded-xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* 삭제 버튼 — hover 시 표시 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.class_name) }}
                disabled={deleting === c.id}
                className="absolute right-3 top-3 rounded p-1.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                title="학급 삭제"
              >
                {deleting === c.id
                  ? <span className="text-xs leading-none">…</span>
                  : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )
                }
              </button>

              {/* 학급명 / 교사명 */}
              <p className="pr-5 text-base font-bold text-gray-900">{c.class_name}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {c.teacher_name ? `${c.teacher_name} 선생님` : '담당 교사 미입력'}
              </p>

              <div className="my-3 border-t border-gray-100" />

              {/* 기기 요약 */}
              <div className="flex-1">
                {c.deviceSummary.length === 0 ? (
                  <p className="text-xs text-gray-300">등록된 기기 없음</p>
                ) : (
                  <div className="space-y-1.5">
                    {c.deviceSummary.slice(0, 3).map((d) => (
                      <div key={d.device_type} className="flex items-center justify-between">
                        <span className="max-w-[70%] truncate text-xs text-gray-500">{d.device_type}</span>
                        <span className="text-xs font-semibold text-gray-700">{d.quantity}대</span>
                      </div>
                    ))}
                    {c.deviceSummary.length > 3 && (
                      <p className="text-xs text-blue-400">+{c.deviceSummary.length - 3}종 더보기</p>
                    )}
                  </div>
                )}
              </div>

              {/* 하단 총계 */}
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-400">총 기기 수</span>
                <span className={`text-sm font-bold ${c.totalDevices === 0 ? 'text-gray-300' : 'text-blue-600'}`}>
                  {c.totalDevices}대
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      <Modal
        open={detailClassroom !== null}
        onClose={() => setDetailClassroom(null)}
        title={detailClassroom?.class_name ?? ''}
      >
        {detailClassroom && (
          <div>
            <p className="mb-4 text-sm text-gray-500">
              {detailClassroom.teacher_name
                ? `${detailClassroom.teacher_name} 선생님`
                : '담당 교사 미입력'}
            </p>
            {detailClassroom.deviceSummary.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">교사가 등록한 기기가 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-500">
                    <th className="px-3 py-2.5 font-medium">기기 종류</th>
                    <th className="px-3 py-2.5 text-right font-medium">수량</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detailClassroom.deviceSummary.map((d) => (
                    <tr key={d.device_type} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">{d.device_type}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{d.quantity}대</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td className="px-3 py-2.5 text-gray-700">합계</td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{detailClassroom.totalDevices}대</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </Modal>

      {/* 추가 모달 */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="학급 추가">
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
              담당 교사명 <span className="font-normal text-gray-400">(선택)</span>
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
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>취소</Button>
            <Button loading={saving} onClick={handleAdd}>추가</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
