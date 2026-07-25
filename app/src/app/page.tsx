import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_28rem),linear-gradient(135deg,_#f8fafc,_#eef2f7)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow-lg shadow-slate-900/10">💻</div>
          <h1 className="text-2xl font-bold text-slate-950">스쿨디바이스</h1>
          <p className="mt-2 text-sm text-slate-500">학교 디지털기기 통합 관리 시스템</p>
        </div>

        <div className="space-y-4 rounded-2xl bg-white/95 p-8 shadow-xl shadow-slate-900/10">
          <h2 className="mb-6 text-center text-base font-semibold text-slate-700">로그인 방식 선택</h2>

          <Link
            href="/login/admin"
            className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50/70 p-5 transition-all hover:-translate-y-0.5 hover:border-[#8da4cf] hover:bg-blue-50 hover:shadow-md"
          >
            <span className="text-3xl">🔑</span>
            <div>
              <p className="font-semibold text-[#233a66]">관리자 로그인</p>
              <p className="text-xs text-[#5874a8]">디지털정보부장 · 이메일 로그인</p>
            </div>
          </Link>

          <Link
            href="/login/teacher"
            className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md"
          >
            <span className="text-3xl">🏫</span>
            <div>
              <p className="font-semibold text-[#0f5949]">교사 로그인</p>
              <p className="text-xs text-[#17856d]">학급명 + 학교코드로 입장</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
