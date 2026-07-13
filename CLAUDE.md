# CLAUDE.md — uchb-crm

Primary context file. Read this before making changes. This is the internal
CRM for Upper Cumberland Home Buyers (UCHB) — captures motivated-seller
leads and moves them through a pipeline until an offer is made. Shared
between Thomas and Tristan (both full admin, shared lead pool).

## Stack
- React + Vite SPA, **plain JS/JSX — no TypeScript**
- Tailwind CSS only — no CSS files, no `StyleSheet.create`
- React Router with **HashRouter** (required for GitHub Pages — URLs look
  like `/#/dashboard`)
- Hosting: GitHub Pages via GitHub Actions
- **Supabase Postgres is the system of record** — auth, database, Edge
  Functions, `pg_cron`, Realtime, all in one project. No Airtable, no n8n.
- Resend for transactional email (v1: digest + alerts to both admins)
- Row Level Security (RLS) is already written in the schema migration —
  don't bypass it with service-role calls from the client.

## Schema (already applied via Supabase SQL Editor — do not re-run
`supabase/migrations/0001_init.sql` from the client; it's already live)

- `profiles` — id (= auth.users.id), email, full_name, role ('admin')
- `stages` — id, label, sort_order, is_terminal, color. Seeded:
  New → Contacted → Offer Made → Under Contract → Closed / Dead
- `sources` — id, label, is_active. Seeded: Facebook ad, Website form, Referral
- `leads` — name/phone/property_address (required), email/timeline_to_sell/
  motivation (optional), source (FK), stage (FK), temperature (Hot/Warm/Cold),
  assigned_to, next_follow_up (date), notes
- `lead_activity` — lead_id, author_id, type (call/text/note/offer), body
- `lead_status_history` — auto-written by a DB trigger on stage change
- `notifications` — user_id, type (new_lead/hot/under_contract), lead_id, body, read

**Always read stages/sources from their tables at runtime — never hard-code
pipeline labels in JSX.** This is the configurability guarantee for the app.

## v1 scope — build this, nothing more (see "Explicitly excluded" below)
1. Auth (Supabase magic-link email, both admins already have profile rows
   auto-created on first sign-in via a DB trigger)
2. Leads list + Lead detail (inline stage change, quick-log activity,
   next-follow-up date picker, Hot/Warm/Cold chip)
3. **Manual** "New Lead" entry form — no public-facing form in v1. Include a
   dedupe check (match on phone + property_address) before insert, and
   notify both admins in-app on save.
4. Pipeline kanban — columns rendered from the `stages` table, drag to
   change stage, Supabase Realtime so both admins see live updates
5. Dashboard — new leads this week + count by stage
6. Follow-up queue — leads with `next_follow_up <= today` and not in a
   terminal stage
7. In-app notification center (primary alert channel — do NOT build Web
   Push; unreliable on iOS Safari, which is the primary device)
8. Edge Functions: `follow-up-digest` (7am Central cron, emails both admins
   via Resend) and stage-change alerts (Hot, Under Contract → in-app + email)

## Explicitly excluded from v1 — do not build these yet
Public lead-capture form · Turnstile/hCaptcha · AI lead scoring (Claude
API) · Airtable sync · per-assignment lead ownership restrictions ·
properties/deals table split · document storage · SMS integrations ·
seller drip campaigns · MAO calculator · multi-pipeline · analytics/charts ·
PWA push · offline mode · Vitest suite (add later, starting with auth +
formatters)

## Brand tokens (set in tailwind.config.js, reference by name, never raw hex)
```
teal   #06363a   → primary: nav, headers, buttons, active pipeline stage
gold   #b08a3e   → accent: Offer Made / Under Contract, CTAs, Hot chip
cream  #f9eadf   → background, cards
```
Warm and confident, not corporate-cold — generous whitespace, rounded
corners, soft shadows.

## UX priorities (see architecture doc §8 for full detail — the short version):
- **Optimistic UI everywhere.** Tapping an action updates the screen
  instantly; sync happens in the background. Reverse with a toast on error.
- **One-thumb reachability.** Primary actions bottom-anchored or a floating
  button — this is used one-handed on iPhone Safari, often mid-showing.
- **New Lead form under 15 seconds.** 3 required fields, big touch targets,
  numeric keyboard auto-triggered for phone.
- **Follow-up queue framed warmly** ("3 leads need you today"), not as a
  cold table. Overdue = soft visual distinction, never a harsh red banner.
- **Loading skeletons, not spinners.** Toasts for background actions,
  auto-dismissing. Tap-to-call phone numbers, tap-to-open-Maps addresses.
- End of each build chunk: open it on an actual iPhone and check — can the
  single most common action be done one-handed, under 3 seconds? If not,
  fix before moving on.

## Coding rules
- Local helpers per page (`safeStr`, `safeNum`, `arr`) — copy-pasted, not
  shared, so pages stay independently editable.
- Shared formatters (`fmtDate`, `fmtPhone`) live in `src/lib/supabase.js`.
- Guard `Notification` API: `typeof Notification !== 'undefined'` before
  any reference (crashes on Chrome iOS / Firefox mobile otherwise).
- iOS HashRouter + home-screen save strips the hash fragment — use a
  redirect HTML file in `public/` if/when a home-screen shortcut is added.
- Any further schema change is a new migration file in
  `supabase/migrations/` — never a raw dashboard edit after v1 ships.

## Env vars (already set in `.env.local` locally, in GitHub repo secrets
for the deploy workflow, and as Supabase Edge Function secrets — see
SECRETS-SETUP.md, not committed to this repo)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client-side, safe to bundle
- `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — server-side only, Supabase
  Edge Function secrets, never referenced from `src/`
