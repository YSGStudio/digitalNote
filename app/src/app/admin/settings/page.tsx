'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { useSchool } from '@/lib/school-context'

interface Config {
  id: string
  school_name: string
  school_code: string
}

export default function AdminSettingsPage() {
  const { schoolId, loading: schoolLoading } = useSchool()
  const [config, setConfig] = useState<Config | null>(null)
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!schoolId) return
    async function load() {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from('school_config')
        .select('*')
        .eq('id', schoolId)
        .single()

      if (fetchErr) {
        setLoadError(`불러오기 실패: ${fetchErr.message}`)
        return
      }
      if (data) {
        setConfig(data as Config)
        setSchoolName(data.school_name)
        setSchoolCode(data.school_code)
      }
    }
    load()
  }, [schoolId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)

    if (!schoolName.trim() || !schoolCode.trim()) {
      setError('학교명과 학교코드를 모두 입력해주세요.')
      return
    }
    if (!config) return

    // 다른 학교가 같은 코드 사용 중인지 확인
    const supabase = createClient()
    const { data: codeCheck } = await supabase
      .from('school_config')
      .select('id')
      .eq('school_code', schoolCode.trim())
      .neq('id', config.id)
      .maybeSingle()

    if (codeCheck) {
      setError('이미 다른 학교에서 사용 중인 학교코드입니다.')
      return
    }

    setSaving(true)
    const { error: updateErr } = await supabase
      .from('school_config')
      .update({ school_name: schoolName.trim(), school_code: schoolCode.trim() })
      .eq('id', config.id)

    if (updateErr) {
      setError(formatDbError(updateErr.message))
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (schoolLoading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">학교 설정</h1>
      <p className="mb-6 text-sm text-gray-500">학교명과 교사 로그인에 사용할 학교코드를 관리합니다.</p>

      {loadError && (
        <div className="mb-4 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="max-w-md">
        <form onSubmit={handleSave} className="space-y-5 rounded-xl bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">학교명</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="예: ○○초등학교"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">학교코드</label>
            <div className="relative">
              <input
                type={showCode ? 'text' : 'password'}
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="교사들과 공유할 코드"
                required
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-600"
              >
                {showCode ? '숨김' : '보기'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              교사가 로그인할 때 입력하는 공용 코드입니다. 변경 즉시 반영됩니다.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <p className="font-medium">저장 실패</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
          )}

          {saved && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ 저장되었습니다.
            </p>
          )}

          <Button type="submit" loading={saving}>저장하기</Button>
        </form>

        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">학교코드 공유 안내</p>
          <p className="mt-1 text-xs text-yellow-700">
            학교코드는 교사 전체가 공유합니다. 변경하면 기존 코드로는 로그인할 수 없으므로
            변경 후 모든 교사에게 새 코드를 공지해주세요.
          </p>
        </div>
      </div>
    </div>
  )
}

function formatDbError(msg: string): string {
  if (msg.includes('row-level security') || msg.includes('RLS')) {
    return 'RLS 정책 오류 — Supabase SQL Editor에서 school_config 정책을 확인하세요.'
  }
  if (msg.includes('unique') || msg.includes('duplicate')) {
    return '이미 동일한 학교코드가 존재합니다. 다른 코드를 사용하세요.'
  }
  return msg
}
