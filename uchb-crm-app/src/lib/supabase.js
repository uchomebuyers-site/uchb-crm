import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export function fmtDate(value) {
  if (!value) return ''
  // Date-only strings (e.g. "2026-07-12", like leads.next_follow_up) parse as
  // UTC midnight in `new Date()`, which can roll back a day once converted to
  // local time. Build the date from its Y/M/D parts instead so it stays put.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function fmtPhone(value) {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return value
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
