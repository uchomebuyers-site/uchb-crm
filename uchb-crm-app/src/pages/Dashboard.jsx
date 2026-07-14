import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import AppHeader from '../components/AppHeader'
import Skeleton from '../components/Skeleton'

function arr(v) {
  return Array.isArray(v) ? v : []
}

const STAGE_BAR_COLORS = {
  teal: 'bg-uchb-teal',
  gold: 'bg-uchb-gold',
  green: 'bg-green-600',
  gray: 'bg-gray-400',
}

export default function Dashboard() {
  const { profile, session } = useAuth()
  const displayName = profile?.full_name || profile?.email || session?.user?.email

  const [stages, setStages] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, leadsRes] = await Promise.all([
        supabase.from('stages').select('id, label, sort_order, color').order('sort_order'),
        supabase.from('leads').select('id, stage, created_at'),
      ])

      if (!active) return

      setStages(arr(stagesRes.data))
      setLeads(arr(leadsRes.data))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const newThisWeek = leads.filter((l) => l.created_at && new Date(l.created_at) >= sevenDaysAgo).length

  const countByStage = stages.map((s) => ({
    ...s,
    count: leads.filter((l) => l.stage === s.id).length,
  }))
  const maxCount = Math.max(1, ...countByStage.map((s) => s.count))

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="UCHB CRM" />

      <main className="space-y-6 px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-uchb-teal p-6 text-center shadow-sm">
              <p className="text-4xl font-bold text-uchb-cream">{newThisWeek}</p>
              <p className="mt-1 text-sm text-uchb-cream/70">
                New lead{newThisWeek === 1 ? '' : 's'} this week
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-uchb-teal">Leads by stage</p>
              <div className="space-y-2.5">
                {countByStage.map((s) => (
                  <div key={s.id}>
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-uchb-teal/70">
                      <span>{s.label}</span>
                      <span>{s.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-uchb-teal/5">
                      <div
                        className={`h-full rounded-full ${STAGE_BAR_COLORS[s.color] || STAGE_BAR_COLORS.gray}`}
                        style={{ width: `${(s.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <p className="text-uchb-teal/70 text-sm">Signed in as {displayName}</p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="rounded-xl bg-uchb-gold px-6 py-3 font-medium text-uchb-teal shadow-sm"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  )
}
