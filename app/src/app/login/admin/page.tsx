'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type Tab = 'login' | 'signup'

export default function AdminLoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // 회원가입 폼
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      if (error) { setError('이메일 또는 비밀번호가 올바르지 않습니다.'); return }
      router.push('/admin/dashboard')
    } catch {
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (signupPassword !== signupPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (signupPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (!schoolName.trim() || !schoolCode.trim()) {
      setError('학교명과 학교코드를 모두 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // 1. Supabase Auth 계정 생성
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      })
      if (signupError) {
        if (signupError.message.includes('already registered') || signupError.message.includes('already been registered')) {
          setError('이미 등록된 이메일입니다.')
        } else {
          setError(`회원가입 오류: ${signupError.message}`)
        }
        return
      }

      // 이메일 인증 대기 상태면 세션이 없음
      if (!signupData.session) {
        setError('Supabase 대시보드에서 이메일 인증(Confirm email)을 OFF로 설정해야 합니다. Authentication > Providers > Email > Confirm email 해제')
        return
      }

      // 2. 학교 설정 저장 (maybeSingle: 행이 없어도 에러 없이 null 반환)
      const { data: existing, error: fetchError } = await supabase
        .from('school_config')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (fetchError) {
        setError(`학교 설정 조회 실패: ${fetchError.message}`)
        return
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('school_config')
          .update({ school_name: schoolName.trim(), school_code: schoolCode.trim() })
          .eq('id', existing.id)
        if (updateError) { setError(`학교 설정 저장 실패: ${updateError.message}`); return }
      } else {
        const { error: insertError } = await supabase
          .from('school_config')
          .insert({ school_name: schoolName.trim(), school_code: schoolCode.trim() })
        if (insertError) { setError(`학교 설정 저장 실패: ${insertError.message}`); return }
      }

      router.push('/admin/dashboard')
    } catch {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">🔑</div>
          <h1 className="text-xl font-bold text-gray-900">관리자</h1>
          <p className="mt-1 text-sm text-gray-500">디지털정보부장 전용</p>
        </div>

        <div className="rounded-2xl bg-white shadow-lg">
          {/* 탭 */}
          <div className="flex border-b">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="admin@school.kr"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                <Button type="submit" loading={loading} className="w-full">로그인</Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="admin@school.kr"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호</label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="6자 이상"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호 확인</label>
                  <input
                    type="password"
                    value={signupPasswordConfirm}
                    onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">학교 초기 설정</p>
                  <div className="space-y-3">
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
                      <input
                        type="text"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="교사들과 공유할 코드"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-400">교사가 로그인할 때 사용하는 공용 코드입니다. 나중에 변경할 수 있습니다.</p>
                    </div>
                  </div>
                </div>

                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                <Button type="submit" loading={loading} className="w-full">회원가입 및 시작하기</Button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← 뒤로</Link>
        </div>
      </div>
    </div>
  )
}
