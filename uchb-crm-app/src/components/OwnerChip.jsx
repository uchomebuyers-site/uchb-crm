function initials(name) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function OwnerChip({ name }) {
  if (!name) return null

  return (
    <span
      title={name}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-uchb-teal/10 text-[10px] font-semibold text-uchb-teal/60"
    >
      {initials(name)}
    </span>
  )
}
