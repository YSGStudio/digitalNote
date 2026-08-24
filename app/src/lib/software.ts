import { ApprovedSoftware } from '@/types'

/** 화면·저장 공통 길이 제한 (기획서 6.3) */
export const LIMITS = {
  name: 100,
  company: 100,
  url: 500,
  text: 1000,
} as const

// ── 색인 (기획서 4.4) ────────────────────────────────────────
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
             'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const FOLD: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' }

export const HANGUL_INDEX = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
export const ALPHA_INDEX = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
export const INDEX_KEYS = [...HANGUL_INDEX, ...ALPHA_INDEX, '#']

/** 소프트웨어명의 첫 글자로 색인 그룹(한글 초성 / A–Z / #)을 구한다 */
export function indexKey(name: string): string {
  const ch = name.trim()[0] ?? '#'
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const cho = CHO[Math.floor((code - 0xac00) / 588)]
    return FOLD[cho] ?? cho
  }
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase()
  return '#'
}

// ── URL 처리 (기획서 6.3) ────────────────────────────────────
/**
 * URL 앞뒤 공백을 제거하고 스킴이 없으면 https:// 를 붙인다.
 * http/https 가 아닌 스킴(javascript: 등)은 거부한다.
 */
export function normalizeUrl(raw: string): { url: string; error?: string } {
  const v = raw.trim()
  if (!v) return { url: '' }
  if (/^https?:\/\//i.test(v)) return { url: v }
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    return { url: '', error: 'http:// 또는 https:// 로 시작하는 주소만 입력할 수 있습니다.' }
  }
  return { url: `https://${v}` }
}

/** 표시 전용 — 저장된 값이라도 http(s) 가 아니면 링크로 만들지 않는다 */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null
}

// ── 중복 판정 (기획서 5.3) ───────────────────────────────────
/** 정규화 키 = lower(trim(name)) + '|' + lower(trim(company)) */
export function dedupeKey(name: string, company: string | null | undefined): string {
  return `${name.trim().toLowerCase()}|${(company ?? '').trim().toLowerCase()}`
}

// ── 엑셀 열 제목 유연 매칭 (기획서 7.1) ──────────────────────
export function findCol(row: Record<string, unknown>, candidates: string[]): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')
  const keys = Object.keys(row)
  for (const c of candidates) {
    const found = keys.find((k) => norm(k) === norm(c))
    if (found !== undefined) return String(row[found] ?? '').trim()
  }
  return ''
}

export const EXCEL_COLS = {
  name: ['소프트웨어명', '소프트웨어', '프로그램명', '이름', '명칭', 'name'],
  company: ['회사', '회사명', '제작사', '개발사', '업체', '공급업체', 'company'],
  eduzip: ['에듀집', '에듀집등록', '에듀집 등록여부', '에듀집등록여부', '등록여부', 'eduzip'],
  url: ['주소', 'URL', 'url', '링크', '사이트', '홈페이지'],
  note: ['비고', '메모', '특이사항', 'note'],
} as const

/** 엑셀의 에듀집 등록 여부 값 해석 (기획서 7.2) */
export function parseEduzip(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  if (!v) return false
  return ['o', 'y', '예', '등록', 'true', '1', '√', '✓', 'yes', '등록됨'].includes(v)
}

// ── 목록 필터·정렬 (기획서 S-06~08) ──────────────────────────
export type SoftwareSort = 'name' | 'recent'

export function filterSoftware(
  list: ApprovedSoftware[],
  { search, index, eduzipOnly, sort }: {
    search: string
    index: string | null
    eduzipOnly: boolean
    sort: SoftwareSort
  }
): ApprovedSoftware[] {
  const q = search.trim().toLowerCase()
  const filtered = list.filter((s) => {
    if (index && indexKey(s.name) !== index) return false
    if (eduzipOnly && !s.eduzip_registered) return false
    if (q) {
      const hay = `${s.name} ${s.company ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  return filtered.sort((a, b) =>
    sort === 'recent'
      ? (b.created_at ?? '').localeCompare(a.created_at ?? '')
      : a.name.localeCompare(b.name, 'ko')
  )
}

/** 검색·에듀집 필터까지만 적용한 목록으로 "항목이 있는 색인 글자" 집합을 만든다 */
export function availableIndexKeys(list: ApprovedSoftware[]): Set<string> {
  return new Set(list.map((s) => indexKey(s.name)))
}
