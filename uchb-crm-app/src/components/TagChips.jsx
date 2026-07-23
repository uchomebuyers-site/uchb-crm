export default function TagChips({ tags, max = 3 }) {
  if (!tags || tags.length === 0) return null

  const shown = tags.slice(0, max)
  const overflow = tags.length - shown.length

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((t) => (
        <span
          key={t.id}
          className="rounded-full bg-uchb-teal/10 px-2 py-0.5 text-[11px] font-medium text-uchb-teal/80"
        >
          {t.label}
        </span>
      ))}
      {overflow > 0 && (
        <span className="rounded-full bg-uchb-teal/5 px-2 py-0.5 text-[11px] font-medium text-uchb-teal/50">
          +{overflow}
        </span>
      )}
    </div>
  )
}
