import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

function safeStr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function digitsOnly(v) {
  return safeStr(v).replace(/\D/g, '')
}

function tempClasses(temp, active) {
  if (!active) return 'bg-white text-uchb-teal/60 border border-uchb-teal/20'
  if (temp === 'Hot') return 'bg-uchb-gold text-uchb-teal border border-uchb-gold'
  if (temp === 'Warm') return 'bg-uchb-teal text-uchb-cream border border-uchb-teal'
  return 'bg-gray-300 text-gray-700 border border-gray-300'
}

const inputClasses =
  'w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold'

export default function NewLead() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showToast } = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [timeline, setTimeline] = useState('')
  const [motivation, setMotivation] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [temperature, setTemperature] = useState('')
  const [sources, setSources] = useState([])
  const [duplicates, setDuplicates] = useState([])
  const [confirmedOverride, setConfirmedOverride] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingDupes, setCheckingDupes] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('sources')
      .select('id, label, direction')
      .eq('is_active', true)
      .order('label')
      .then(({ data }) => {
        if (active) setSources(arr(data))
      })
    return () => {
      active = false
    }
  }, [])

  async function findDuplicates(normalizedPhone, trimmedAddress) {
    const [byPhone, byAddress] = await Promise.all([
      normalizedPhone
        ? supabase.from('leads').select('id, name, property_address').eq('phone', normalizedPhone)
        : Promise.resolve({ data: [] }),
      trimmedAddress
        ? supabase.from('leads').select('id, name, property_address').ilike('property_address', trimmedAddress)
        : Promise.resolve({ data: [] }),
    ])

    const seen = new Map()
    for (const lead of [...arr(byPhone.data), ...arr(byAddress.data)]) {
      seen.set(lead.id, lead)
    }
    return [...seen.values()]
  }

  async function insertLead(normalizedPhone, trimmedName, trimmedAddress) {
    setSaving(true)

    const { data: inserted, error } = await supabase
      .from('leads')
      .insert({
        name: trimmedName,
        phone: normalizedPhone,
        property_address: trimmedAddress,
        timeline_to_sell: safeStr(timeline) || null,
        motivation: safeStr(motivation) || null,
        source: sourceId || null,
        temperature: temperature || null,
        assigned_to: session?.user?.id || null,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      setSaving(false)
      showToast('Could not save lead.', 'error')
      return
    }

    navigate(`/leads/${inserted.id}`)
    showToast('Lead saved.')

    supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .then(({ data: admins, error: adminsError }) => {
        if (adminsError) console.error('admins lookup failed', adminsError)
        const rows = arr(admins).map((admin) => ({
          user_id: admin.id,
          type: 'new_lead',
          lead_id: inserted.id,
          body: `New lead: ${trimmedName} — ${trimmedAddress}`,
          read: false,
        }))
        if (rows.length) {
          supabase
            .from('notifications')
            .insert(rows)
            .then(({ error: notifError }) => {
              if (notifError) console.error('notification insert failed: ' + JSON.stringify(notifError))
            })
        }
      })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const trimmedName = safeStr(name)
    const trimmedAddress = safeStr(address)
    const normalizedPhone = digitsOnly(phone)

    if (!trimmedName || !normalizedPhone || !trimmedAddress) {
      showToast('Name, phone, and address are required.', 'error')
      return
    }

    if (!confirmedOverride) {
      setCheckingDupes(true)
      const found = await findDuplicates(normalizedPhone, trimmedAddress)
      setCheckingDupes(false)

      if (found.length > 0) {
        setDuplicates(found)
        return
      }
    }

    await insertLead(normalizedPhone, trimmedName, trimmedAddress)
  }

  const showWarning = duplicates.length > 0 && !confirmedOverride

  return (
    <div className="min-h-screen bg-uchb-cream">
      <header className="bg-uchb-teal px-6 py-4">
        <Link to="/leads" className="text-uchb-cream/70 text-sm">
          &larr; Leads
        </Link>
        <h1 className="text-uchb-cream text-lg font-semibold">New Lead</h1>
      </header>

      <main className="px-4 py-6 pb-10">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Name *</label>
            <input
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Phone *</label>
            <input
              className={inputClasses}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Property address *</label>
            <input
              className={inputClasses}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              required
            />
          </div>

          {showWarning && (
            <div className="space-y-3 rounded-xl border border-uchb-gold bg-uchb-gold/10 p-4">
              <p className="text-sm font-medium text-uchb-teal">
                {duplicates.length === 1 ? 'A similar lead already exists:' : 'Similar leads already exist:'}
              </p>
              <ul className="space-y-1">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    <Link to={`/leads/${d.id}`} className="text-sm text-uchb-teal underline">
                      {d.name} — {d.property_address}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmedOverride(true)}
                  className="flex-1 rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream"
                >
                  This is different — save anyway
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicates([])}
                  className="flex-1 rounded-xl border border-uchb-teal/20 py-2.5 text-sm font-medium text-uchb-teal"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Timeline to sell</label>
            <input
              className={inputClasses}
              value={timeline}
              onChange={(e) => setTimeline(e.target.value)}
              placeholder="e.g. ASAP, 3-6 months"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Motivation</label>
            <textarea
              className={inputClasses}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Source</label>
            <select
              className={inputClasses}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Select a source</option>
              <optgroup label="Inbound">
                {sources
                  .filter((s) => s.direction === 'inbound')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Outbound">
                {sources
                  .filter((s) => s.direction === 'outbound')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Temperature</label>
            <div className="flex gap-2">
              {['Hot', 'Warm', 'Cold'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemperature(temperature === t ? '' : t)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${tempClasses(t, temperature === t)}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {!showWarning && (
            <button
              type="submit"
              disabled={saving || checkingDupes}
              className="w-full rounded-xl bg-uchb-teal py-4 font-semibold text-uchb-cream shadow-sm disabled:opacity-60"
            >
              {checkingDupes ? 'Checking…' : saving ? 'Saving…' : 'Save Lead'}
            </button>
          )}
        </form>
      </main>
    </div>
  )
}
