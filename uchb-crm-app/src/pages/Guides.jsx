import { Link } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { CALL_GUIDES } from '../content/callGuides'

export default function Guides() {
  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Call Guides" />

      <main className="space-y-3 px-4 py-6 pb-10">
        <p className="text-sm text-uchb-teal/70">
          Quick reference for seller calls — scripts, discovery questions, and what to log afterward. Pick a guide and
          keep it open next to you while you call.
        </p>

        {CALL_GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            to={`/guides/${guide.slug}`}
            className="block rounded-2xl bg-white p-4 shadow-sm active:bg-uchb-cream"
          >
            <p className="font-semibold text-uchb-teal">{guide.label}</p>
            <p className="mt-0.5 text-sm text-uchb-teal/70">{guide.description}</p>
          </Link>
        ))}
      </main>
    </div>
  )
}
