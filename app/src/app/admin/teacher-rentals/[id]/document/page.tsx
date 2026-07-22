'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { TeacherDeviceLoan } from '@/types'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { useSchool } from '@/lib/school-context'

type LoanWithSchool = TeacherDeviceLoan & { school_config: { school_name: string } | null }

const PART_OPTIONS = ['충전기', '케이블', '케이스', '펜', '기타']

const LOAN_NOTICE =
  '고장 및 분실 시 수리해서 반납하고, 분실했을 경우 동일한 사양의 컴퓨터로 반납한다.'

function deviceLabel(loan: TeacherDeviceLoan) {
  return loan.device_type === '기타' ? loan.device_etc || '기타' : loan.device_type || '-'
}

function conditionLabel(loan: TeacherDeviceLoan) {
  return loan.condition === '기타' ? loan.condition_etc || '기타' : loan.condition || '-'
}

export default function TeacherLoanDocumentPage() {
  const params = useParams<{ id: string }>()
  const { schoolId, loading: schoolLoading } = useSchool()
  const [loan, setLoan] = useState<LoanWithSchool | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!schoolId || !params.id) return
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('teacher_device_loans')
        .select('*, school_config(school_name)')
        .eq('id', params.id)
        .eq('school_id', schoolId)
        .maybeSingle()
      if (!data) { setNotFound(true); setLoading(false); return }
      setLoan(data as LoanWithSchool)
      setLoading(false)
    }
    load()
  }, [schoolId, params.id])

  if (schoolLoading || loading) {
    return <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  if (notFound || !loan) {
    return <div className="py-20 text-center text-sm text-gray-400">문서를 찾을 수 없습니다.</div>
  }

  const schoolName = loan.school_config?.school_name ?? ''
  const parts = loan.parts ?? []

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>인쇄 / PDF 저장</Button>
      </div>

      {/* 대여증 */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-8 print:break-after-page print:rounded-none print:border-0 print:shadow-none">
        <h1 className="mb-1 text-center text-xl font-bold text-gray-900">디지털기기 대여증</h1>
        <p className="mb-6 text-center text-sm text-gray-400">{schoolName}</p>

        <table className="w-full border-collapse text-sm">
          <tbody>
            <Row label="성명">{loan.borrower_name}</Row>
            <Row label="대여일">{formatDate(loan.rent_date)}</Row>
            <Row label="기기 종류">{deviceLabel(loan)}</Row>
            <Row label="모델명">{loan.model || '-'}</Row>
            <Row label="자산관리번호">{loan.asset_no || '-'}</Row>
            <Row label="구성품">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {PART_OPTIONS.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1">
                    <span>{parts.includes(p) ? '☑' : '☐'}</span>
                    {p === '기타' && parts.includes('기타') ? loan.parts_etc || '기타' : p}
                  </span>
                ))}
              </div>
            </Row>
            <Row label="특이사항">{loan.note || '-'}</Row>
          </tbody>
        </table>

        <p className="mt-6 text-center text-sm text-gray-700">
          위 기기 및 구성품을 정상적으로 인수하였음을 확인합니다.
        </p>
        <p className="mb-6 mt-1 text-center text-xs text-gray-500">{LOAN_NOTICE}</p>

        <div className="grid grid-cols-2 gap-6">
          <SignatureBlock label="대여자" name={loan.borrower_name} src={loan.sig_borrower} />
          <SignatureBlock label="담당자" name={loan.manager_out_name} src={loan.sig_manager_out} />
        </div>
      </section>

      {/* 반납증 */}
      {loan.status === '반납완료' ? (
        <section className="rounded-xl border border-gray-200 bg-white p-8 print:rounded-none print:border-0 print:shadow-none">
          <h1 className="mb-1 text-center text-xl font-bold text-gray-900">디지털기기 반납증</h1>
          <p className="mb-6 text-center text-sm text-gray-400">{schoolName}</p>

          <table className="w-full border-collapse text-sm">
            <tbody>
              <Row label="성명">{loan.borrower_name}</Row>
              <Row label="기기 종류">{deviceLabel(loan)}</Row>
              <Row label="모델명">{loan.model || '-'}</Row>
              <Row label="자산관리번호">{loan.asset_no || '-'}</Row>
              <Row label="구성품">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {PART_OPTIONS.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1">
                      <span>{parts.includes(p) ? '☑' : '☐'}</span>
                      {p === '기타' && parts.includes('기타') ? loan.parts_etc || '기타' : p}
                    </span>
                  ))}
                </div>
              </Row>
              <Row label="반납일">{formatDate(loan.return_date)}</Row>
              <Row label="기기 상태">{conditionLabel(loan)}</Row>
              <Row label="특이사항">{loan.return_note || '-'}</Row>
            </tbody>
          </table>

          <p className="my-6 text-center text-sm text-gray-700">
            위 기기 및 구성품을 반납하였으며, 담당자가 이를 확인하였습니다.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <SignatureBlock label="반납자" name={loan.borrower_name} src={loan.sig_returner} />
            <SignatureBlock label="담당자" name={loan.manager_in_name} src={loan.sig_manager_in} />
          </div>
        </section>
      ) : (
        <p className="text-center text-sm text-gray-400 print:hidden">
          아직 반납되지 않아 반납증은 발급되지 않습니다.
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-gray-100">
      <th className="w-32 whitespace-nowrap bg-gray-50 px-3 py-2.5 text-left font-medium text-gray-500">
        {label}
      </th>
      <td className="px-3 py-2.5 text-gray-900">{children}</td>
    </tr>
  )
}

function SignatureBlock({ label, name, src }: { label: string; name: string | null; src: string | null | undefined }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-xs text-gray-400">{label}</p>
      <div className="flex h-20 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${label} 서명`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-gray-300">서명 없음</span>
        )}
      </div>
      {name && <p className="mt-1 text-sm font-medium text-gray-700">{name}</p>}
    </div>
  )
}
