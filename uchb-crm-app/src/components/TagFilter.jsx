function pillClasses(active) {
  return active
    ? 'bg-uchb-teal text-uchb-cream'
    : 'border border-uchb-teal/15 bg-white text-uchb-teal/60'
}

// Multi-select, unlike OwnerFilter's single-select — a lead can carry
// several tags, and picking more than one here means "has any of these"
// (OR), which is the useful default for "show me Foreclosure or Tired
// Landlord leads."
export default function TagFilter({ tags, value, onChange }) {
  function toggle(tagId) {
    const next = new Set(value)
    if (next.has(tagId)) next.delete(tagId)
    else next.add(tagId)
    onChange(next)
  }

  if (tags.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onChange(new Set())}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${pillClasses(value.size === 0)}`}
      >
        All tags
      </button>
      {tags.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle(t.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${pillClasses(value.has(t.id))}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
