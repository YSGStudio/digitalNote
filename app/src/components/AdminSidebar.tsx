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
  { href: '/admin/teacher-rentals', label: '교사기기대여', icon: '📝' },
  { href: '/admin/tutor', label: '튜터 수업 지원', icon: '📚' },
  { href: '/admin/chromebooks', label: '크롬북 관리', icon: '🖥️' },
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
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200/80 bg-white print:hidden">
      <div className="border-b border-slate-100 px-5 py-5">
        <p className="text-xs font-semibold text-[#3f5f95]">관리자</p>
        <p className="mt-1 text-sm font-bold text-slate-950">스쿨디바이스</p>
      </div>

      <nav className="flex-1 space-y-1.5 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all',
              pathname === item.href
                ? 'bg-[#eef3ff] text-[#2f4777] shadow-sm'
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
