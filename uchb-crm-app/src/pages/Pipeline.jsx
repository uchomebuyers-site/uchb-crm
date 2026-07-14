import { useCallback, useEffect, useRef, useState } from 'react'
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

function CardBody({ lead, daysAgo }) {
  return (
    <>
      <p className="text-uchb-teal text-sm font-semibold">{safeStr(lead.name) || 'Unnamed lead'}</p>
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
    </>
  )
}

function LeadCard({ lead, daysAgo, justDropped }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none rounded-2xl bg-white p-3 shadow-sm transition-all duration-300 ${
        isDragging ? 'opacity-30' : ''
      } ${justDropped ? 'scale-105 shadow-xl' : ''}`}
    >
      <CardBody lead={lead} daysAgo={daysAgo} />
    </div>
  )
}

function Column({ stage, leads, lastChangeById, justDroppedId }) {
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
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [justDroppedId, setJustDroppedId] = useState(null)
  const justDroppedTimer = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  useEffect(() => {
    let active = true

    async function load() {
      const [stagesRes, leadsRes, historyRes] = await Promise.all([
        supabase.from('stages').select('id, label, sort_order, is_terminal, color').order('sort_order'),
        supabase.from('leads').select('id, name, property_address, temperature, stage, created_at'),
        supabase.from('lead_status_history').select('lead_id, created_at').order('created_at', { ascending: false }),
      ])

      if (!active) return

      setStages(arr(stagesRes.data))
      setLeads(arr(leadsRes.data))

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
          setLeads((prev) => (prev.some((l) => l.id === payload.new.id) ? prev : [...prev, payload.new]))
        } else if (payload.eventType === 'UPDATE') {
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

  const activeLead = leads.find((l) => l.id === activeId)

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Pipeline" />

      <main className="px-2 py-4">
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
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-4">
              {stages.map((stage) => (
                <Column
                  key={stage.id}
                  stage={stage}
                  leads={leads.filter((l) => l.stage === stage.id)}
                  lastChangeById={lastChangeById}
                  justDroppedId={justDroppedId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeLead ? (
                <div className="w-[80vw] rounded-2xl bg-white p-3 shadow-xl sm:w-64">
                  <CardBody lead={activeLead} daysAgo={daysSince(lastChangeById[activeLead.id])} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>
    </div>
  )
}
