'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/admin/dashboard', label: '대시보드', icon: '📊' },
  { href: '/admin/classrooms', label: '학급 관리', icon: '🏫' },
  { href: '/admin/repairs', label: '고장 신고 관리', icon: '🔧' },
  { href: '/admin/device-types', label: '기기 종류 설정', icon: '⚙️' },
  { href: '/admin/devices', label: '공유 기기 관리', icon: '💻' },
  { href: '/admin/rentals', label: '전체 대여 현황', icon: '📋' },
  { href: '/admin/tutor', label: '튜터 수업 지원', icon: '📚' },
  { href: '/admin/settings', label: '학교 설정', icon: '🏫' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-white">
      <div className="border-b px-4 py-5">
        <p className="text-xs font-medium text-blue-600">관리자</p>
        <p className="text-sm font-bold text-gray-900">디지털기기 관리 플랫폼</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-blue-50 text-blue-700'
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
