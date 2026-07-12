'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { setTeacherSession } from '@/lib/teacher-auth'
import { Classroom } from '@/types'
import { Button } from '@/components/ui/Button'

type Step = 'code' | 'select'

export default function TeacherLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('code')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [entering, setEntering] = useState(false)

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: config } = await supabase
        .from('school_config')
        .select('id, school_code')
        .eq('school_code', schoolCode.trim())
        .maybeSingle()

      if (!config) {
        setError('학교코드가 올바르지 않습니다.')
        return
      }

      setSchoolId(config.id)

      const { data: rooms } = await supabase
        .from('classrooms')
        .select('*')
        .eq('school_id', config.id)
        .order('class_name')

      setClassrooms((rooms as Classroom[]) ?? [])
      setStep('select')
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setStep('code')
    setError('')
    setSelectedId('')
  }

  async function handleEnter() {
    if (!selectedId) { setError('학급을 선택해주세요.'); return }
    setEntering(true)
    const classroom = classrooms.find((c) => c.id === selectedId)!
    setTeacherSession({
      classroomId: classroom.id,
      className: classroom.class_name,
      teacherName: classroom.teacher_name ?? '',
      school_id: schoolId,
    })
    router.push('/teacher/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,_#ccfbf1,_transparent_28rem),linear-gradient(135deg,_#f8fafc,_#eef2f7)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-lg shadow-slate-900/10">🏫</div>
          <h1 className="text-xl font-bold text-slate-950">교사 로그인</h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 'code' ? '학교코드를 입력하세요' : '학급을 선택하세요'}
          </p>
        </div>

        {step === 'code' ? (
          <div className="rounded-2xl bg-white/95 p-8 shadow-xl shadow-slate-900/10">
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">학교코드</label>
                <input
                  type="password"
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="관리자에게 문의"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                loading={loading}
                className="w-full bg-[#17856d] hover:bg-[#116b58] focus:ring-emerald-500"
              >
                확인
              </Button>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/95 p-6 shadow-xl shadow-slate-900/10">
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
            >
              ← 코드 다시 입력
            </button>

            {classrooms.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-3xl mb-3">📭</p>
                <p className="text-sm font-medium text-gray-600">등록된 학급이 없습니다.</p>
                <p className="mt-1 text-xs text-gray-400">관리자에게 학급 등록을 요청하세요.</p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-gray-500">총 {classrooms.length}개 학급</p>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {classrooms.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
                        selectedId === c.id
                          ? 'border-[#17856d] bg-emerald-50 shadow-sm'
                          : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{c.class_name}</p>
                      {c.teacher_name && (
                        <p className="mt-0.5 text-xs text-gray-400">{c.teacher_name} 선생님</p>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            {classrooms.length > 0 && (
              <Button
                onClick={handleEnter}
                loading={entering}
                disabled={!selectedId}
                className="mt-4 w-full bg-[#17856d] hover:bg-[#116b58] focus:ring-emerald-500 disabled:bg-emerald-200"
              >
                입장하기
              </Button>
            )}
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← 뒤로</Link>
        </div>
      </div>
    </div>
  )
}
