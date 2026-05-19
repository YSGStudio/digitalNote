import { TeacherSession } from '@/types'

const TEACHER_SESSION_KEY = 'teacher_session'

export function getTeacherSession(): TeacherSession | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(TEACHER_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TeacherSession
  } catch {
    return null
  }
}

export function setTeacherSession(session: TeacherSession) {
  localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(session))
}

export function clearTeacherSession() {
  localStorage.removeItem(TEACHER_SESSION_KEY)
}
