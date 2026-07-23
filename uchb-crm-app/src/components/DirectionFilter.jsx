function pillClasses(active) {
  return active
    ? 'bg-uchb-teal text-uchb-cream'
    : 'border border-uchb-teal/15 bg-white text-uchb-teal/60'
}

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

export default function DirectionFilter({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${pillClasses(value === o.value)}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
