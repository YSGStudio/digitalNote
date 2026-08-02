'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/operator/dashboard', label: '대시보드', icon: '📊' },
  { href: '/operator/schools', label: '학교 목록', icon: '🏫' },
]

export function OperatorSidebar() {
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
        <p className="text-xs font-semibold text-[#3f5f95]">운영자</p>
        <p className="mt-1 text-sm font-bold text-slate-950">스쿨디바이스</p>
      </div>

      <nav className="flex-1 space-y-1.5 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all',
              pathname === item.href || pathname.startsWith(item.href + '/')
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
