'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getTeacherSession } from '@/lib/teacher-auth'
import { Rental, SharedDevice } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function TeacherRentalsPage() {
  const router = useRouter()
  const [classroomId, setClassroomId] = useState('')
  const [tab, setTab] = useState<'all' | 'my'>('all')
  const [allRentals, setAllRentals] = useState<Rental[]>([])
  const [myRentals, setMyRentals] = useState<Rental[]>([])
  const [sharedDevices, setSharedDevices] = useState<SharedDevice[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ device_id: '', quantity: '1', rental_date: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async (cid: string) => {
    const supabase = createClient()
    const [{ data: all }, { data: my }, { data: devs }] = await Promise.all([
      supabase
        .from('rentals')
        .select('*, classrooms(class_name), shared_devices(device_name)')
        .in('status', ['대여 중', '반납 요청 중'])
        .order('rented_at', { ascending: false }),
      supabase
        .from('rentals')
        .select('*, classrooms(class_name), shared_devices(device_name)')
        .eq('classroom_id', cid)
        .order('rented_at', { ascending: false }),
      supabase.from('shared_devices').select('*').eq('is_active', true).order('device_name'),
    ])
    setAllRentals((all as Rental[]) ?? [])
    setMyRentals((my as Rental[]) ?? [])
    setSharedDevices((devs as SharedDevice[]) ?? [])
  }, [])

  useEffect(() => {
    const session = getTeacherSession()
    if (!session) { router.push('/login/teacher'); return }
    setClassroomId(session.classroomId)
    load(session.classroomId)
  }, [router, load])

  async function handleRent() {
    if (!form.device_id) { setError('기기를 선택해주세요.'); return }
    const qty = parseInt(form.quantity)
    if (isNaN(qty) || qty < 1) { setError('수량을 올바르게 입력해주세요.'); return }

    const device = sharedDevices.find((d) => d.id === form.device_id)
    if (!device || device.available_quantity < qty) {
      setError('대여 가능 수량을 초과했습니다.')
      return
    }

    const rentedAt = form.rental_date || toLocalDateString(new Date())

    setSubmitting(true)
    setError('')
    const supabase = createClient()
    await Promise.all([
      supabase.from('rentals').insert({
        classroom_id: classroomId,
        device_id: form.device_id,
        quantity: qty,
        status: '대여 중',
        rented_at: rentedAt,
        description: form.description.trim() || null,
      }),
      supabase
        .from('shared_devices')
        .update({ available_quantity: device.available_quantity - qty })
        .eq('id', form.device_id),
    ])
    setSubmitting(false)
    setModalOpen(false)
    setForm({ device_id: '', quantity: '1', rental_date: '', description: '' })
    load(classroomId)
  }

  async function handleReturnRequest(rental: Rental) {
    setRequesting(rental.id)
    const supabase = createClient()
    await supabase
      .from('rentals')
      .update({ status: '반납 요청 중' })
      .eq('id', rental.id)
    setRequesting(null)
    load(classroomId)
  }

  const displayedRentals = tab === 'all' ? allRentals : myRentals

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">기기 대여·반납</h1>
        <Button onClick={() => { setError(''); setForm({ device_id: '', quantity: '1', rental_date: toLocalDateString(new Date()), description: '' }); setModalOpen(true) }}>+ 대여 신청</Button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('all')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          전체 대여 현황
        </button>
        <button
          onClick={() => setTab('my')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'my' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
          내 대여 내역
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {displayedRentals.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">대여 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">대여일</th>
                  <th className="px-4 py-3 font-medium">학급</th>
                  <th className="px-4 py-3 font-medium">기기</th>
                  <th className="px-4 py-3 font-medium">수량</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  {tab === 'my' && <th className="px-4 py-3 font-medium">반납</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayedRentals.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.rented_at)}</td>
                    <td className="px-4 py-3 font-medium">{r.classrooms?.class_name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <p>{r.shared_devices?.device_name ?? '-'}</p>
                      {r.description && <p className="mt-0.5 text-xs text-gray-400">{r.description}</p>}
                    </td>
                    <td className="px-4 py-3">{r.quantity}대</td>
                    <td className="px-4 py-3"><Badge label={r.status} /></td>
                    {tab === 'my' && (
                      <td className="px-4 py-3">
                        {r.status === '대여 중' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={requesting === r.id}
                            onClick={() => handleReturnRequest(r)}
                          >
                            반납 요청
                          </Button>
                        )}
                        {r.status === '반납 요청 중' && (
                          <span className="text-xs text-purple-600">반납 요청됨</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="기기 대여 신청">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">기기 선택</label>
            <select
              value={form.device_id}
              onChange={(e) => setForm({ ...form, device_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">선택해주세요</option>
              {sharedDevices.map((d) => (
                <option key={d.id} value={d.id} disabled={d.available_quantity === 0}>
                  {d.device_name} (대여 가능: {d.available_quantity}대)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">대여 수량</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">대여 날짜</label>
            <input
              type="date"
              value={form.rental_date}
              onChange={(e) => setForm({ ...form, rental_date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">입력하지 않으면 오늘 날짜로 저장됩니다.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              상세 내용 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="대여 목적이나 참고사항을 입력해주세요."
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button loading={submitting} onClick={handleRent} className="bg-emerald-600 hover:bg-emerald-700">대여 신청</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
