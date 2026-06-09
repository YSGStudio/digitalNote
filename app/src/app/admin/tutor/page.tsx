'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { TutorSupport } from '@/types'

export default function AdminTutorPage() {
  const [supports, setSupports] = useState<TutorSupport[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('tutor_supports')
      .select('*, classrooms(class_name)')
      .order('support_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (filterDate) query = query.eq('support_date', filterDate)
    const { data } = await query
    setSupports((data as TutorSupport[]) ?? [])
    setLoading(false)
  }, [filterDate])

  useEffect(() => { load() }, [load])

  const totalCount = supports.length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">튜터 수업 지원 현황</h1>
          {!loading && (
            <p className="mt-1 text-sm text-gray-500">
              {filterDate ? `${filterDate} · ` : ''}{totalCount}건
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : supports.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">
            {filterDate ? '해당 날짜의 지원 신청이 없습니다.' : '등록된 수업 지원 신청이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">학급</th>
                  <th className="px-4 py-3 font-medium">교시</th>
                  <th className="px-4 py-3 font-medium">지원 내용</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supports.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{s.support_date}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {s.classrooms?.class_name ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {s.period}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.content}</td>
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
