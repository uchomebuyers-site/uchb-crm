import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  if (!userId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data ?? null
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      const currentSession = data.session
      const currentProfile = await fetchProfile(currentSession?.user?.id)
      if (!active) return
      setSession(currentSession)
      setProfile(currentProfile)
      setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      const nextProfile = await fetchProfile(nextSession?.user?.id)
      if (!active) return
      setSession(nextSession)
      setProfile(nextProfile)
      setLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' && profile?.status === 'active',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
