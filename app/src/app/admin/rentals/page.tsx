'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Rental, RentalStatus } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

export default function AdminRentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [tab, setTab] = useState<RentalStatus | 'all'>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      let query = supabase
        .from('rentals')
        .select('*, classrooms(class_name), shared_devices(device_name)')
        .order('rented_at', { ascending: false })
      if (tab !== 'all') query = query.eq('status', tab)
      const { data } = await query
      setRentals((data as Rental[]) ?? [])
    }
    load()
  }, [tab])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">전체 대여 현황</h1>

      <div className="mb-4 flex gap-2">
        {(['all', '대여 중', '반납 완료'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s === 'all' ? '전체' : s}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {rentals.length === 0 ? (
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
                  <th className="px-4 py-3 font-medium">반납일</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rentals.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.rented_at)}</td>
                    <td className="px-4 py-3 font-medium">{r.classrooms?.class_name ?? '-'}</td>
                    <td className="px-4 py-3">{r.shared_devices?.device_name ?? '-'}</td>
                    <td className="px-4 py-3">{r.quantity}대</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.returned_at)}</td>
                    <td className="px-4 py-3"><Badge label={r.status} /></td>
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
