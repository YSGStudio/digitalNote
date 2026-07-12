'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { clearTeacherSession, getTeacherSession } from '@/lib/teacher-auth'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/teacher/dashboard', label: '대시보드', icon: '🏠' },
  { href: '/teacher/my-devices', label: '내 학급 기기', icon: '💻' },
  { href: '/teacher/repair', label: '고장 신고', icon: '🔧' },
  { href: '/teacher/rentals', label: '기기 대여·반납', icon: '📦' },
  { href: '/teacher/tutor', label: '튜터 수업 지원', icon: '📚' },
]

export function TeacherSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [className, setClassName] = useState('')

  useEffect(() => {
    const session = getTeacherSession()
    if (session) setClassName(session.className)
  }, [])

  function handleLogout() {
    clearTeacherSession()
    router.push('/')
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <p className="text-xs font-semibold text-[#17856d]">교사</p>
        <p className="mt-1 text-sm font-bold text-slate-950">{className || '...'}</p>
      </div>

      <nav className="flex-1 space-y-1.5 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all',
              pathname === item.href
                ? 'bg-emerald-50 text-[#116b58] shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            )}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          <span className="w-5 text-center">🚪</span>
          로그아웃
        </button>
      </div>
    </aside>
  )
}
