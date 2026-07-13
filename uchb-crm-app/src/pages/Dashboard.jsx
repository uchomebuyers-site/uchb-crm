import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const displayName = profile?.full_name || profile?.email || session?.user?.email

  return (
    <div className="min-h-screen bg-uchb-cream flex flex-col">
      <header className="bg-uchb-teal px-6 py-4">
        <h1 className="text-uchb-cream text-lg font-semibold">UCHB CRM</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
        <p className="text-uchb-teal text-lg">Signed in as {displayName}</p>

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="rounded-xl bg-uchb-gold text-uchb-teal font-medium px-6 py-3 shadow-sm"
        >
          Sign out
        </button>
      </main>
    </div>
  )
}
