'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OperatorSidebar } from '@/components/OperatorSidebar'
import { createClient } from '@/lib/supabase'

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [guardError, setGuardError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function verify() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login/admin'); return }

      const { data: operatorProfile, error: operatorErr } = await supabase
        .from('operator_profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (operatorErr) {
        setGuardError(`권한 확인 실패: ${operatorErr.message}`)
        return
      }

      if (!operatorProfile) {
        // 운영자가 아니면 관리자 권한 여부로 안내
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle()
        router.replace(adminProfile ? '/admin/dashboard' : '/login/admin')
        return
      }

      setChecked(true)
    }

    verify()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.replace('/login/admin')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (guardError) {
    return (
      <div className="flex h-screen items-center justify-center px-4 text-center text-sm text-red-600">
        {guardError}
      </div>
    )
  }

  if (!checked) {
    return <div className="flex h-screen items-center justify-center text-sm text-gray-400">권한 확인 중...</div>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <OperatorSidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6 lg:p-8">{children}</main>
    </div>
  )
}
