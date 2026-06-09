'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getTeacherSession } from '@/lib/teacher-auth'
import { TutorSupport } from '@/types'
import { Button } from '@/components/ui/Button'

const PERIODS = ['1교시', '2교시', '3교시', '4교시', '5-1교시', '5-2교시', '6교시']

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function Calendar({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (d: string) => void
}) {
  const today = toLocalDateString(new Date())
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="w-full rounded-xl bg-white p-4 shadow-sm">
      {/* 월 네비게이션 */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button onClick={nextMonth} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="mb-1 grid grid-cols-7">
        {WEEK_DAYS.map((d, i) => (
          <div
            key={d}
            className={`py-1 text-center text-xs font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === selected
          const isToday = dateStr === today
          const col = idx % 7
          return (
            <button
              key={idx}
              onClick={() => onSelect(dateStr)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors
                ${isSelected ? 'bg-emerald-600 font-semibold text-white' : ''}
                ${isToday && !isSelected ? 'ring-2 ring-emerald-400 font-semibold text-emerald-700' : ''}
                ${!isSelected && !isToday ? 'hover:bg-gray-100' : ''}
                ${col === 0 && !isSelected ? 'text-red-400' : ''}
                ${col === 6 && !isSelected ? 'text-blue-400' : ''}
              `}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function TeacherTutorPage() {
  const router = useRouter()
  const [classroomId, setClassroomId] = useState('')
  const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()))
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mySupports, setMySupports] = useState<TutorSupport[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async (cid: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tutor_supports')
      .select('*')
      .eq('classroom_id', cid)
      .order('support_date', { ascending: false })
    setMySupports((data as TutorSupport[]) ?? [])
  }, [])

  useEffect(() => {
    const session = getTeacherSession()
    if (!session) { router.push('/login/teacher'); return }
    setClassroomId(session.classroomId)
    load(session.classroomId)
  }, [router, load])

  async function handleSubmit() {
    if (!selectedDate) { setError('날짜를 선택해주세요.'); return }
    if (!selectedPeriod) { setError('교시를 선택해주세요.'); return }
    if (!content.trim()) { setError('지원 내용을 입력해주세요.'); return }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('tutor_supports').insert({
      classroom_id: classroomId,
      support_date: selectedDate,
      period: selectedPeriod,
      content: content.trim(),
    })
    setSubmitting(false)
    if (err) { setError(`저장 실패: ${err.message}`); return }
    setSelectedPeriod('')
    setContent('')
    load(classroomId)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 신청을 삭제할까요?')) return
    setDeleting(id)
    const supabase = createClient()
    await supabase.from('tutor_supports').delete().eq('id', id)
    setDeleting(null)
    load(classroomId)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">튜터 수업 지원</h1>
        <p className="mt-1 text-sm text-gray-500">날짜와 교시를 선택하고 지원 내용을 입력해주세요.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 달력 */}
        <Calendar selected={selectedDate} onSelect={setSelectedDate} />

        {/* 신청 폼 */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            신청일: <span className="text-emerald-600">{selectedDate}</span>
          </h2>

          {/* 교시 선택 */}
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-gray-700">교시 선택 <span className="text-red-500">*</span></p>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedPeriod === p
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 지원 내용 */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              지원 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="수업 지원 내용을 입력해주세요."
            />
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button
            loading={submitting}
            onClick={handleSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            수업 지원 신청
          </Button>
        </div>
      </div>

      {/* 내 신청 내역 */}
      <div className="mt-6 rounded-xl bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">내 신청 내역</h2>
        </div>
        {mySupports.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">신청 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">교시</th>
                  <th className="px-4 py-3 font-medium">지원 내용</th>
                  <th className="px-4 py-3 font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mySupports.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{s.support_date}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{s.period}</td>
                    <td className="px-4 py-3 text-gray-700">{s.content}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deleting === s.id}
                        onClick={() => handleDelete(s.id)}
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
    </div>
  )
}
