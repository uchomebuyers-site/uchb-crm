import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, fmtCurrency, fmtDate, fmtPhone } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Skeleton from '../components/Skeleton'

const inputClasses =
  'w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold'

const CURRENCY_FIELDS = [
  { key: 'arv', label: 'ARV' },
  { key: 'asking_price', label: 'Asking price' },
  { key: 'repair_estimate', label: 'Repair estimate' },
  { key: 'target_offer', label: 'Target offer' },
]

function safeStr(v) {
  return typeof v === 'string' ? v : ''
}

function arr(v) {
  return Array.isArray(v) ? v : []
}

function toNumberOrNull(v) {
  const trimmed = String(v).trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isNaN(n) ? null : n
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 text-uchb-teal/40 transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.92 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CollapsibleSection({ title, summary, children }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-uchb-teal/80">{title}</span>
          {!expanded && summary && <span className="mt-0.5 block truncate text-xs text-uchb-teal/50">{summary}</span>}
        </span>
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded && <div className="space-y-3 border-t border-uchb-teal/10 px-4 py-4">{children}</div>}
    </section>
  )
}

function OwnershipSection({ lead, patchLead }) {
  const [ownerName, setOwnerName] = useState(lead.owner_name || '')
  const [ownerPhone, setOwnerPhone] = useState(lead.owner_phone || '')
  const [listingAgentName, setListingAgentName] = useState(lead.listing_agent_name || '')
  const [listingAgentPhone, setListingAgentPhone] = useState(lead.listing_agent_phone || '')
  const [listingAgentBrokerage, setListingAgentBrokerage] = useState(lead.listing_agent_brokerage || '')
  const [listingUrl, setListingUrl] = useState(lead.listing_url || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await patchLead(
      {
        owner_name: safeStr(ownerName).trim() || null,
        owner_phone: safeStr(ownerPhone).trim() || null,
        listing_agent_name: safeStr(listingAgentName).trim() || null,
        listing_agent_phone: safeStr(listingAgentPhone).trim() || null,
        listing_agent_brokerage: safeStr(listingAgentBrokerage).trim() || null,
        listing_url: safeStr(listingUrl).trim() || null,
      },
      'Ownership & listing updated.',
    )
    setSaving(false)
  }

  return (
    <CollapsibleSection title="Ownership & Listing">
      <div>
        <label className="mb-1 block text-sm font-medium text-uchb-teal">Owner (if different from contact)</label>
        <div className="space-y-2">
          <input
            className={inputClasses}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Owner name"
          />
          <input
            className={inputClasses}
            type="tel"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            placeholder="Owner phone"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-uchb-teal">On the market?</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => patchLead({ is_on_market: false }, 'Marked not on market.')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
              !lead.is_on_market ? 'bg-uchb-teal text-uchb-cream' : 'border border-uchb-teal/20 text-uchb-teal/60'
            }`}
          >
            Not on market
          </button>
          <button
            type="button"
            onClick={() => patchLead({ is_on_market: true }, 'Marked on market.')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
              lead.is_on_market ? 'bg-uchb-teal text-uchb-cream' : 'border border-uchb-teal/20 text-uchb-teal/60'
            }`}
          >
            On market
          </button>
        </div>
      </div>

      {lead.is_on_market && (
        <div className="space-y-2 rounded-xl bg-uchb-cream/60 p-3">
          <input
            className={inputClasses}
            value={listingAgentName}
            onChange={(e) => setListingAgentName(e.target.value)}
            placeholder="Listing agent name"
          />
          <input
            className={inputClasses}
            type="tel"
            value={listingAgentPhone}
            onChange={(e) => setListingAgentPhone(e.target.value)}
            placeholder="Listing agent phone"
          />
          <input
            className={inputClasses}
            value={listingAgentBrokerage}
            onChange={(e) => setListingAgentBrokerage(e.target.value)}
            placeholder="Brokerage"
          />
          <input
            className={inputClasses}
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
            placeholder="Listing link (Zillow, Redfin, etc.)"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </CollapsibleSection>
  )
}

function UnderwritingSection({ lead, patchLead }) {
  const [arv, setArv] = useState(lead.arv ?? '')
  const [askingPrice, setAskingPrice] = useState(lead.asking_price ?? '')
  const [repairEstimate, setRepairEstimate] = useState(lead.repair_estimate ?? '')
  const [targetOffer, setTargetOffer] = useState(lead.target_offer ?? '')
  const [underwritingUrl, setUnderwritingUrl] = useState(lead.underwriting_url || '')
  const [driveFolderUrl, setDriveFolderUrl] = useState(lead.drive_folder_url || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await patchLead(
      {
        arv: toNumberOrNull(arv),
        asking_price: toNumberOrNull(askingPrice),
        repair_estimate: toNumberOrNull(repairEstimate),
        target_offer: toNumberOrNull(targetOffer),
        underwriting_url: safeStr(underwritingUrl).trim() || null,
        drive_folder_url: safeStr(driveFolderUrl).trim() || null,
      },
      'Underwriting updated.',
    )
    setSaving(false)
  }

  const summary = CURRENCY_FIELDS.filter((f) => lead[f.key] !== null && lead[f.key] !== undefined)
    .map((f) => `${f.label} ${fmtCurrency(lead[f.key])}`)
    .join(' · ')

  return (
    <CollapsibleSection title="Underwriting" summary={summary || null}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-uchb-teal">ARV</label>
          <input
            className={inputClasses}
            type="number"
            inputMode="decimal"
            value={arv}
            onChange={(e) => setArv(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-uchb-teal">Asking price</label>
          <input
            className={inputClasses}
            type="number"
            inputMode="decimal"
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-uchb-teal">Repair estimate</label>
          <input
            className={inputClasses}
            type="number"
            inputMode="decimal"
            value={repairEstimate}
            onChange={(e) => setRepairEstimate(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-uchb-teal">Target offer</label>
          <input
            className={inputClasses}
            type="number"
            inputMode="decimal"
            value={targetOffer}
            onChange={(e) => setTargetOffer(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-uchb-teal">Underwriting spreadsheet link</label>
        {lead.underwriting_url && (
          <a
            href={lead.underwriting_url}
            target="_blank"
            rel="noreferrer"
            className="mb-2 inline-block rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-sm font-medium text-uchb-teal"
          >
            Open spreadsheet ↗
          </a>
        )}
        <input
          className={inputClasses}
          value={underwritingUrl}
          onChange={(e) => setUnderwritingUrl(e.target.value)}
          placeholder="https://"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-uchb-teal">Drive folder link</label>
        {lead.drive_folder_url && (
          <a
            href={lead.drive_folder_url}
            target="_blank"
            rel="noreferrer"
            className="mb-2 inline-block rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-sm font-medium text-uchb-teal"
          >
            Open Drive folder ↗
          </a>
        )}
        <input
          className={inputClasses}
          value={driveFolderUrl}
          onChange={(e) => setDriveFolderUrl(e.target.value)}
          placeholder="https://"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </CollapsibleSection>
  )
}

function ContactSection({ lead, sourcesById, sources, patchLead }) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(lead.name || '')
  const [phone, setPhone] = useState(lead.phone || '')
  const [propertyAddress, setPropertyAddress] = useState(lead.property_address || '')
  const [email, setEmail] = useState(lead.email || '')
  const [timelineToSell, setTimelineToSell] = useState(lead.timeline_to_sell || '')
  const [motivation, setMotivation] = useState(lead.motivation || '')
  const [notes, setNotes] = useState(lead.notes || '')
  const [sourceId, setSourceId] = useState(lead.source || '')
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setName(lead.name || '')
    setPhone(lead.phone || '')
    setPropertyAddress(lead.property_address || '')
    setEmail(lead.email || '')
    setTimelineToSell(lead.timeline_to_sell || '')
    setMotivation(lead.motivation || '')
    setNotes(lead.notes || '')
    setSourceId(lead.source || '')
    setEditing(true)
  }

  async function handleSave() {
    const trimmedName = safeStr(name).trim()
    const trimmedPhone = safeStr(phone).trim()
    const trimmedAddress = safeStr(propertyAddress).trim()

    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      showToast('Name, phone, and address are required.', 'error')
      return
    }

    setSaving(true)
    await patchLead(
      {
        name: trimmedName,
        phone: trimmedPhone,
        property_address: trimmedAddress,
        email: safeStr(email).trim() || null,
        timeline_to_sell: safeStr(timelineToSell).trim() || null,
        motivation: safeStr(motivation).trim() || null,
        notes: safeStr(notes).trim() || null,
        source: sourceId || null,
      },
      'Contact info updated.',
    )
    setSaving(false)
    setEditing(false)
  }

  if (!editing) {
    return (
      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="block text-uchb-teal underline">
            {fmtPhone(lead.phone)}
          </a>
        )}
        {lead.property_address && (
          <a
            href={`https://maps.apple.com/?q=${encodeURIComponent(lead.property_address)}`}
            target="_blank"
            rel="noreferrer"
            className="block text-uchb-teal underline"
          >
            {lead.property_address}
          </a>
        )}
        {lead.property_address && (
          <a
            href={`https://www.zillow.com/homes/${encodeURIComponent(lead.property_address)}_rb/`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-uchb-teal/70 underline"
          >
            Zillow ↗
          </a>
        )}
        {lead.is_on_market && lead.listing_url && (
          <a
            href={lead.listing_url}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-uchb-teal underline"
          >
            View listing ↗
          </a>
        )}
        {lead.email && <p className="text-uchb-teal/70 text-sm">{lead.email}</p>}
        {lead.source && (
          <p className="text-uchb-teal/70 text-sm">
            Source: {sourcesById[lead.source]?.label || '—'}
            {sourcesById[lead.source]?.direction && (
              <span className="ml-1.5 rounded-full bg-uchb-teal/5 px-2 py-0.5 text-[11px] font-medium capitalize text-uchb-teal/60">
                {sourcesById[lead.source].direction}
              </span>
            )}
          </p>
        )}
        {lead.timeline_to_sell && <p className="text-uchb-teal/70 text-sm">Timeline: {lead.timeline_to_sell}</p>}
        {lead.motivation && <p className="text-uchb-teal/70 text-sm">Motivation: {lead.motivation}</p>}
        {lead.notes && <p className="text-uchb-teal/70 text-sm">Notes: {lead.notes}</p>}
        <button
          type="button"
          onClick={startEditing}
          className="mt-1 rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-sm font-medium text-uchb-teal"
        >
          Edit
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
      <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input
        className={inputClasses}
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
      />
      <input
        className={inputClasses}
        value={propertyAddress}
        onChange={(e) => setPropertyAddress(e.target.value)}
        placeholder="Property address"
      />
      <input
        className={inputClasses}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        className={inputClasses}
        value={timelineToSell}
        onChange={(e) => setTimelineToSell(e.target.value)}
        placeholder="Timeline to sell"
      />
      <input
        className={inputClasses}
        value={motivation}
        onChange={(e) => setMotivation(e.target.value)}
        placeholder="Motivation"
      />
      <textarea
        className={inputClasses}
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
      />
      <select className={inputClasses} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
        <option value="">No source selected</option>
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
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-uchb-teal py-2.5 text-sm font-medium text-uchb-cream disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 rounded-xl border border-uchb-teal/20 py-2.5 text-sm font-medium text-uchb-teal"
        >
          Cancel
        </button>
      </div>
    </section>
  )
}

function TagsSection({ leadId, allTags, leadTagIds, onTagsChange }) {
  const { showToast } = useToast()
  const [adding, setAdding] = useState(false)

  const currentTags = allTags.filter((t) => leadTagIds.includes(t.id))
  const availableTags = allTags.filter((t) => !leadTagIds.includes(t.id))

  async function removeTag(tagId) {
    const previous = leadTagIds
    onTagsChange(leadTagIds.filter((id) => id !== tagId))

    const { error } = await supabase.from('lead_tags').delete().eq('lead_id', leadId).eq('tag_id', tagId)
    if (error) {
      onTagsChange(previous)
      showToast('Could not remove tag.', 'error')
    }
  }

  async function addTag(tagId) {
    if (!tagId) return
    setAdding(false)
    const previous = leadTagIds
    onTagsChange([...leadTagIds, tagId])

    const { error } = await supabase.from('lead_tags').insert({ lead_id: leadId, tag_id: tagId })
    if (error) {
      onTagsChange(previous)
      showToast('Could not add tag.', 'error')
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium text-uchb-teal">Tags</p>
      <div className="flex flex-wrap items-center gap-2">
        {currentTags.map((t) => (
          <span
            key={t.id}
            className="flex items-center gap-1.5 rounded-full bg-uchb-teal/10 px-3 py-1 text-xs font-medium text-uchb-teal"
          >
            {t.label}
            <button
              type="button"
              onClick={() => removeTag(t.id)}
              aria-label={`Remove ${t.label} tag`}
              className="text-uchb-teal/50"
            >
              ×
            </button>
          </span>
        ))}
        {currentTags.length === 0 && !adding && <span className="text-sm text-uchb-teal/40">No tags yet</span>}
        {availableTags.length > 0 &&
          (adding ? (
            <select
              autoFocus
              defaultValue=""
              onChange={(e) => addTag(e.target.value)}
              onBlur={() => setAdding(false)}
              className="rounded-full border border-uchb-teal/20 px-2 py-1 text-xs text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
            >
              <option value="" disabled>
                Add tag…
              </option>
              {availableTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full border border-dashed border-uchb-teal/30 px-3 py-1 text-xs font-medium text-uchb-teal/60"
            >
              + Add tag
            </button>
          ))}
      </div>
    </section>
  )
}

const ENRICHMENT_TYPES = [
  { key: 'property_lookup', label: 'Owner & Tax Info' },
  { key: 'value_estimate', label: 'Value Estimate' },
  { key: 'rent_estimate', label: 'Rent Estimate' },
  { key: 'skip_trace', label: 'Skip Trace' },
]

function EnrichmentSummary({ type, summary }) {
  if (!summary) return null

  if (type === 'property_lookup') {
    return (
      <div className="space-y-1 text-sm text-uchb-teal">
        {summary.owner && (
          <p>
            <span className="text-uchb-teal/60">Owner:</span> {summary.owner}
            {summary.ownerType ? ` (${summary.ownerType})` : ''}
          </p>
        )}
        {summary.ownerOccupied !== null && summary.ownerOccupied !== undefined && (
          <p>
            <span className="text-uchb-teal/60">Owner occupied:</span> {summary.ownerOccupied ? 'Yes' : 'No — absentee'}
          </p>
        )}
        {summary.ownerMailingAddress && (
          <p>
            <span className="text-uchb-teal/60">Mailing address:</span> {summary.ownerMailingAddress}
          </p>
        )}
        {summary.county && (
          <p>
            <span className="text-uchb-teal/60">County:</span> {summary.county}
          </p>
        )}
        {summary.latestTaxAssessment?.value != null && (
          <p>
            <span className="text-uchb-teal/60">Tax assessed value:</span> {fmtCurrency(summary.latestTaxAssessment.value)}
          </p>
        )}
        {summary.latestPropertyTax?.total != null && (
          <p>
            <span className="text-uchb-teal/60">Annual property tax:</span> {fmtCurrency(summary.latestPropertyTax.total)}
          </p>
        )}
      </div>
    )
  }

  if (type === 'value_estimate' || type === 'rent_estimate') {
    const amount = type === 'value_estimate' ? summary.estimatedValue : summary.estimatedRent
    return (
      <div className="space-y-1 text-sm text-uchb-teal">
        {amount != null && (
          <p className="text-lg font-semibold">
            {fmtCurrency(amount)}
            {type === 'rent_estimate' ? '/mo' : ''}
          </p>
        )}
        {(summary.low != null || summary.high != null) && (
          <p className="text-uchb-teal/60">
            Range: {fmtCurrency(summary.low)} – {fmtCurrency(summary.high)}
          </p>
        )}
        {summary.comparableCount > 0 && (
          <p className="text-xs text-uchb-teal/50">Based on {summary.comparableCount} comparables</p>
        )}
      </div>
    )
  }

  if (type === 'skip_trace') {
    return (
      <div className="space-y-3 text-sm text-uchb-teal">
        {(summary.people || []).map((person, i) => (
          <div key={i} className={i > 0 ? 'border-t border-uchb-teal/10 pt-2' : ''}>
            <div className="flex flex-wrap items-center gap-1.5">
              {person.name && <p className="font-medium">{person.name}</p>}
              {person.deceased && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  Deceased
                </span>
              )}
              {person.litigator && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  Known TCPA litigator — do not call
                </span>
              )}
            </div>
            {(person.phones || []).map((p, j) => (
              <p key={j} className="mt-1 flex items-center gap-2">
                <a href={`tel:${p.number}`} className="underline">
                  {fmtPhone(p.number)}
                </a>
                {p.type && <span className="text-xs text-uchb-teal/50">{p.type}</span>}
                {p.dnc && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">DNC</span>
                )}
              </p>
            ))}
            {(person.emails || []).map((email, j) => (
              <p key={j} className="mt-1">
                <a href={`mailto:${email}`} className="underline">
                  {email}
                </a>
              </p>
            ))}
            {person.mailingAddress && <p className="mt-1 text-uchb-teal/60">{person.mailingAddress}</p>}
          </div>
        ))}
      </div>
    )
  }

  return null
}

function ResearchSection({ leadId, enrichments, onPulled, authorsById }) {
  const { showToast } = useToast()
  const [pulling, setPulling] = useState(null)
  const [cooldown, setCooldown] = useState({})

  async function pull(type) {
    setPulling(type)
    const { data, error } = await supabase.functions.invoke('lead-enrichment', { body: { action: type, leadId } })
    setPulling(null)

    if (error || data?.error) {
      showToast(data?.error || error?.message || 'Lookup failed.', 'error')
      return
    }

    showToast(data.status === 'no_match' ? 'No match found.' : 'Pulled.')
    onPulled(type, { status: data.status, summary: data.summary, created_at: new Date().toISOString() })

    setCooldown((prev) => ({ ...prev, [type]: true }))
    setTimeout(() => setCooldown((prev) => ({ ...prev, [type]: false })), 30000)
  }

  const ownerSummary = enrichments.property_lookup?.summary?.owner

  return (
    <CollapsibleSection title="Research" summary={ownerSummary ? `Owner: ${ownerSummary}` : null}>
      <div className="space-y-3">
        {ENRICHMENT_TYPES.map(({ key, label }) => {
          const record = enrichments[key]
          const isPulling = pulling === key
          const onCooldown = cooldown[key]

          return (
            <div key={key} className="rounded-xl bg-uchb-cream/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-uchb-teal">{label}</p>
                <button
                  type="button"
                  onClick={() => pull(key)}
                  disabled={isPulling || onCooldown}
                  className="rounded-lg bg-uchb-teal px-3 py-1.5 text-xs font-medium text-uchb-cream disabled:opacity-50"
                >
                  {isPulling ? 'Pulling…' : record ? 'Refresh' : 'Pull'}
                </button>
              </div>
              {record && (
                <div className="mt-2 border-t border-uchb-teal/10 pt-2">
                  <p className="mb-1 text-xs text-uchb-teal/50">
                    {record.status === 'no_match'
                      ? 'No match'
                      : record.status === 'error'
                        ? 'Lookup failed'
                        : `Pulled ${fmtDate(record.created_at)}${
                            record.requested_by ? ` by ${authorsById[record.requested_by] || 'someone'}` : ''
                          }`}
                  </p>
                  <EnrichmentSummary type={key} summary={record.summary} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}

function ArchiveSection({ leadId, authorId, navigate }) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [archiving, setArchiving] = useState(false)

  async function handleArchive() {
    setArchiving(true)
    const { error } = await supabase
      .from('leads')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', leadId)

    if (error) {
      setArchiving(false)
      showToast('Could not archive lead.', 'error')
      return
    }

    await supabase.from('lead_activity').insert({
      lead_id: leadId,
      author_id: authorId,
      type: 'note',
      body: 'Lead archived.',
    })

    showToast('Lead archived.')
    navigate('/leads')
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600"
        >
          Archive lead
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-sm text-uchb-teal/70">
            Archive this lead? It'll be hidden from lists but not deleted.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {archiving ? 'Archiving…' : 'Yes, archive'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl border border-uchb-teal/20 py-2.5 text-sm font-medium text-uchb-teal"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function tempClasses(temp, active) {
  if (!active) return 'bg-white text-uchb-teal/60 border border-uchb-teal/20'
  if (temp === 'Hot') return 'bg-uchb-gold text-uchb-teal border border-uchb-gold'
  if (temp === 'Warm') return 'bg-uchb-teal text-uchb-cream border border-uchb-teal'
  return 'bg-gray-300 text-gray-700 border border-gray-300'
}

const ACTIVITY_TYPES = ['call', 'text', 'note', 'offer']

function notifyIfHotOrUnderContract(previousLead, fields, stagesList) {
  const underContractId = stagesList.find((s) => s.label === 'Under Contract')?.id

  if (fields.temperature === 'Hot' && previousLead.temperature !== 'Hot') {
    supabase.functions.invoke('stage-notify', { body: { leadId: previousLead.id, type: 'hot' } }).catch(() => {})
  }

  if (underContractId && fields.stage === underContractId && previousLead.stage !== underContractId) {
    supabase.functions
      .invoke('stage-notify', { body: { leadId: previousLead.id, type: 'under_contract' } })
      .catch(() => {})
  }
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { showToast } = useToast()

  const [lead, setLead] = useState(null)
  const [stages, setStages] = useState([])
  const [sourcesById, setSourcesById] = useState({})
  const [sources, setSources] = useState([])
  const [activities, setActivities] = useState([])
  const [authorsById, setAuthorsById] = useState({})
  const [admins, setAdmins] = useState([])
  const [allTags, setAllTags] = useState([])
  const [leadTagIds, setLeadTagIds] = useState([])
  const [enrichments, setEnrichments] = useState({})
  const [loading, setLoading] = useState(true)

  const [activityType, setActivityType] = useState('call')
  const [activityBody, setActivityBody] = useState('')
  const [loggingActivity, setLoggingActivity] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [leadRes, stagesRes, sourcesRes, activitiesRes, profilesRes, tagsRes, leadTagsRes, enrichmentsRes] =
        await Promise.all([
          supabase.from('leads').select('*').eq('id', id).single(),
          supabase.from('stages').select('id, label, sort_order, is_terminal, color').order('sort_order'),
          supabase.from('sources').select('id, label, direction').order('label'),
          supabase.from('lead_activity').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
          supabase.from('profiles').select('id, full_name, email, role'),
          supabase.from('tags').select('id, label').order('label'),
          supabase.from('lead_tags').select('tag_id').eq('lead_id', id),
          supabase
            .from('lead_enrichments')
            .select('type, status, summary, created_at, requested_by')
            .eq('lead_id', id)
            .order('created_at', { ascending: false }),
        ])

      if (!active) return

      setLead(leadRes.data || null)
      setStages(arr(stagesRes.data))

      const srcMap = {}
      for (const s of arr(sourcesRes.data)) srcMap[s.id] = s
      setSourcesById(srcMap)
      setSources(arr(sourcesRes.data))

      const authMap = {}
      for (const p of arr(profilesRes.data)) authMap[p.id] = p.full_name || p.email
      setAuthorsById(authMap)
      setAdmins(arr(profilesRes.data).filter((p) => p.role === 'admin' || p.role === 'member'))

      setActivities(arr(activitiesRes.data))
      setAllTags(arr(tagsRes.data))
      setLeadTagIds(arr(leadTagsRes.data).map((r) => r.tag_id))

      const latestByType = {}
      for (const row of arr(enrichmentsRes.data)) {
        if (!latestByType[row.type]) latestByType[row.type] = row
      }
      setEnrichments(latestByType)

      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [id])

  async function patchLead(fields, successMessage) {
    const previous = lead
    setLead((prev) => ({ ...prev, ...fields }))

    const { error } = await supabase.from('leads').update(fields).eq('id', id)

    if (error) {
      setLead(previous)
      showToast('Update failed, reverted.', 'error')
      return
    }

    // Fire-and-forget: don't block the success toast on this resolving.
    notifyIfHotOrUnderContract(previous, fields, stages)

    if (successMessage) showToast(successMessage)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('Link copied.')
    } catch {
      showToast('Could not copy link.', 'error')
    }
  }

  async function handleActivitySubmit(e) {
    e.preventDefault()
    const body = safeStr(activityBody).trim()
    if (!body) return

    setLoggingActivity(true)
    const tempId = `temp-${Date.now()}`
    const optimisticRow = {
      id: tempId,
      lead_id: id,
      author_id: session?.user?.id,
      type: activityType,
      body,
      created_at: new Date().toISOString(),
      _pending: true,
    }
    setActivities((prev) => [optimisticRow, ...prev])
    setActivityBody('')

    const { data: inserted, error } = await supabase
      .from('lead_activity')
      .insert({
        lead_id: id,
        author_id: session?.user?.id,
        type: activityType,
        body,
      })
      .select()
      .single()

    setLoggingActivity(false)

    if (error || !inserted) {
      setActivities((prev) => prev.filter((a) => a.id !== tempId))
      showToast('Could not log activity.', 'error')
      return
    }

    setActivities((prev) => prev.map((a) => (a.id === tempId ? inserted : a)))
    showToast('Activity logged.')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-uchb-cream">
        <header className="bg-uchb-teal px-6 py-4">
          <Link to="/leads" className="text-uchb-cream/70 text-sm">
            &larr; Leads
          </Link>
        </header>
        <main className="space-y-4 px-4 py-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-uchb-cream">
        <header className="bg-uchb-teal px-6 py-4">
          <Link to="/leads" className="text-uchb-cream/70 text-sm">
            &larr; Leads
          </Link>
        </header>
        <main className="px-4 py-16 text-center">
          <p className="text-uchb-teal">Lead not found.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-uchb-cream">
      <header className="bg-uchb-teal px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/leads" className="text-uchb-cream/70 text-sm">
            &larr; Leads
          </Link>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg bg-uchb-cream/10 px-2.5 py-1.5 text-xs font-medium text-uchb-cream"
          >
            Copy link
          </button>
        </div>
        <h1 className="text-uchb-cream text-lg font-semibold">{safeStr(lead.name) || 'Unnamed lead'}</h1>
      </header>

      <main className="space-y-4 px-4 py-6 pb-10">
        <ContactSection lead={lead} sourcesById={sourcesById} sources={sources} patchLead={patchLead} />

        <TagsSection leadId={id} allTags={allTags} leadTagIds={leadTagIds} onTagsChange={setLeadTagIds} />

        <ResearchSection
          leadId={id}
          enrichments={enrichments}
          authorsById={authorsById}
          onPulled={(type, record) =>
            setEnrichments((prev) => ({ ...prev, [type]: { ...record, requested_by: session?.user?.id } }))
          }
        />

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Stage</label>
            <select
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              value={lead.stage || ''}
              onChange={(e) => patchLead({ stage: e.target.value }, 'Stage updated.')}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Assigned to</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => patchLead({ assigned_to: null }, 'Unassigned.')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
                  !lead.assigned_to
                    ? 'bg-uchb-teal text-uchb-cream'
                    : 'border border-uchb-teal/20 text-uchb-teal/60'
                }`}
              >
                Unassigned
              </button>
              {admins.map((a) => {
                const label = a.full_name || a.email
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => patchLead({ assigned_to: a.id }, `Assigned to ${label}.`)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${
                      lead.assigned_to === a.id
                        ? 'bg-uchb-teal text-uchb-cream'
                        : 'border border-uchb-teal/20 text-uchb-teal/60'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Temperature</label>
            <div className="flex gap-2">
              {['Hot', 'Warm', 'Cold'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patchLead({ temperature: t }, 'Temperature updated.')}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium ${tempClasses(t, lead.temperature === t)}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-uchb-teal">Next follow-up</label>
            <input
              type="date"
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              value={lead.next_follow_up || ''}
              onChange={(e) => patchLead({ next_follow_up: e.target.value || null }, 'Follow-up date updated.')}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-uchb-teal">Log activity</p>
          <form onSubmit={handleActivitySubmit} className="space-y-2">
            <div className="flex gap-2">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityType(t)}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium capitalize ${
                    activityType === t
                      ? 'bg-uchb-teal text-uchb-cream'
                      : 'border border-uchb-teal/20 text-uchb-teal/60'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              className="w-full rounded-xl border border-uchb-teal/20 px-4 py-3 text-base text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              rows={2}
              value={activityBody}
              onChange={(e) => setActivityBody(e.target.value)}
              placeholder="What happened?"
            />
            <button
              type="submit"
              disabled={loggingActivity || !activityBody.trim()}
              className="w-full rounded-xl bg-uchb-teal py-3 font-medium text-uchb-cream disabled:opacity-60"
            >
              Log activity
            </button>
          </form>

          <div className="space-y-3 pt-2">
            {activities.length === 0 && (
              <p className="text-uchb-teal/60 text-sm">No activity logged yet.</p>
            )}
            {activities.map((a) => (
              <div key={a.id} className={`border-l-2 border-uchb-teal/20 pl-3 ${a._pending ? 'opacity-50' : ''}`}>
                <p className="text-xs font-medium text-uchb-teal/60">
                  <span className="capitalize">{a.type}</span> &middot;{' '}
                  {a.author_id ? authorsById[a.author_id] || 'Unknown' : 'Hermes (automated)'} &middot;{' '}
                  {fmtDate(a.created_at)}
                </p>
                <p className="text-uchb-teal text-sm">{a.body}</p>
              </div>
            ))}
          </div>
        </section>

        <OwnershipSection lead={lead} patchLead={patchLead} />
        <UnderwritingSection lead={lead} patchLead={patchLead} />
        <ArchiveSection leadId={id} authorId={session?.user?.id} navigate={navigate} />
      </main>
    </div>
  )
}
