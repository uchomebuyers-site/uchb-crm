import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Skeleton from '../components/Skeleton'
import AppHeader from '../components/AppHeader'
import OwnerChip from '../components/OwnerChip'
import OwnerFilter from '../components/OwnerFilter'

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function tempClasses(temp) {
  if (temp === 'Hot') return 'bg-uchb-gold text-uchb-teal'
  if (temp === 'Warm') return 'bg-uchb-teal text-uchb-cream'
  if (temp === 'Cold') return 'bg-gray-200 text-gray-500'
  return 'bg-gray-100 text-gray-400'
}

export default function LeadsList() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [stagesById, setStagesById] = useState({})
  const [admins, setAdmins] = useState([])
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, leadsRes, adminsRes] = await Promise.all([
        supabase.from('stages').select('id, label').order('sort_order'),
        supabase
          .from('leads')
          .select('id, name, property_address, temperature, stage, assigned_to, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'admin'),
      ])

      if (!active) return

      const map = {}
      for (const stage of arr(stagesRes.data)) {
        map[stage.id] = stage.label
      }
      setStagesById(map)
      setLeads(arr(leadsRes.data))
      setAdmins(arr(adminsRes.data))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const adminsById = {}
  for (const a of admins) adminsById[a.id] = a.full_name || a.email

  const visibleLeads = ownerFilter === 'all' ? leads : leads.filter((l) => l.assigned_to === ownerFilter)

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Leads" />

      <main className="px-4 py-4 pb-28">
        {!loading && admins.length > 0 && (
          <div className="mb-4">
            <OwnerFilter admins={admins} value={ownerFilter} onChange={setOwnerFilter} />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
                <Skeleton className="mb-2 h-4 w-2/3" />
                <Skeleton className="mb-3 h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-uchb-teal text-lg font-medium">No leads yet</p>
            <p className="mt-1 text-uchb-teal/70 text-sm">
              Add your first lead to start building your pipeline.
            </p>
          </div>
        ) : visibleLeads.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-uchb-teal/70 text-sm">No leads assigned here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleLeads.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="w-full rounded-2xl bg-white p-4 text-left shadow-sm active:bg-uchb-cream"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-uchb-teal font-semibold">{safeStr(lead.name) || 'Unnamed lead'}</p>
                    <OwnerChip name={adminsById[lead.assigned_to]} />
                  </div>
                  <p className="mt-0.5 text-sm text-uchb-teal/70">
                    {safeStr(lead.property_address) || 'No address'}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {lead.temperature && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${tempClasses(lead.temperature)}`}
                      >
                        {lead.temperature}
                      </span>
                    )}
                    <span className="rounded-full bg-uchb-teal/5 px-2.5 py-1 text-xs font-medium text-uchb-teal/70">
                      {stagesById[lead.stage] || 'New'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-uchb-teal/10 bg-uchb-cream/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/leads/new')}
          className="w-full rounded-xl bg-uchb-teal py-4 font-semibold text-uchb-cream shadow-sm"
        >
          + New Lead
        </button>
      </div>
    </div>
  )
}
