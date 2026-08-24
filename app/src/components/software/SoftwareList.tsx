'use client'

import { useMemo, useState } from 'react'
import { ApprovedSoftware } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  INDEX_KEYS,
  SoftwareSort,
  availableIndexKeys,
  filterSoftware,
  indexKey,
  safeHref,
} from '@/lib/software'

interface SoftwareListProps {
  items: ApprovedSoftware[]
  /** 관리자 화면에서만 넘긴다. 넘기지 않으면 수정 열이 그려지지 않는다 */
  onEdit?: (item: ApprovedSoftware) => void
  accent?: 'blue' | 'emerald'
  emptyMessage?: string
}

const ACCENT = {
  blue: { on: 'bg-blue-600 text-white', ring: 'focus:border-blue-500 focus:ring-blue-500', link: 'text-blue-600' },
  emerald: { on: 'bg-emerald-600 text-white', ring: 'focus:border-emerald-500 focus:ring-emerald-500', link: 'text-emerald-700' },
}

export function SoftwareList({
  items,
  onEdit,
  accent = 'blue',
  emptyMessage = '등록된 소프트웨어가 없습니다.',
}: SoftwareListProps) {
  const [search, setSearch] = useState('')
  const [index, setIndex] = useState<string | null>(null)
  const [eduzipOnly, setEduzipOnly] = useState(false)
  const [sort, setSort] = useState<SoftwareSort>('name')
  const a = ACCENT[accent]

  // 색인 활성 여부는 검색·에듀집 필터까지만 적용한 목록으로 판단한다.
  // (색인 자신을 조건에 넣으면 선택한 글자만 활성으로 남는다)
  const beforeIndex = useMemo(
    () => filterSoftware(items, { search, index: null, eduzipOnly, sort }),
    [items, search, eduzipOnly, sort]
  )
  const enabledKeys = useMemo(() => availableIndexKeys(beforeIndex), [beforeIndex])
  const visible = useMemo(
    () => (index ? beforeIndex.filter((s) => indexKey(s.name) === index) : beforeIndex),
    [beforeIndex, index]
  )

  return (
    <div className="space-y-4">
      {/* 검색 · 필터 · 정렬 */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="소프트웨어명·회사명 검색"
            className={cn(
              'min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1',
              a.ring
            )}
          />
          <label className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={eduzipOnly}
              onChange={(e) => setEduzipOnly(e.target.checked)}
              className="h-4 w-4"
            />
            에듀집 등록만
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SoftwareSort)}
            className={cn('rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1', a.ring)}
          >
            <option value="name">가나다순</option>
            <option value="recent">최근 등록순</option>
          </select>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          총 {items.length}건 / 표시 {visible.length}건
          {(search || index || eduzipOnly) && (
            <button
              onClick={() => { setSearch(''); setIndex(null); setEduzipOnly(false) }}
              className="ml-2 font-medium text-gray-600 underline hover:text-gray-900"
            >
              조건 초기화
            </button>
          )}
        </p>

        {/* 색인 바 */}
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-gray-100 pt-3">
          <button
            onClick={() => setIndex(null)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
              index === null ? a.on : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            전체
          </button>
          {INDEX_KEYS.map((k) => {
            const enabled = enabledKeys.has(k)
            return (
              <button
                key={k}
                disabled={!enabled}
                onClick={() => setIndex(index === k ? null : k)}
                className={cn(
                  'w-7 rounded-md py-1 text-xs font-semibold transition-colors',
                  index === k ? a.on : enabled ? 'text-gray-700 hover:bg-gray-100' : 'cursor-not-allowed text-gray-300'
                )}
              >
                {k}
              </button>
            )
          })}
        </div>
      </div>

      {/* 목록 */}
      {visible.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center text-sm text-gray-400 shadow-sm">
          {items.length === 0 ? emptyMessage : '조건에 맞는 소프트웨어가 없습니다.'}
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm">
          {/* 데스크톱 — 표 */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">소프트웨어명</th>
                  <th className="px-4 py-3 font-medium">회사</th>
                  <th className="px-4 py-3 font-medium">에듀집</th>
                  <th className="px-4 py-3 font-medium">주소</th>
                  <th className="px-4 py-3 font-medium">비고</th>
                  {onEdit && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((s) => {
                  const href = safeHref(s.eduzip_url)
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.company || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          label={s.eduzip_registered ? '등록' : '미등록'}
                          className={s.eduzip_registered ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ''}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn('font-medium hover:underline', a.link)}
                          >
                            바로가기 ↗
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-gray-500">
                        <span className="line-clamp-2">{s.note || '-'}</span>
                      </td>
                      {onEdit && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => onEdit(s)}
                            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            수정
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일·태블릿 — 카드 */}
          <div className="divide-y md:hidden">
            {visible.map((s) => {
              const href = safeHref(s.eduzip_url)
              return (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{s.name}</p>
                      <p className="truncate text-xs text-gray-500">{s.company || '회사 미상'}</p>
                    </div>
                    <Badge
                      label={s.eduzip_registered ? '등록' : '미등록'}
                      className={s.eduzip_registered ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ''}
                    />
                  </div>
                  {s.note && <p className="mt-1.5 text-xs text-gray-500">{s.note}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('text-xs font-medium hover:underline', a.link)}
                      >
                        바로가기 ↗
                      </a>
                    )}
                    {onEdit && (
                      <button onClick={() => onEdit(s)} className="text-xs font-semibold text-gray-600 underline">
                        수정
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
