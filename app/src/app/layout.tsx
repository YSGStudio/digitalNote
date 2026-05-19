import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '디지털기기 관리 플랫폼',
  description: '학교 디지털기기 관리 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
