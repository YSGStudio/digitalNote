'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Classroom, ClassroomDevice, Device } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface DeviceSummary {
  device_type: string
  quantity: number
}

interface ClassroomWithDevices extends Classroom {
  deviceSummary: DeviceSummary[]
  totalDevices: number
  lastUpdatedAt: string | null
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

  // 기기 편집 관련
  const [allDevices, setAllDevices] = useState<Device[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [editMode, setEditMode] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [devicesLoading, setDevicesLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: rooms }, { data: allDevs }] = await Promise.all([
      supabase.from('classrooms').select('*').order('class_name'),
      supabase
        .from('classroom_devices')
        .select('classroom_id, quantity, updated_at, devices(device_type)')
        .gt('quantity', 0),
    ])

    const deviceMap: Record<string, DeviceSummary[]> = {}
    const lastUpdatedMap: Record<string, string> = {}
    ;(allDevs as unknown as ClassroomDevice[])?.forEach((d) => {
      if (!deviceMap[d.classroom_id]) deviceMap[d.classroom_id] = []
      if (d.devices?.device_type) {
        deviceMap[d.classroom_id].push({ device_type: d.devices.device_type, quantity: d.quantity })
      }
      if (d.updated_at) {
        const prev = lastUpdatedMap[d.classroom_id]
        if (!prev || d.updated_at > prev) lastUpdatedMap[d.classroom_id] = d.updated_at
      }
    })

    const withDevices: ClassroomWithDevices[] = ((rooms as Classroom[]) ?? []).map((c) => {
      const summary = deviceMap[c.id] ?? []
      return {
        ...c,
        deviceSummary: summary,
        totalDevices: summary.reduce((sum, d) => sum + d.quantity, 0),
        lastUpdatedAt: lastUpdatedMap[c.id] ?? null,
      }
    })

    setClassrooms(withDevices)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function openDetail(c: ClassroomWithDevices) {
    setDetailClassroom(c)
    setEditMode(false)
    setEditError('')
    setDevicesLoading(true)

    const supabase = createClient()
    const [{ data: devs }, { data: myDevs }] = await Promise.all([
      supabase.from('devices').select('*').order('device_type'),
      supabase.from('classroom_devices').select('*').eq('classroom_id', c.id),
    ])

    const devList = (devs as Device[]) ?? []
    const myDevList = (myDevs as ClassroomDevice[]) ?? []

    const qMap: Record<string, number> = {}
    devList.forEach((d) => {
      const found = myDevList.find((md) => md.device_id === d.id)
      qMap[d.id] = found?.quantity ?? 0
    })

    setAllDevices(devList)
    setQuantities(qMap)
    setDevicesLoading(false)
  }

  function closeDetail() {
    setDetailClassroom(null)
    setEditMode(false)
    setEditError('')
    setAllDevices([])
    setQuantities({})
  }

  async function handleEditSave() {
    if (!detailClassroom) return
    setEditSaving(true)
    setEditError('')
    const supabase = createClient()
    const now = new Date().toISOString()
    const upserts = allDevices.map((d) => ({
      classroom_id: detailClassroom.id,
      device_id: d.id,
      quantity: quantities[d.id] ?? 0,
      updated_at: now,
    }))
    const { error } = await supabase
      .from('classroom_devices')
      .upsert(upserts, { onConflict: 'classroom_id,device_id' })

    if (error) {
      setEditError(`저장 실패: ${error.message}`)
      setEditSaving(false)
      return
    }

    // 그리드 카드도 갱신
    await load()

    // 상세 모달의 deviceSummary도 최신화
    setClassrooms((prev) => {
      const updated = prev.find((c) => c.id === detailClassroom.id)
      if (updated) setDetailClassroom(updated)
      return prev
    })

    setEditSaving(false)
    setEditMode(false)
  }

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
    if (detailClassroom?.id === id) closeDetail()
    setDeleting(null)
    load()
  }

  const totalDevicesAll = classrooms.reduce((s, c) => s + c.totalDevices, 0)

  const deviceTotals = classrooms.reduce((acc, c) => {
    c.deviceSummary.forEach((d) => {
      acc[d.device_type] = (acc[d.device_type] ?? 0) + d.quantity
    })
    return acc
  }, {} as Record<string, number>)

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

      {/* 기기 종류별 합계 */}
      {!loading && classrooms.length > 0 && Object.keys(deviceTotals).length > 0 && (
        <div className="mb-5 rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">기기 종류별 합계</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(deviceTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5">
                  <span className="text-xs text-gray-600">{type}</span>
                  <span className="text-xs font-bold text-blue-700">{count}대</span>
                </div>
              ))}
          </div>
        </div>
      )}

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
              onClick={() => openDetail(c)}
              className="group relative flex cursor-pointer flex-col rounded-xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* 삭제 버튼 */}
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

              <p className="pr-5 text-base font-bold text-gray-900">{c.class_name}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {c.teacher_name ? `${c.teacher_name} 선생님` : '담당 교사 미입력'}
              </p>
              {c.lastUpdatedAt && (
                <p className="mt-0.5 text-xs text-gray-300">
                  수량 업데이트: {new Date(c.lastUpdatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </p>
              )}

              <div className="my-3 border-t border-gray-100" />

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

      {/* 상세 / 편집 모달 */}
      <Modal
        open={detailClassroom !== null}
        onClose={closeDetail}
        title={detailClassroom?.class_name ?? ''}
      >
        {detailClassroom && (
          <div>
            <p className="mb-4 text-sm text-gray-500">
              {detailClassroom.teacher_name
                ? `${detailClassroom.teacher_name} 선생님`
                : '담당 교사 미입력'}
            </p>

            {devicesLoading ? (
              <div className="space-y-2 py-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : allDevices.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                기기 종류를 먼저 등록해주세요. (기기 종류 설정 메뉴)
              </p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-3 py-2.5 font-medium">기기 종류</th>
                      <th className="px-3 py-2.5 text-right font-medium">수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allDevices.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5">{d.device_type}</td>
                        <td className="px-3 py-2.5 text-right">
                          {editMode ? (
                            <input
                              type="number"
                              min={0}
                              value={quantities[d.id] ?? 0}
                              onChange={(e) =>
                                setQuantities({ ...quantities, [d.id]: parseInt(e.target.value) || 0 })
                              }
                              className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ) : (
                            <span className={quantities[d.id] === 0 ? 'font-medium text-gray-300' : 'font-medium text-gray-700'}>
                              {quantities[d.id] ?? 0}대
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {!editMode && (
                    <tfoot>
                      <tr className="border-t-2 bg-gray-50 font-semibold">
                        <td className="px-3 py-2.5 text-gray-700">합계</td>
                        <td className="px-3 py-2.5 text-right text-blue-600">
                          {Object.values(quantities).reduce((s, v) => s + v, 0)}대
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>

                {editError && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  {editMode ? (
                    <>
                      <Button variant="secondary" onClick={() => { setEditMode(false); setEditError('') }}>
                        취소
                      </Button>
                      <Button loading={editSaving} onClick={handleEditSave}>저장</Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={() => setEditMode(true)}>
                      기기 수량 편집
                    </Button>
                  )}
                </div>
              </>
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
