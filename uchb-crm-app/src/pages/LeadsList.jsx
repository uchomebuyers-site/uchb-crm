import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fmtDate, fmtPhone } from '../lib/supabase'
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

const TEMP_RANK = { Hot: 0, Warm: 1, Cold: 2 }

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'property_address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'stage', label: 'Stage' },
  { key: 'temperature', label: 'Temp' },
  { key: 'owner', label: 'Owner' },
  { key: 'created_at', label: 'Created' },
]

function compareLeads(a, b, field, direction, stageSortOrder, adminsById) {
  let result = 0

  if (field === 'stage') {
    result = (stageSortOrder[a.stage] ?? 0) - (stageSortOrder[b.stage] ?? 0)
  } else if (field === 'temperature') {
    result = (TEMP_RANK[a.temperature] ?? 3) - (TEMP_RANK[b.temperature] ?? 3)
  } else if (field === 'owner') {
    result = safeStr(adminsById[a.assigned_to]).localeCompare(safeStr(adminsById[b.assigned_to]))
  } else if (field === 'created_at') {
    result = new Date(a.created_at || 0) - new Date(b.created_at || 0)
  } else {
    result = safeStr(a[field]).localeCompare(safeStr(b[field]))
  }

  return direction === 'asc' ? result : -result
}

function toCsvValue(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function exportCsv(leads, stagesById, adminsById) {
  const header = ['Name', 'Phone', 'Address', 'Stage', 'Temperature', 'Owner', 'Created']
  const rows = leads.map((l) => [
    l.name || '',
    l.phone || '',
    l.property_address || '',
    stagesById[l.stage] || '',
    l.temperature || '',
    adminsById[l.assigned_to] || '',
    l.created_at ? fmtDate(l.created_at) : '',
  ])
  const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `uchb-leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function LeadsList() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [stages, setStages] = useState([])
  const [admins, setAdmins] = useState([])
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ field: 'created_at', direction: 'desc' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, leadsRes, adminsRes] = await Promise.all([
        supabase.from('stages').select('id, label, sort_order').order('sort_order'),
        supabase
          .from('leads')
          .select('id, name, property_address, phone, temperature, stage, assigned_to, created_at')
          .order('created_at', { ascending: false }),
        // 'admin' and 'member' are both real team members who can be assigned leads.
        supabase.from('profiles').select('id, full_name, email').in('role', ['admin', 'member']),
      ])

      if (!active) return

      setStages(arr(stagesRes.data))
      setLeads(arr(leadsRes.data))
      setAdmins(arr(adminsRes.data))
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const stagesById = {}
  const stageSortOrder = {}
  for (const s of stages) {
    stagesById[s.id] = s.label
    stageSortOrder[s.id] = s.sort_order
  }

  const adminsById = {}
  for (const a of admins) adminsById[a.id] = a.full_name || a.email

  const searchTerm = search.trim().toLowerCase()
  const filteredLeads = leads.filter((l) => {
    if (ownerFilter !== 'all' && l.assigned_to !== ownerFilter) return false
    if (!searchTerm) return true
    return (
      safeStr(l.name).toLowerCase().includes(searchTerm) ||
      safeStr(l.property_address).toLowerCase().includes(searchTerm) ||
      safeStr(l.phone).toLowerCase().includes(searchTerm)
    )
  })

  const visibleLeads = useMemo(
    () => [...filteredLeads].sort((a, b) => compareLeads(a, b, sort.field, sort.direction, stageSortOrder, adminsById)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredLeads, sort, stages, admins],
  )

  function toggleSort(field) {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' },
    )
  }

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Leads" />

      <main className="px-4 py-4 pb-28 lg:pb-10">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            {!loading && admins.length > 0 && <OwnerFilter admins={admins} value={ownerFilter} onChange={setOwnerFilter} />}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, address, phone…"
              className="w-full rounded-xl border border-uchb-teal/20 bg-white px-4 py-2.5 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold lg:max-w-xs"
            />
          </div>
          <div className="hidden gap-2 lg:flex">
            <button
              type="button"
              onClick={() => exportCsv(visibleLeads, stagesById, adminsById)}
              disabled={visibleLeads.length === 0}
              className="rounded-xl border border-uchb-teal/20 bg-white px-4 py-2.5 text-sm font-medium text-uchb-teal disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => navigate('/leads/new')}
              className="rounded-xl bg-uchb-teal px-4 py-2.5 text-sm font-semibold text-uchb-cream"
            >
              + New Lead
            </button>
          </div>
        </div>

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
            <p className="text-uchb-teal/70 text-sm">No leads match.</p>
          </div>
        ) : (
          <>
            {/* Desktop: sortable table */}
            <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-uchb-teal/10 text-xs font-medium text-uchb-teal/60">
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="flex items-center gap-1 hover:text-uchb-teal"
                        >
                          {col.label}
                          {sort.field === col.key && <span>{sort.direction === 'asc' ? '↑' : '↓'}</span>}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="cursor-pointer border-b border-uchb-teal/5 last:border-0 hover:bg-uchb-cream/60"
                    >
                      <td className="px-4 py-3 font-medium text-uchb-teal">{safeStr(lead.name) || 'Unnamed lead'}</td>
                      <td className="px-4 py-3 text-uchb-teal/70">{safeStr(lead.property_address) || '—'}</td>
                      <td className="px-4 py-3 text-uchb-teal/70">{lead.phone ? fmtPhone(lead.phone) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-uchb-teal/5 px-2.5 py-1 text-xs font-medium text-uchb-teal/70">
                          {stagesById[lead.stage] || 'New'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.temperature && (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tempClasses(lead.temperature)}`}>
                            {lead.temperature}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-uchb-teal/70">{adminsById[lead.assigned_to] || '—'}</td>
                      <td className="px-4 py-3 text-uchb-teal/70">{fmtDate(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <ul className="space-y-3 lg:hidden">
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
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-uchb-teal/10 bg-uchb-cream/95 p-4 backdrop-blur lg:hidden">
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
