function pillClasses(active) {
  return active
    ? 'bg-uchb-teal text-uchb-cream'
    : 'border border-uchb-teal/15 bg-white text-uchb-teal/60'
}

export default function OwnerFilter({ admins, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${pillClasses(value === 'all')}`}
      >
        All
      </button>
      {admins.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${pillClasses(value === a.id)}`}
        >
          {a.full_name || a.email}
        </button>
      ))}
    </div>
  )
}
