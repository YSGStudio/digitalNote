'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Device } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useSchool } from '@/lib/school-context'
import { logAudit } from '@/lib/audit'

export default function AdminDeviceTypesPage() {
  const { schoolId } = useSchool()
  const [devices, setDevices] = useState<Device[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ device_type: '', description: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('devices').select('*').order('device_type')
    setDevices((data as Device[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!form.device_type.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: inserted } = await supabase
      .from('devices')
      .insert({
        device_type: form.device_type,
        description: form.description || null,
      })
      .select('id')
      .single()
    await logAudit({
      schoolId,
      tableName: 'devices',
      recordId: inserted?.id,
      action: 'insert',
      summary: `기기 종류 "${form.device_type}" 추가`,
      changes: { device_type: form.device_type, description: form.description || null },
    })
    setSaving(false)
    setModalOpen(false)
    setForm({ device_type: '', description: '' })
    load()
  }

  async function handleDelete(id: string) {
    const target = devices.find((d) => d.id === id)
    const supabase = createClient()
    await supabase.from('devices').delete().eq('id', id)
    await logAudit({
      schoolId,
      tableName: 'devices',
      recordId: id,
      action: 'delete',
      summary: `기기 종류 "${target?.device_type ?? id}" 삭제`,
    })
    load()
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">기기 종류 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 기기 종류 추가</Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {devices.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">등록된 기기 종류가 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">기기 종류</th>
                <th className="px-4 py-3 font-medium">설명</th>
                <th className="px-4 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.device_type}</td>
                  <td className="px-4 py-3 text-gray-500">{d.description ?? '-'}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="danger" onClick={() => handleDelete(d.id)}>삭제</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="기기 종류 추가">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">기기 종류명</label>
            <input
              value={form.device_type}
              onChange={(e) => setForm({ ...form, device_type: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 크롬북"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">설명 (선택)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: 크롬OS 노트북"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button loading={saving} onClick={handleSave}>추가</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
