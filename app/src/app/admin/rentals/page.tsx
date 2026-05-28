'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Rental, RentalStatus } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'

export default function AdminRentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [tab, setTab] = useState<RentalStatus | 'all'>('반납 요청 중')
  const [returning, setReturning] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('rentals')
      .select('*, classrooms(class_name), shared_devices(device_name, available_quantity)')
      .order('rented_at', { ascending: false })
    if (tab !== 'all') query = query.eq('status', tab)
    const { data } = await query
    setRentals((data as Rental[]) ?? [])
  }, [tab])

  useEffect(() => { load() }, [load])

  async function handleConfirmReturn(rental: Rental) {
    setReturning(rental.id)
    const supabase = createClient()
    const device = rental.shared_devices
    await Promise.all([
      supabase
        .from('rentals')
        .update({ status: '반납 완료', returned_at: new Date().toISOString() })
        .eq('id', rental.id),
      device
        ? supabase
            .from('shared_devices')
            .update({ available_quantity: device.available_quantity + rental.quantity })
            .eq('id', rental.device_id)
        : Promise.resolve(),
    ])
    setReturning(null)
    load()
  }

  const tabs: Array<{ value: RentalStatus | 'all'; label: string }> = [
    { value: '반납 요청 중', label: '반납 요청' },
    { value: '대여 중', label: '대여 중' },
    { value: '반납 완료', label: '반납 완료' },
    { value: 'all', label: '전체' },
  ]

  const returnRequestCount = tab === '반납 요청 중' ? rentals.length : 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">전체 대여 현황</h1>
          {tab === '반납 요청 중' && rentals.length > 0 && (
            <p className="mt-1 text-sm text-purple-600">
              반납 처리 대기 {returnRequestCount}건
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {rentals.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            {tab === '반납 요청 중' ? '반납 요청 대기 건이 없습니다.' : '대여 내역이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">대여일</th>
                  <th className="px-4 py-3 font-medium">학급</th>
                  <th className="px-4 py-3 font-medium">기기</th>
                  <th className="px-4 py-3 font-medium">수량</th>
                  <th className="px-4 py-3 font-medium">반납일</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  {tab === '반납 요청 중' && (
                    <th className="px-4 py-3 font-medium">처리</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rentals.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.status === '반납 요청 중' ? 'bg-purple-50/40' : ''}`}>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.rented_at)}</td>
                    <td className="px-4 py-3 font-medium">{r.classrooms?.class_name ?? '-'}</td>
                    <td className="px-4 py-3">{r.shared_devices?.device_name ?? '-'}</td>
                    <td className="px-4 py-3">{r.quantity}대</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.returned_at)}</td>
                    <td className="px-4 py-3"><Badge label={r.status} /></td>
                    {tab === '반납 요청 중' && (
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          loading={returning === r.id}
                          onClick={() => handleConfirmReturn(r)}
                        >
                          반납 처리
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
