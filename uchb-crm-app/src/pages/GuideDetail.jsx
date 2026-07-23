import { Link, useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { useToast } from '../hooks/useToast'
import { getGuideBySlug } from '../content/callGuides'

const NAV_SECTIONS = [
  { id: 'script', label: 'Script' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'text', label: 'Text' },
  { id: 'outline', label: 'Outline' },
  { id: 'questions', label: 'Questions' },
  { id: 'log', label: 'Log' },
]

function jumpTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function useCopy() {
  const { showToast } = useToast()
  return async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label} copied.`)
    } catch {
      showToast('Could not copy.', 'error')
    }
  }
}

function StickyNav() {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-uchb-teal/10 bg-uchb-cream/95 px-4 py-2.5 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto">
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(s.id)}
            className="shrink-0 rounded-full border border-uchb-teal/15 bg-white px-3.5 py-1.5 text-sm font-medium text-uchb-teal active:bg-uchb-cream"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-16 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-uchb-teal">{title}</h2>
      <div className="space-y-3 text-base leading-relaxed text-uchb-teal">{children}</div>
    </section>
  )
}

function Quote({ children }) {
  return (
    <blockquote className="rounded-xl border-l-4 border-uchb-gold bg-uchb-cream/60 px-4 py-3 text-base italic leading-relaxed text-uchb-teal">
      &ldquo;{children}&rdquo;
    </blockquote>
  )
}

function Note({ children }) {
  return <p className="text-sm text-uchb-teal/60">{children}</p>
}

function CopyBlock({ text, label }) {
  const copy = useCopy()
  return (
    <div className="space-y-2">
      <pre className="whitespace-pre-wrap rounded-xl bg-uchb-cream/60 p-3 font-mono text-sm leading-relaxed text-uchb-teal">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => copy(text, label)}
        className="rounded-lg bg-uchb-teal/5 px-3 py-1.5 text-sm font-medium text-uchb-teal"
      >
        Copy {label.toLowerCase()}
      </button>
    </div>
  )
}

export default function GuideDetail() {
  const { slug } = useParams()
  const guide = getGuideBySlug(slug)

  if (!guide) {
    return (
      <div className="min-h-screen bg-uchb-cream">
        <AppHeader title="Call Guides" />
        <main className="px-4 py-16 text-center">
          <p className="text-uchb-teal">Guide not found.</p>
          <Link to="/guides" className="mt-2 inline-block text-sm text-uchb-teal underline">
            &larr; Back to Call Guides
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title={`${guide.label} Call Guide`} />

      <main className="px-4 py-4 pb-10">
        <StickyNav />

        <div className="space-y-4">
          <Section id="script" title="The Script">
            <p className="font-medium text-uchb-teal">Opener</p>
            <Quote>{guide.script.opener}</Quote>

            <p className="font-medium text-uchb-teal">Time frame + permission</p>
            <Quote>{guide.script.timeFrame}</Quote>

            <p className="font-medium text-uchb-teal">Transition into discovery</p>
            <Quote>{guide.script.transition}</Quote>
            <Note>{guide.script.transitionNote}</Note>

            <p className="font-medium text-uchb-teal">{guide.script.optionsIntro}</p>
            <div className="space-y-3">
              {guide.script.options.map((o) => (
                <div key={o.title} className="rounded-xl border border-uchb-teal/10 p-3">
                  <p className="mb-1.5 text-sm font-semibold text-uchb-teal">{o.title}</p>
                  <Quote>{o.prompt}</Quote>
                </div>
              ))}
            </div>

            <p className="font-medium text-uchb-teal">Close (every call)</p>
            <Quote>{guide.script.close}</Quote>
          </Section>

          <Section id="voicemail" title="Voicemail Script">
            <p className="text-sm text-uchb-teal/60">Use when there's no answer.</p>
            <Quote>{guide.voicemail.script}</Quote>
            <Note>{guide.voicemail.note}</Note>
          </Section>

          <Section id="text" title="Text Template">
            <p className="text-sm text-uchb-teal/60">{guide.text.note}</p>
            <CopyBlock text={guide.text.script} label="Text" />
          </Section>

          <Section id="outline" title="Conversation Outline">
            <p className="text-sm text-uchb-teal/60">The shape of the call, start to finish.</p>
            <ol className="list-decimal space-y-2 pl-5">
              {guide.outline.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </Section>

          <Section id="questions" title="Discovery Questions">
            {guide.questionGroups.map((group) => (
              <div key={group.title} className="rounded-xl border border-uchb-teal/10 p-3">
                <p className="font-semibold text-uchb-teal">{group.title}</p>
                {group.note && <Note>{group.note}</Note>}
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  {group.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          <Section id="log" title="CRM Log — What to Record After Every Call">
            <CopyBlock text={guide.logTemplate} label="Template" />
            <Note>{guide.logNote}</Note>
          </Section>
        </div>
      </main>
    </div>
  )
}
