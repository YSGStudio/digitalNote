'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getTeacherSession } from '@/lib/teacher-auth'
import { ClassroomDevice, Device } from '@/types'
import { Button } from '@/components/ui/Button'

export default function MyDevicesPage() {
  const router = useRouter()
  const [classroomId, setClassroomId] = useState('')
  const [allDevices, setAllDevices] = useState<Device[]>([])
  const [myDevices, setMyDevices] = useState<ClassroomDevice[]>([])
  const [editMode, setEditMode] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (cid: string) => {
    const supabase = createClient()
    const [{ data: devs }, { data: myDevs }] = await Promise.all([
      supabase.from('devices').select('*').order('device_type'),
      supabase.from('classroom_devices').select('*, devices(device_type)').eq('classroom_id', cid),
    ])
    setAllDevices((devs as Device[]) ?? [])
    setMyDevices((myDevs as ClassroomDevice[]) ?? [])

    const qMap: Record<string, number> = {}
    ;(devs as Device[])?.forEach((d) => {
      const found = (myDevs as ClassroomDevice[])?.find((md) => md.device_id === d.id)
      qMap[d.id] = found?.quantity ?? 0
    })
    setQuantities(qMap)
  }, [])

  useEffect(() => {
    const session = getTeacherSession()
    if (!session) { router.push('/login/teacher'); return }
    setClassroomId(session.classroomId)
    load(session.classroomId)
  }, [router, load])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const upserts = allDevices.map((d) => ({
      classroom_id: classroomId,
      device_id: d.id,
      quantity: quantities[d.id] ?? 0,
    }))
    await supabase.from('classroom_devices').upsert(upserts, { onConflict: 'classroom_id,device_id' })
    await load(classroomId)
    setSaving(false)
    setEditMode(false)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">내 학급 기기 현황</h1>
        {!editMode ? (
          <Button variant="secondary" onClick={() => setEditMode(true)}>수량 수정</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditMode(false)}>취소</Button>
            <Button loading={saving} onClick={handleSave}>저장</Button>
          </div>
        )}
      </div>

      {allDevices.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-gray-400">관리자가 기기 종류를 등록하면 표시됩니다.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">기기 종류</th>
                <th className="px-4 py-3 font-medium">보유 수량</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allDevices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.device_type}</td>
                  <td className="px-4 py-3">
                    {editMode ? (
                      <input
                        type="number"
                        min={0}
                        value={quantities[d.id] ?? 0}
                        onChange={(e) => setQuantities({ ...quantities, [d.id]: parseInt(e.target.value) || 0 })}
                        className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className={quantities[d.id] === 0 ? 'text-gray-400' : ''}>
                        {quantities[d.id] ?? 0}대
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
  )
}
