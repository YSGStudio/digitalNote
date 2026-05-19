'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getTeacherSession } from '@/lib/teacher-auth'
import { RepairReport, Device, ClassroomDevice } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

export default function TeacherRepairPage() {
  const router = useRouter()
  const [classroomId, setClassroomId] = useState('')
  const [reports, setReports] = useState<RepairReport[]>([])
  const [myDevices, setMyDevices] = useState<ClassroomDevice[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ device_id: '', quantity: '1', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (cid: string) => {
    const supabase = createClient()
    const [{ data: reps }, { data: devs }] = await Promise.all([
      supabase
        .from('repair_reports')
        .select('*, devices(device_type)')
        .eq('classroom_id', cid)
        .order('reported_at', { ascending: false }),
      supabase
        .from('classroom_devices')
        .select('*, devices(device_type)')
        .eq('classroom_id', cid)
        .gt('quantity', 0),
    ])
    setReports((reps as RepairReport[]) ?? [])
    setMyDevices((devs as ClassroomDevice[]) ?? [])
  }, [])

  useEffect(() => {
    const session = getTeacherSession()
    if (!session) { router.push('/login/teacher'); return }
    setClassroomId(session.classroomId)
    load(session.classroomId)
  }, [router, load])

  async function handleSubmit() {
    if (!form.device_id) { setError('기기를 선택해주세요.'); return }
    const qty = parseInt(form.quantity)
    if (isNaN(qty) || qty < 1) { setError('수량을 올바르게 입력해주세요.'); return }

    setSubmitting(true)
    setError('')
    const supabase = createClient()
    await supabase.from('repair_reports').insert({
      classroom_id: classroomId,
      device_id: form.device_id,
      quantity: qty,
      description: form.description || null,
      status: '접수 대기',
    })
    setSubmitting(false)
    setModalOpen(false)
    setForm({ device_id: '', quantity: '1', description: '' })
    load(classroomId)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">고장 신고</h1>
        <Button onClick={() => { setError(''); setModalOpen(true) }}>+ 고장 신고</Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-gray-700">신고 이력</p>
        </div>
        {reports.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">고장 신고 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">신고일</th>
                  <th className="px-4 py-3 font-medium">기기</th>
                  <th className="px-4 py-3 font-medium">수량</th>
                  <th className="px-4 py-3 font-medium">내용</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">처리일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.reported_at)}</td>
                    <td className="px-4 py-3 font-medium">{r.devices?.device_type ?? '-'}</td>
                    <td className="px-4 py-3">{r.quantity}대</td>
                    <td className="px-4 py-3 text-gray-500">{r.description ?? '-'}</td>
                    <td className="px-4 py-3"><Badge label={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.resolved_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="고장 신고">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">고장 기기 선택</label>
            <select
              value={form.device_id}
              onChange={(e) => setForm({ ...form, device_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택해주세요</option>
              {myDevices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.devices?.device_type} (보유 {d.quantity}대)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">고장 수량</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">고장 내용 (선택)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 화면이 켜지지 않음"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button loading={submitting} onClick={handleSubmit}>신고하기</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
