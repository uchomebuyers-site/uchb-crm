import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

function DisabledScreen() {
  useEffect(() => {
    supabase.auth.signOut()
  }, [])

  return (
    <div className="min-h-screen bg-uchb-cream flex flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-semibold text-uchb-teal">Your account has been disabled</p>
      <p className="text-sm text-uchb-teal/70">Contact an admin if you think this is a mistake.</p>
    </div>
  )
}

function PendingScreen() {
  return (
    <div className="min-h-screen bg-uchb-cream flex flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-semibold text-uchb-teal">Your account is awaiting admin approval</p>
      <p className="text-sm text-uchb-teal/70">You'll get access once an admin approves your account.</p>
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-uchb-cream flex items-center justify-center">
        <p className="text-uchb-teal">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />
  }

  if (profile?.status === 'disabled') {
    return <DisabledScreen />
  }

  if (profile?.role === 'pending') {
    return <PendingScreen />
  }

  return children
}
