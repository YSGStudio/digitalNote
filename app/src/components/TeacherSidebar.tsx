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
    <aside className="flex h-screen w-56 flex-col border-r bg-white">
      <div className="border-b px-4 py-5">
        <p className="text-xs font-medium text-emerald-600">교사</p>
        <p className="text-sm font-bold text-gray-900">{className || '...'}</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <span>🚪</span>
          로그아웃
        </button>
      </div>
    </aside>
  )
}
