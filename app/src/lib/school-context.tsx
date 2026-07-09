'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from './supabase'

interface SchoolContextValue {
  schoolId: string | null
  loading: boolean
}

const SchoolContext = createContext<SchoolContextValue>({ schoolId: null, loading: true })

export function AdminSchoolProvider({ children }: { children: ReactNode }) {
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchool() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('admin_profiles')
        .select('school_id')
        .eq('user_id', user.id)
        .single()
      setSchoolId(data?.school_id ?? null)
      setLoading(false)
    }
    loadSchool()
  }, [])

  return (
    <SchoolContext.Provider value={{ schoolId, loading }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  return useContext(SchoolContext)
}
