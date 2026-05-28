'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { SharedDevice } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<SharedDevice[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SharedDevice | null>(null)
  const [form, setForm] = useState({ device_name: '', total_quantity: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('shared_devices')
      .select('*')
      .order('created_at', { ascending: true })
    setDevices((data as SharedDevice[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing(null)
    setForm({ device_name: '', total_quantity: '' })
    setModalOpen(true)
  }

  function openEdit(d: SharedDevice) {
    setEditing(d)
    setForm({ device_name: d.device_name, total_quantity: String(d.total_quantity) })
    setModalOpen(true)
  }

  async function handleSave() {
    const qty = parseInt(form.total_quantity)
    if (!form.device_name.trim() || isNaN(qty) || qty < 0) return
    setSaving(true)
    const supabase = createClient()
    if (editing) {
      const diff = qty - editing.total_quantity
      await supabase
        .from('shared_devices')
        .update({
          device_name: form.device_name,
          total_quantity: qty,
          available_quantity: Math.max(0, editing.available_quantity + diff),
        })
        .eq('id', editing.id)
    } else {
      await supabase.from('shared_devices').insert({
        device_name: form.device_name,
        total_quantity: qty,
        available_quantity: qty,
        is_active: true,
      })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete(d: SharedDevice) {
    if (!window.confirm(`"${d.device_name}"을(를) 삭제하면 관련 대여 이력도 함께 삭제됩니다.\n정말 삭제할까요?`)) return
    setDeleting(d.id)
    const supabase = createClient()
    await supabase.from('shared_devices').delete().eq('id', d.id)
    setDeleting(null)
    load()
  }

  async function toggleActive(d: SharedDevice) {
    const supabase = createClient()
    await supabase.from('shared_devices').update({ is_active: !d.is_active }).eq('id', d.id)
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">공유 기기 관리</h1>
        <Button onClick={openNew}>+ 기기 추가</Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {devices.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">등록된 공유 기기가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">기기명</th>
                  <th className="px-4 py-3 font-medium">총 수량</th>
                  <th className="px-4 py-3 font-medium">대여 가능</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.device_name}</td>
                    <td className="px-4 py-3">{d.total_quantity}대</td>
                    <td className="px-4 py-3">
                      <span className={d.available_quantity === 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {d.available_quantity}대
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.is_active ? '운영 중' : '비활성'}
                      </span>
                    </td>
                    <td className="flex gap-2 px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>수정</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                        {d.is_active ? '비활성화' : '활성화'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deleting === d.id}
                        onClick={() => handleDelete(d)}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '기기 수정' : '기기 추가'}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">기기명</label>
            <input
              value={form.device_name}
              onChange={(e) => setForm({ ...form, device_name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 태블릿 PC"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">총 수량</label>
            <input
              type="number"
              min={0}
              value={form.total_quantity}
              onChange={(e) => setForm({ ...form, total_quantity: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button loading={saving} onClick={handleSave}>저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
