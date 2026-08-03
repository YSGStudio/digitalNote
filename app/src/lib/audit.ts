import { createClient } from './supabase'
import { AuditAction } from '@/types'

interface LogAuditParams {
  schoolId: string | null
  tableName: string
  recordId?: string | null
  action: AuditAction
  summary: string
  changes?: Record<string, unknown> | null
  /** 관리자는 생략(로그인 이메일을 자동 사용). 교사 등 Supabase Auth 세션이 없는 경우 직접 지정 */
  actor?: string
}

export async function logAudit(params: LogAuditParams) {
  const supabase = createClient()
  let actorEmail = params.actor
  if (!actorEmail) {
    const { data: { user } } = await supabase.auth.getUser()
    actorEmail = user?.email ?? 'unknown'
  }
  await supabase.from('audit_logs').insert({
    school_id: params.schoolId,
    actor_email: actorEmail,
    table_name: params.tableName,
    record_id: params.recordId ?? null,
    action: params.action,
    summary: params.summary,
    changes: params.changes ?? null,
  })
}

/** before/after 객체에서 지정한 키들만 값이 달라진 필드를 뽑아 {old, new} 형태로 반환 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  keys: (keyof T)[]
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {}
  for (const key of keys) {
    const oldValue = before[key] ?? null
    const newValue = (after[key] ?? null) as unknown
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diff[String(key)] = { old: oldValue, new: newValue }
    }
  }
  return diff
}
