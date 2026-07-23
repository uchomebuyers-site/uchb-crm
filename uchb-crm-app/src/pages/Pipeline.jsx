import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { supabase } from '../lib/supabase'
import AppHeader from '../components/AppHeader'
import Skeleton from '../components/Skeleton'
import OwnerChip from '../components/OwnerChip'
import OwnerFilter from '../components/OwnerFilter'
import TagFilter from '../components/TagFilter'
import TagChips from '../components/TagChips'
import DirectionFilter from '../components/DirectionFilter'

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

const STAGE_COLORS = {
  teal: { solid: 'bg-uchb-teal text-uchb-cream', outline: 'border-uchb-teal text-uchb-teal' },
  gold: { solid: 'bg-uchb-gold text-uchb-teal', outline: 'border-uchb-gold text-uchb-gold' },
  green: { solid: 'bg-green-600 text-white', outline: 'border-green-600 text-green-700' },
  gray: { solid: 'bg-gray-400 text-white', outline: 'border-gray-400 text-gray-600' },
}

function stageHeaderClasses(colorKey, isTerminal) {
  const c = STAGE_COLORS[colorKey] || STAGE_COLORS.gray
  return isTerminal ? `bg-white border-2 ${c.outline}` : c.solid
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return null
  const diff = Date.now() - then
  return Math.max(0, Math.floor(diff / 86400000))
}

function CardBody({ lead, daysAgo, ownerName, tags }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-uchb-teal text-sm font-semibold">{safeStr(lead.name) || 'Unnamed lead'}</p>
        <OwnerChip name={ownerName} />
      </div>
      <p className="mt-0.5 text-xs text-uchb-teal/70">{safeStr(lead.property_address) || 'No address'}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {lead.temperature && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tempClasses(lead.temperature)}`}>
            {lead.temperature}
          </span>
        )}
        {daysAgo !== null && (
          <span className="rounded-full bg-uchb-teal/5 px-2 py-0.5 text-[11px] font-medium text-uchb-teal/60">
            {daysAgo === 0 ? 'Today' : `${daysAgo}d`}
          </span>
        )}
      </div>
      {tags && tags.length > 0 && (
        <div className="mt-1.5">
          <TagChips tags={tags} max={2} />
        </div>
      )}
    </>
  )
}

function LeadCard({ lead, daysAgo, justDropped, ownerName, tags }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none relative rounded-2xl bg-white p-3 pr-8 shadow-sm transition-all duration-300 ${
        isDragging ? 'opacity-30' : ''
      } ${justDropped ? 'scale-105 shadow-xl' : ''}`}
    >
      <CardBody lead={lead} daysAgo={daysAgo} ownerName={ownerName} tags={tags} />
      <button
        type="button"
        aria-label="Open lead"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/leads/${lead.id}`)
        }}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-uchb-teal/50 active:bg-uchb-teal/10"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.92 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  )
}

function Column({ stage, leads, lastChangeById, justDroppedId, adminsById, tagsByLead }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      className={`flex w-[85vw] flex-shrink-0 snap-center flex-col rounded-2xl bg-uchb-cream sm:w-72 ${
        isOver ? 'ring-2 ring-uchb-gold' : ''
      }`}
    >
      <div className={`rounded-t-2xl px-4 py-3 ${stageHeaderClasses(stage.color, stage.is_terminal)}`}>
        <p className="font-semibold">{stage.label}</p>
        <p className="text-xs opacity-80">
          {leads.length} lead{leads.length === 1 ? '' : 's'}
        </p>
      </div>
      <div ref={setNodeRef} className="min-h-[200px] flex-1 space-y-2 rounded-b-2xl bg-uchb-teal/5 p-2">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            daysAgo={daysSince(lastChangeById[lead.id])}
            justDropped={justDroppedId === lead.id}
            ownerName={adminsById[lead.assigned_to]}
            tags={tagsByLead[lead.id]}
          />
        ))}
        {leads.length === 0 && <p className="px-2 py-4 text-center text-xs text-uchb-teal/40">No leads</p>}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [stages, setStages] = useState([])
  const [leads, setLeads] = useState([])
  const [lastChangeById, setLastChangeById] = useState({})
  const [admins, setAdmins] = useState([])
  const [tags, setTags] = useState([])
  const [tagsByLead, setTagsByLead] = useState({})
  const [sources, setSources] = useState([])
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(new Set())
  const [directionFilter, setDirectionFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [justDroppedId, setJustDroppedId] = useState(null)
  const justDroppedTimer = useRef(null)
  const scrollContainerRef = useRef(null)
  const pointerXRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, leadsRes, historyRes, adminsRes, tagsRes, leadTagsRes, sourcesRes] = await Promise.all([
        supabase.from('stages').select('id, label, sort_order, is_terminal, color').order('sort_order'),
        supabase
          .from('leads')
          .select('id, name, property_address, phone, temperature, stage, assigned_to, source, created_at')
          .is('archived_at', null),
        supabase.from('lead_status_history').select('lead_id, created_at').order('created_at', { ascending: false }),
        // 'admin' and 'member' are both real team members who can be assigned leads.
        supabase.from('profiles').select('id, full_name, email').in('role', ['admin', 'member']),
        supabase.from('tags').select('id, label').order('label'),
        supabase.from('lead_tags').select('lead_id, tag_id'),
        supabase.from('sources').select('id, label, direction').order('label'),
      ])

      if (!active) return

      setStages(arr(stagesRes.data))
      setLeads(arr(leadsRes.data))
      setAdmins(arr(adminsRes.data))
      setTags(arr(tagsRes.data))
      setSources(arr(sourcesRes.data))

      const tagById = {}
      for (const t of arr(tagsRes.data)) tagById[t.id] = t
      const tagsMap = {}
      for (const row of arr(leadTagsRes.data)) {
        const tag = tagById[row.tag_id]
        if (!tag) continue
        if (!tagsMap[row.lead_id]) tagsMap[row.lead_id] = []
        tagsMap[row.lead_id].push(tag)
      }
      setTagsByLead(tagsMap)

      const changeMap = {}
      for (const row of arr(historyRes.data)) {
        if (!changeMap[row.lead_id]) changeMap[row.lead_id] = row.created_at
      }
      for (const lead of arr(leadsRes.data)) {
        if (!changeMap[lead.id]) changeMap[lead.id] = lead.created_at
      }
      setLastChangeById(changeMap)
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('pipeline-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (payload.new.archived_at) return
          setLeads((prev) => (prev.some((l) => l.id === payload.new.id) ? prev : [...prev, payload.new]))
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.archived_at) {
            setLeads((prev) => prev.filter((l) => l.id !== payload.new.id))
            return
          }
          setLeads((prev) => prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l)))
        } else if (payload.eventType === 'DELETE') {
          setLeads((prev) => prev.filter((l) => l.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveId(null)
      if (!over) return

      const leadId = active.id
      const newStageId = over.id
      const lead = leads.find((l) => l.id === leadId)
      if (!lead || lead.stage === newStageId) return

      const previousStage = lead.stage
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStageId } : l)))
      setJustDroppedId(leadId)
      clearTimeout(justDroppedTimer.current)
      justDroppedTimer.current = setTimeout(() => setJustDroppedId(null), 400)

      supabase
        .from('leads')
        .update({ stage: newStageId })
        .eq('id', leadId)
        .then(({ error }) => {
          if (error) {
            setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: previousStage } : l)))
            return
          }

          const underContractId = stages.find((s) => s.label === 'Under Contract')?.id
          if (underContractId && newStageId === underContractId) {
            // Fire-and-forget: optimistic UI already showed success.
            supabase.functions.invoke('stage-notify', { body: { leadId, type: 'under_contract' } }).catch(() => {})
          }
        })
    },
    [leads, stages],
  )

  useEffect(() => {
    if (!activeId) return

    const EDGE = 40
    const SPEED = 12

    function handlePointerMove(e) {
      const point = e.touches ? e.touches[0] : e
      if (point) pointerXRef.current = point.clientX
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('touchmove', handlePointerMove, { passive: true })

    let rafId
    function tick() {
      const container = scrollContainerRef.current
      const x = pointerXRef.current
      if (container && x != null) {
        const rect = container.getBoundingClientRect()
        if (x - rect.left < EDGE) {
          container.scrollLeft -= SPEED
        } else if (rect.right - x < EDGE) {
          container.scrollLeft += SPEED
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('touchmove', handlePointerMove)
      cancelAnimationFrame(rafId)
      pointerXRef.current = null
    }
  }, [activeId])

  const activeLead = leads.find((l) => l.id === activeId)

  const adminsById = {}
  for (const a of admins) adminsById[a.id] = a.full_name || a.email

  const sourcesById = {}
  for (const s of sources) sourcesById[s.id] = s
  const sourcesForDirection = sources.filter((s) => directionFilter === 'all' || s.direction === directionFilter)

  const searchTerm = search.trim().toLowerCase()
  const visibleLeads = leads.filter((l) => {
    if (ownerFilter !== 'all' && l.assigned_to !== ownerFilter) return false
    if (tagFilter.size > 0) {
      const leadTagIds = (tagsByLead[l.id] || []).map((t) => t.id)
      if (!leadTagIds.some((id) => tagFilter.has(id))) return false
    }
    if (directionFilter !== 'all' && sourcesById[l.source]?.direction !== directionFilter) return false
    if (sourceFilter.size > 0 && !sourceFilter.has(l.source)) return false
    if (!searchTerm) return true
    return (
      safeStr(l.name).toLowerCase().includes(searchTerm) ||
      safeStr(l.property_address).toLowerCase().includes(searchTerm) ||
      safeStr(l.phone).toLowerCase().includes(searchTerm)
    )
  })

  const filtersActive =
    ownerFilter !== 'all' || tagFilter.size > 0 || directionFilter !== 'all' || sourceFilter.size > 0 || searchTerm !== ''

  function clearFilters() {
    setOwnerFilter('all')
    setTagFilter(new Set())
    setDirectionFilter('all')
    setSourceFilter(new Set())
    setSearch('')
  }

  function changeDirection(next) {
    setDirectionFilter(next)
    setSourceFilter(new Set())
  }

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Pipeline" />

      <main className="px-2 py-4">
        {!loading && (
          <div className="mb-3 space-y-2 px-2">
            <div className="flex items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, address, phone…"
                className="w-full max-w-xs rounded-xl border border-uchb-teal/20 bg-white px-4 py-2.5 text-sm text-uchb-teal focus:outline-none focus:ring-2 focus:ring-uchb-gold"
              />
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="text-sm text-uchb-teal/60 underline">
                  Clear filters
                </button>
              )}
            </div>
            {admins.length > 0 && <OwnerFilter admins={admins} value={ownerFilter} onChange={setOwnerFilter} />}
            {tags.length > 0 && <TagFilter tags={tags} value={tagFilter} onChange={setTagFilter} />}
            {sources.length > 0 && <DirectionFilter value={directionFilter} onChange={changeDirection} />}
            {directionFilter !== 'all' && sourcesForDirection.length > 0 && (
              <TagFilter tags={sourcesForDirection} value={sourceFilter} onChange={setSourceFilter} />
            )}
          </div>
        )}

        {loading ? (
          <div className="flex gap-3 px-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-[85vw] flex-shrink-0 sm:w-72">
                <Skeleton className="h-14 w-full rounded-t-2xl" />
                <div className="space-y-2 rounded-b-2xl bg-uchb-teal/5 p-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} autoScroll={false} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div ref={scrollContainerRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-4">
              {stages.map((stage) => (
                <Column
                  key={stage.id}
                  stage={stage}
                  leads={visibleLeads.filter((l) => l.stage === stage.id)}
                  lastChangeById={lastChangeById}
                  justDroppedId={justDroppedId}
                  adminsById={adminsById}
                  tagsByLead={tagsByLead}
                />
              ))}
            </div>
            <DragOverlay>
              {activeLead ? (
                <div className="w-[80vw] rounded-2xl bg-white p-3 shadow-xl sm:w-64">
                  <CardBody
                    lead={activeLead}
                    daysAgo={daysSince(lastChangeById[activeLead.id])}
                    ownerName={adminsById[activeLead.assigned_to]}
                    tags={tagsByLead[activeLead.id]}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  )
}
