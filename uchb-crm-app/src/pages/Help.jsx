import { useState } from 'react'
import AppHeader from '../components/AppHeader'

const SECTIONS = [
  { id: 'getting-started', label: '1. Getting Started' },
  { id: 'dashboard', label: '2. Dashboard' },
  { id: 'leads', label: '3. Leads' },
  { id: 'lead-detail', label: '4. Lead Detail' },
  { id: 'pipeline', label: '5. Pipeline (Kanban)' },
  { id: 'follow-ups', label: '6. Follow-up Queue' },
  { id: 'notifications', label: '7. Notifications & Emails' },
  { id: 'user-management', label: '8. User Management (Admin)' },
  { id: 'faq', label: '9. FAQ' },
  { id: 'troubleshooting', label: '10. Troubleshooting' },
]

const NOTIFICATION_ROWS = [
  {
    trigger: 'You add a lead manually (New Lead form)',
    inApp: true,
    email: false,
    who: 'Every admin',
    when: 'Instant',
  },
  {
    trigger: 'A new Facebook lead comes in (ad webhook, once fully connected)',
    inApp: true,
    email: true,
    who: 'Every active admin',
    when: 'Instant',
  },
  {
    trigger: 'A lead is marked Hot (changed on the lead detail page — setting Hot at creation doesn’t count)',
    inApp: true,
    email: true,
    who: 'Every admin',
    when: 'Instant',
  },
  {
    trigger: 'A lead moves to Under Contract (Stage dropdown or Pipeline drag)',
    inApp: true,
    email: true,
    who: 'Every admin',
    when: 'Instant',
  },
  {
    trigger: 'Daily follow-up digest',
    inApp: false,
    email: true,
    who: 'Every admin with an email on file',
    when: '7:00 AM Central, daily',
  },
  {
    trigger: 'Someone requests a magic sign-in link',
    inApp: false,
    email: true,
    who: 'Whoever requested it',
    when: 'Instant, on request',
  },
  {
    trigger: 'An admin invites a new user',
    inApp: false,
    email: true,
    who: 'The invited person',
    when: 'Instant, when sent',
  },
]

function ChevronIcon({ expanded }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-4 w-4 shrink-0 text-uchb-teal/40 transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.92 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function jumpTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function TableOfContents() {
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-uchb-teal">Jump to a section</span>
        <ChevronIcon expanded={open} />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-1 border-t border-uchb-teal/10 px-2 py-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              className="rounded-lg px-3 py-2 text-left text-sm text-uchb-teal active:bg-uchb-cream"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function AtAGlance() {
  return (
    <section id="at-a-glance" className="rounded-2xl border-2 border-uchb-gold bg-uchb-gold/10 p-4 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-uchb-gold">Start here</p>
      <h2 className="mb-3 text-lg font-semibold text-uchb-teal">At a Glance</h2>
      <ul className="space-y-2.5 text-sm text-uchb-teal">
        <li>
          <strong>Add a lead fast:</strong> Leads tab &rarr; <strong>+ New Lead</strong> &rarr; Name, Phone, Address
          (the only required fields) &rarr; Save Lead.
        </li>
        <li>
          <strong>See what needs you today:</strong> the <strong>Follow-ups</strong> tab is your daily to-do list.
        </li>
        <li>
          <strong>Hot / Warm / Cold</strong> is a quick urgency tag: Hot = call now, Warm = interested but not
          urgent, Cold = long shot. Set it on the lead's detail page.
        </li>
        <li>
          <strong>Drag a card in Pipeline</strong> to change its stage; tap the small arrow on a card to open it
          without dragging.
        </li>
        <li>
          <strong>The bell icon</strong> (top right) is your in-app notifications &mdash; tap it, or{' '}
          <strong>Mark all read</strong> to clear it.
        </li>
        <li>
          <strong>Some things also email you instantly</strong> (Hot, Under Contract, new Facebook lead) and there's
          a <strong>7:00 AM daily digest</strong> of that day's follow-ups. Adding a lead yourself is in-app only,
          no email. Full breakdown in{' '}
          <button type="button" onClick={() => jumpTo('notifications')} className="underline">
            Notifications &amp; Emails
          </button>
          .
        </li>
        <li>
          <strong>Sign in with a magic link or a password</strong>, and add the app to your iPhone Home Screen &mdash;
          see{' '}
          <button type="button" onClick={() => jumpTo('getting-started')} className="underline">
            Getting Started
          </button>
          .
        </li>
      </ul>
    </section>
  )
}

function Card({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-uchb-teal">{title}</h2>
      <div className="space-y-3 text-sm text-uchb-teal/90">{children}</div>
    </section>
  )
}

function NotificationRow({ row }) {
  return (
    <div className="rounded-xl border border-uchb-teal/10 p-3">
      <p className="text-sm font-semibold text-uchb-teal">{row.trigger}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-uchb-teal/70">
        <p>In-app: {row.inApp ? '✅ Yes' : '❌ No'}</p>
        <p>Email: {row.email ? '✅ Yes' : '❌ No'}</p>
        <p className="col-span-2">Who: {row.who}</p>
        <p className="col-span-2">When: {row.when}</p>
      </div>
    </div>
  )
}

export default function Help() {
  return (
    <div className="min-h-screen bg-uchb-cream">
      <AppHeader title="Help" />

      <main className="space-y-4 px-4 py-6 pb-10">
        <AtAGlance />

        <TableOfContents />

        <Card id="getting-started" title="1. Getting Started">
          <p className="font-medium text-uchb-teal">Signing in</p>
          <p>
            <strong>Email me a link</strong> &mdash; type your email, tap Send magic link, open the email, tap Sign
            In. No password needed. Links expire after a while and work once, so request a fresh one if it's been
            sitting a bit.
          </p>
          <p>
            <strong>Sign in with password</strong> &mdash; type your email and password, tap Sign in. Both tabs are
            always available, not either/or.
          </p>
          <p className="font-medium text-uchb-teal">Setting a password</p>
          <p>
            Go to Dashboard &rarr; scroll to the bottom &rarr; tap <strong>Set a password</strong> &rarr; enter a new
            password (6+ characters) twice &rarr; Save password. Magic link keeps working too &mdash; this just adds
            an option.
          </p>
          <p className="font-medium text-uchb-teal">Add it to your iPhone Home Screen</p>
          <p>
            Open the CRM in <strong>Safari</strong> (must be Safari) &rarr; tap the Share icon &rarr; Add to Home
            Screen &rarr; Add. You'll get an app icon that opens full-screen, no browser bar.
          </p>
        </Card>

        <Card id="dashboard" title="2. Dashboard">
          <p>
            <strong>New leads this week</strong> &mdash; a big number counting every lead created in the last 7
            days.
          </p>
          <p>
            <strong>New leads, last 14 days</strong> &mdash; a bar chart, one bar per day, for spotting slow patches
            or spikes (like right after running an ad).
          </p>
          <p>
            <strong>Leads by stage</strong> &mdash; how many leads currently sit in each pipeline stage. Same data as
            Pipeline, just as a quick list.
          </p>
        </Card>

        <Card id="leads" title="3. Leads">
          <p className="font-medium text-uchb-teal">Adding a new lead</p>
          <p>
            Tap <strong>+ New Lead</strong> at the bottom of the screen. Only <strong>Name, Phone, and Property
            address</strong> are required. Timeline to sell, Motivation, Source, and Temperature are all optional
            and can be filled in later.
          </p>
          <p className="font-medium text-uchb-teal">The duplicate warning</p>
          <p>
            Saving checks for an existing lead with the same phone number or a matching property address
            (case-insensitive). If found, you'll see a warning with links to the match(es), plus{' '}
            <strong>This is different &mdash; save anyway</strong> or <strong>Cancel</strong>.
          </p>
          <p className="font-medium text-uchb-teal">Finding an existing lead</p>
          <p>
            There's no search bar yet. The list is newest-first; use the owner filter pills at the top to narrow it
            down, or reach a lead through Pipeline, Follow-ups, or a notification instead.
          </p>
          <p className="font-medium text-uchb-teal">Temperature chip</p>
          <p>
            Hot = ready to move, call today (also fires an instant alert to every admin when set on an existing
            lead). Warm = interested, not urgent. Cold = early or a long shot. Optional &mdash; no chip shows if it's
            not set.
          </p>
        </Card>

        <Card id="lead-detail" title="4. Lead Detail">
          <p>Tap any lead to open its detail page. Top to bottom:</p>
          <p className="font-medium text-uchb-teal">Contact info</p>
          <p>
            Phone (tap to call), address (tap for Maps), email, source, timeline, motivation, notes &mdash;
            read-only display, whichever have a value.
          </p>
          <p className="font-medium text-uchb-teal">Stage, Assigned to, Temperature, Next follow-up</p>
          <p>
            All editable, saved instantly. <strong>Stage</strong> is the same as dragging the card in Pipeline.{' '}
            <strong>Assigned to</strong> is a "who's working this" label only &mdash; both admins can always see and
            edit every lead regardless. <strong>Next follow-up</strong> is what puts a lead in the Follow-up Queue.
          </p>
          <p className="font-medium text-uchb-teal">Log activity</p>
          <p>
            Pick a type (Call / Text / Note / Offer), type what happened, tap Log activity. History shows below,
            newest first, with who logged it and when.
          </p>
          <p className="font-medium text-uchb-teal">Ownership &amp; Listing (collapsed by default)</p>
          <p>
            Owner name/phone if different from your contact, and an On the market? toggle that reveals listing
            agent name/phone/brokerage fields when switched on. Tap Save to store text field changes.
          </p>
          <p className="font-medium text-uchb-teal">Underwriting (collapsed by default)</p>
          <p>
            ARV, Asking price, Repair estimate, Target offer as plain numbers, plus links to your underwriting
            spreadsheet and Drive folder (each shows an Open button once set). Collapsed view shows a quick $
            summary. Tap Save to store changes.
          </p>
        </Card>

        <Card id="pipeline" title="5. Pipeline (Kanban)">
          <p>One column per stage &mdash; scroll sideways to see them all.</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Drag a card to a different column to change its stage. Drag near the screen edge to auto-scroll.</li>
            <li>Tap the small arrow (&rsaquo;) on a card to open the lead without dragging.</li>
            <li>Each card shows name, owner badge, address, temperature chip, and days since its last stage change.</li>
            <li>Owner filter pills at the top narrow the whole board to one person's leads, instantly.</li>
            <li>Updates from either admin show up live on both screens &mdash; no refresh needed.</li>
          </ul>
        </Card>

        <Card id="follow-ups" title="6. Follow-up Queue">
          <p>
            Shows every lead whose next follow-up date is <strong>today or earlier</strong>, excluding leads already
            in a finished stage (Closed or Dead).
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The headline tells you how many need you today, or that you're all caught up.</li>
            <li>Overdue leads get a subtle left-edge highlight, not a harsh red banner.</li>
            <li>Tap <strong>Log</strong> to log an activity right there without leaving the queue.</li>
            <li>Tap the lead's name/address to open its full detail page.</li>
            <li>Owner filter pills work here too.</li>
          </ul>
        </Card>

        <Card id="notifications" title="7. Notifications & Emails">
          <p>
            The one section worth reading closely &mdash; not knowing what triggers an email (or doesn't) is the
            most common source of confusion.
          </p>
          <div className="space-y-2">
            {NOTIFICATION_ROWS.map((row) => (
              <NotificationRow key={row.trigger} row={row} />
            ))}
          </div>
          <p className="font-medium text-uchb-teal">Worth calling out</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Manually adding a lead <strong>never sends an email</strong> &mdash; in-app notification only.</li>
            <li>The Hot alert only fires on a <strong>change</strong> &mdash; marking Hot at creation doesn't trigger it.</li>
            <li>The daily digest is <strong>email-only</strong>, it never shows up in the bell.</li>
            <li>Alert emails go to every admin regardless of active/disabled status, except the Facebook-lead alert, which only goes to active admins.</li>
          </ul>
          <p className="font-medium text-uchb-teal">What each email says</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Magic link:</strong> "Tap below to sign in to the Upper Cumberland Home Buyers CRM" + Sign In button.</li>
            <li><strong>Invite:</strong> "You've been invited to the Upper Cumberland Home Buyers CRM. Tap below to set up your account" + Accept Invite button.</li>
            <li><strong>Hot alert</strong> (subject "Hot lead alert"): "&#128293; [Name] &mdash; [Address] just turned Hot."</li>
            <li><strong>Under Contract alert</strong> (subject "Lead is Under Contract"): "[Name] &mdash; [Address] is now Under Contract."</li>
            <li><strong>New Facebook lead</strong> (subject "New Facebook lead just came in"): "New Facebook lead just came in &mdash; [Name], [Address]. Call fast." plus phone if captured.</li>
            <li><strong>Daily digest</strong> (subject like "3 follow-ups due today"): a short greeting plus a bulleted list of leads with name, address, due date.</li>
          </ul>
          <p className="font-medium text-uchb-teal">The bell icon</p>
          <p>
            Tap it for your last 50 notifications, newest first, unread ones highlighted. Tap one to jump to that
            lead (marks it read automatically). Tap <strong>Mark all read</strong> to clear the unread count. This
            list is personal &mdash; you only see your own notifications.
          </p>
        </Card>

        <Card id="user-management" title="8. User Management (Admin)">
          <p>Only admins see the Users tab.</p>
          <p className="font-medium text-uchb-teal">Inviting a new user</p>
          <p>
            Users &rarr; enter their email under Invite user &rarr; choose a role (<strong>Admin</strong> = full
            access, <strong>Pending</strong> = can sign in but stuck on an "awaiting approval" screen) &rarr; Send
            invite. They get an email with a setup link.
          </p>
          <p className="rounded-xl bg-uchb-gold/10 p-3 font-medium text-uchb-teal">
            Important: there's currently no button to promote a Pending user to Admin afterward &mdash; role can
            only be set at invite time. Fixing this later requires a direct database change. In practice, invite as
            Admin unless you specifically want someone locked out for now.
          </p>
          <p className="font-medium text-uchb-teal">Disabling / removing a user</p>
          <p>
            Each row has a Remove (or Restore) button &mdash; you can't disable your own account. Disabling signs
            them out and blocks sign-in (they'll see "Your account has been disabled") the next time their session
            is checked; nothing about their account is deleted. Restore flips them back to active immediately, no
            re-invite needed.
          </p>
          <p className="font-medium text-uchb-teal">Status badges</p>
          <p>
            Two separate badges per user: <strong>Role</strong> (admin or pending) and <strong>Status</strong>{' '}
            (active or disabled). A user can be role "pending" + status "active" &mdash; meaning they could
            technically sign in, but the app still blocks them at the door because of their role, not their status.
          </p>
        </Card>

        <Card id="faq" title="9. FAQ">
          <p className="font-medium text-uchb-teal">Why did I get signed out?</p>
          <p>Sessions expire after a while, or you followed an old expired magic link. Request a fresh one, or use your password.</p>
          <p className="font-medium text-uchb-teal">What if I forgot my password?</p>
          <p>There's no reset flow yet &mdash; use Email me a link to sign in, then set a new password from the Dashboard.</p>
          <p className="font-medium text-uchb-teal">What does "duplicate lead" mean?</p>
          <p>The system found an existing lead with the same phone or a matching address. See Leads above.</p>
          <p className="font-medium text-uchb-teal">Why can't I edit a stage or source option?</p>
          <p>Nobody can from the app right now, admin or not &mdash; those lists are fixed in the system and need a direct backend change.</p>
          <p className="font-medium text-uchb-teal">What if two of us view the same lead at once?</p>
          <p>Pipeline updates live for both of you. Lead Detail doesn't auto-refresh &mdash; last save wins per field, and the other person won't see it until they reopen the page.</p>
          <p className="font-medium text-uchb-teal">Why didn't I get an email for X?</p>
          <p>Check the Notifications section above &mdash; a lot of actions are in-app-only by design. Otherwise check spam and confirm the account has an email on file.</p>
          <p className="font-medium text-uchb-teal">Does assigning a lead restrict who can see it?</p>
          <p>No &mdash; it's a label only. Both admins always see and can edit every lead in the shared pool.</p>
        </Card>

        <Card id="troubleshooting" title="10. Troubleshooting">
          <p className="font-medium text-uchb-teal">A sign-in link doesn't work</p>
          <p>You'll see a friendly "This sign-in link has expired" screen, not a blank page. Tap Back to sign in and request a new one, or use your password.</p>
          <p className="font-medium text-uchb-teal">"Awaiting admin approval"</p>
          <p>Your account exists but hasn't been given access &mdash; contact an admin to have your role changed.</p>
          <p className="font-medium text-uchb-teal">"Account has been disabled"</p>
          <p>An admin disabled your account. Nothing is deleted; contact an admin to have it restored.</p>
          <p className="font-medium text-uchb-teal">The app looks broken or blank</p>
          <p>Try a hard refresh first. On the Home Screen icon version, close and reopen it. Still broken? Contact Thomas or Tristan with what page you were on.</p>
          <p className="font-medium text-uchb-teal">Who do I contact?</p>
          <p>Thomas or Tristan &mdash; whichever of you isn't the one who broke it, most likely.</p>
        </Card>
      </main>
    </div>
  )
}
