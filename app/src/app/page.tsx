import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-4 text-5xl">💻</div>
          <h1 className="text-2xl font-bold text-gray-900">디지털기기 관리 플랫폼</h1>
          <p className="mt-2 text-sm text-gray-500">학교 디지털기기 통합 관리 시스템</p>
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-center text-base font-semibold text-gray-700">로그인 방식 선택</h2>

          <Link
            href="/login/admin"
            className="flex items-center gap-4 rounded-xl border-2 border-blue-100 bg-blue-50 p-5 transition-all hover:border-blue-400 hover:bg-blue-100"
          >
            <span className="text-3xl">🔑</span>
            <div>
              <p className="font-semibold text-blue-900">관리자 로그인</p>
              <p className="text-xs text-blue-600">디지털정보부장 · 이메일 로그인</p>
            </div>
          </Link>

          <Link
            href="/login/teacher"
            className="flex items-center gap-4 rounded-xl border-2 border-emerald-100 bg-emerald-50 p-5 transition-all hover:border-emerald-400 hover:bg-emerald-100"
          >
            <span className="text-3xl">🏫</span>
            <div>
              <p className="font-semibold text-emerald-900">교사 로그인</p>
              <p className="text-xs text-emerald-600">학급명 + 학교코드로 입장</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
