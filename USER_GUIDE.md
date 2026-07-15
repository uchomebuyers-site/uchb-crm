# UCHB CRM — User Guide

Welcome. This is the internal CRM for Upper Cumberland Home Buyers — it's where every lead lives, from the moment they raise a hand to the moment you make an offer. This guide covers everything in the app as it exists today. Skim the box below, then come back to the rest whenever you need it.

---

## 0. At a Glance

> **New here? Read just this box and you're ready to work.**

- **Add a lead in under 15 seconds:** Leads tab → **+ New Lead** button at the bottom → fill in Name, Phone, Property address (the only 3 required fields) → **Save Lead**.
- **See what needs you today:** the **Follow-ups** tab is your daily to-do list — anyone whose next follow-up date is today or earlier shows up there.
- **Hot / Warm / Cold** is a quick-glance urgency tag, not a formal status: **Hot** = ready to move, call now; **Warm** = interested, not urgent; **Cold** = long shot or very early. Set it from the lead's detail page.
- **Drag a card in Pipeline** to change its stage; tap the small arrow in the corner of a card to open it without dragging.
- **The bell icon** (top right of every page) is your in-app notification list — tap it to see recent activity, **Mark all read** to clear it.
- **Some things also email you instantly** (a lead going Hot, moving to Under Contract, or a new Facebook lead) **and there's a daily 7:00 AM digest** of that day's follow-ups. Adding a lead yourself does *not* send an email — only an in-app notification. Full breakdown in [Section 7](#7-notifications--emails).
- **Sign in with a magic link (no password) or set a password** anytime from the Dashboard — see [Getting Started](#1-getting-started) below.
- **Add it to your iPhone Home Screen** so it opens like a real app — see [Getting Started](#1-getting-started).

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Leads](#3-leads)
4. [Lead Detail](#4-lead-detail)
5. [Pipeline (Kanban)](#5-pipeline-kanban)
6. [Follow-up Queue](#6-follow-up-queue)
7. [Notifications & Emails](#7-notifications--emails)
8. [User Management (Admin)](#8-user-management-admin)
9. [FAQ](#9-faq)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting Started

### Signing in

Go to the CRM sign-in page. You'll see two tabs:

- **Email me a link** — type your email, tap **Send magic link**, then open the email that arrives and tap **Sign In**. No password needed. The link works once and expires after a while, so if it's been sitting in your inbox a bit, request a fresh one.
- **Sign in with password** — type your email and password, tap **Sign in**.

Both are always available side by side — use whichever's faster for you in the moment.

### Setting a password

If you'd rather not wait on an email every time, you can set a password once you're signed in:

1. Go to the **Dashboard**.
2. Scroll to the bottom, tap **Set a password**.
3. Enter a new password (at least 6 characters) twice, tap **Save password**.

From then on, "Sign in with password" works on the sign-in screen too. Magic link keeps working regardless — it's not an either/or.

### Adding it to your iPhone Home Screen

This makes it open full-screen, like a real app, no browser address bar:

1. Open the CRM in **Safari** (has to be Safari, not Chrome, for this to work on iPhone).
2. Tap the **Share** icon (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top right.

You'll get an app icon on your Home Screen. Tap it any time to jump straight in.

---

## 2. Dashboard

The Dashboard is your at-a-glance snapshot when you first sign in.

- **New leads this week** — a big number at the top, counting every lead created in the last 7 days, from any source.
- **New leads, last 14 days (chart)** — a bar for each of the last 14 days showing how many leads came in that day. Useful for spotting a slow patch or a spike (like right after running an ad).
- **Leads by stage** — a bar for each pipeline stage (New, Contacted, Offer Made, etc.) showing how many leads currently sit there. This is the same data as the Pipeline board, just as a quick list instead of a kanban view.

Below that: your name, the **Set a password** option, and **Sign out**.

---

## 3. Leads

The **Leads** tab is the full list of every lead in the system, newest first.

### Adding a new lead

Tap **+ New Lead** (the button fixed to the bottom of the screen). The form:

- **Name*** — required.
- **Phone*** — required. Pulls up the numeric keypad automatically on mobile.
- **Property address*** — required.
- **Timeline to sell** — free text, e.g. "ASAP" or "3-6 months."
- **Motivation** — free text notes on why they're selling.
- **Source** — dropdown of where the lead came from (Facebook ad, Website form, Referral).
- **Temperature** — Hot / Warm / Cold buttons, optional, tap again to deselect.

Only Name, Phone, and Property address are required — you can save a lead in seconds and fill in the rest later from the lead's detail page.

### The duplicate warning

When you tap **Save Lead**, the app checks whether a lead already exists with the *same phone number* or a property address that matches (not case-sensitive). If it finds one:

- You'll see **"A similar lead already exists"** (or "Similar leads already exist" if more than one match) with a link to each matching lead.
- **This is different — save anyway** creates the new lead regardless.
- **Cancel** backs out without saving, so you can go look at the existing lead instead.

This exists to stop the same seller from ending up as two separate leads when they call in twice or come through two different channels.

### Finding an existing lead

There's no search bar yet — the list is sorted newest-first, and you can narrow it down with the **owner filter pills** at the top (All / each admin's name) if leads are assigned. Otherwise, scroll, or reach the lead a faster way: through **Pipeline**, **Follow-ups**, or a notification.

### The temperature chip

Each lead can carry a **Hot / Warm / Cold** tag, shown as a small colored pill on its card everywhere it appears (Leads list, Pipeline, Follow-ups). It's a manual, subjective read on urgency — use it however's useful to you, but as a rule of thumb:

- **Hot** — ready to move now, call today. Marking a lead Hot fires an instant alert to every admin (see [Section 7](#7-notifications--emails)).
- **Warm** — genuinely interested, not urgent.
- **Cold** — early, unqualified, or a long shot.

A lead with no temperature set just shows no chip — that's fine, it's optional.

---

## 4. Lead Detail

Tap any lead (from Leads, Pipeline, or Follow-ups) to open its detail page. Top to bottom:

### Contact info

Phone (tap to call), property address (tap to open in Maps), email, source, timeline to sell, motivation, and notes — whichever of these have a value. This section is read-only display; there's currently no way to edit the address, phone, timeline, motivation, or notes after the lead is created except by re-entering them another way (this is a known gap, not a hidden feature).

### Stage, Assigned to, Temperature, Next follow-up

This is the core working section, all editable and saved instantly the moment you tap something:

- **Stage** — dropdown of every pipeline stage. Changing it here does exactly what dragging the card in Pipeline does.
- **Assigned to** — a row of buttons: **Unassigned** plus one button per admin. Tap a name to assign the lead to that person, or **Unassigned** to clear it. This is purely a "who's working this" label — both admins can always see and edit every lead regardless of assignment; it doesn't restrict access.
- **Temperature** — Hot / Warm / Cold buttons, same as on the New Lead form.
- **Next follow-up** — a date picker. This is what determines whether a lead shows up in the Follow-up Queue.

### Log activity

A running history of every call, text, note, and offer logged against this lead, newest first. To add one: pick a type (Call / Text / Note / Offer), type what happened, tap **Log activity**. Each entry in the history shows who logged it and the date.

### Ownership & Listing

Collapsed by default — tap the section header to open it. Covers cases where you're not dealing directly with the property owner:

- **Owner (if different from contact)** — name and phone, only relevant if whoever you've been talking to isn't the actual owner.
- **On the market?** — a Not on market / On market toggle.
- When set to **On market**, three more fields appear: **listing agent name, phone, and brokerage** — since you'll likely be negotiating through an agent instead of directly.

Tap **Save** at the bottom of the section to store your changes (the On market toggle itself saves instantly when tapped; the text fields need Save).

### Underwriting

Also collapsed by default. When collapsed and you've entered any numbers, you'll see a quick summary line (e.g. "ARV $250,000 · Asking price $260,000") so you don't have to open it just to check.

- **ARV, Asking price, Repair estimate, Target offer** — plain number fields (no need to type dollar signs or commas).
- **Underwriting spreadsheet link** — paste a URL (e.g. your Google Sheet). Once saved, an **Open spreadsheet ↗** button appears above the field for one-tap access.
- **Drive folder link** — same idea, for a Google Drive folder of docs/photos. Shows an **Open Drive folder ↗** button once set.

Tap **Save** to store any changes in this section.

---

## 5. Pipeline (Kanban)

The **Pipeline** tab shows every lead as a card in a column, one column per stage — New, Contacted, Offer Made, Under Contract, Closed, Dead. Scroll sideways to see every column.

- **Drag a card** left or right to move it into a different column — that changes its stage the same as picking it from the Stage dropdown on the lead's detail page. Drop near the very edge of the screen while dragging and the board auto-scrolls so you can reach columns further over.
- **Tap the small arrow (›) in the corner** of a card to open that lead's detail page without triggering a drag.
- Each card shows the lead's name, an owner initials badge (if assigned), address, temperature chip (if set), and a small "Today" or "Xd" badge showing how many days since it last changed stage.
- The **owner filter pills** at the top (All / each admin) narrow the whole board down to just that person's leads — useful for a quick "what's on my plate" view. Filtering is instant, no reload.
- Changes made by either admin show up live on both screens without needing to refresh — this board updates in real time.

---

## 6. Follow-up Queue

The **Follow-ups** tab is a prioritized list, not just another lead list. It shows every lead whose **next follow-up date is today or earlier**, and *not* already in a finished stage (Closed or Dead are excluded — nothing left to follow up on there).

- The headline at the top tells you at a glance how many leads need you ("3 leads need you today," or "You're all caught up" if there's nothing due).
- Leads that are **overdue** (follow-up date already passed) get a subtle left-edge highlight — not a harsh red banner, just enough to notice.
- Tap **Log** on a card to log a call/text/note right there, without leaving the queue — pick a type, type what happened, tap **Log activity**. This does not automatically change the follow-up date; go into the lead detail page to set a new one.
- Tap the lead's name/address area (not the Log button) to open its full detail page.
- The owner filter pills work here too, same as Pipeline and Leads.

---

## 7. Notifications & Emails

This is the one area worth reading closely — not knowing what triggers an email (or doesn't) is the most common source of confusion.

### What triggers what

| Trigger | In-app notification (bell)? | Email? | Who gets it | Timing |
|---|---|---|---|---|
| **You add a lead manually** (New Lead form) | ✅ Yes | ❌ No | Every admin | Instant |
| **A new Facebook lead comes in** (via the ad webhook, once fully connected) | ✅ Yes | ✅ Yes | Every *active* admin | Instant |
| **A lead is marked Hot** (changed to Hot on the lead detail page — setting it Hot at creation doesn't count) | ✅ Yes | ✅ Yes | Every admin | Instant |
| **A lead moves to Under Contract** (via the Stage dropdown or by dragging its card in Pipeline) | ✅ Yes | ✅ Yes | Every admin | Instant |
| **Daily follow-up digest** | ❌ No — email only | ✅ Yes | Every admin with an email on file | 7:00 AM Central, every day |
| **Someone requests a magic sign-in link** | ❌ No | ✅ Yes | Whoever requested it | Instant, on request |
| **An admin invites a new user** | ❌ No | ✅ Yes | The invited person | Instant, when sent |

A few things worth calling out explicitly:

- **Manually adding a lead never sends an email** — you'll only see it as an in-app notification (the bell). If you were expecting an email for a lead you just typed in yourself, that's expected — there isn't one.
- **The Hot alert only fires on a change.** If you create a brand-new lead and mark it Hot in the same New Lead form, no alert fires — only flipping an *existing* lead's temperature to Hot from the lead detail page triggers it.
- **The daily digest is email-only** — it never shows up in the bell. It lists every lead whose follow-up is due that day or earlier (same rule as the Follow-up Queue), each with name, address, and due date.
- **Every alert email goes to every admin**, whether their account happens to be active or disabled at that moment — except the Facebook-lead alert, which only goes to admins currently marked active.

### What each email actually says

- **Magic link email** — subject is Supabase's standard sign-in subject; branded UCHB CRM body: *"Tap below to sign in to the Upper Cumberland Home Buyers CRM"* with a **Sign In** button, plus a note that the link expires shortly and works once.
- **Invite email** — same branded look; body reads *"You've been invited to the Upper Cumberland Home Buyers CRM. Tap below to set up your account"* with an **Accept Invite** button.
- **Hot lead alert** — subject "Hot lead alert"; body: *"🔥 [Name] — [Address] just turned Hot."*
- **Under Contract alert** — subject "Lead is Under Contract"; body: *"[Name] — [Address] is now Under Contract."*
- **New Facebook lead alert** — subject "New Facebook lead just came in"; body: *"New Facebook lead just came in — [Name], [Address]. Call fast."* plus the phone number if one was captured.
- **Daily digest** — subject like "3 follow-ups due today"; body is a warm one-line greeting followed by a bulleted list, one line per lead (name, address, due date).

### The in-app notification bell

Every page has a bell icon top right. Tap it to open a dropdown of your recent notifications (up to the last 50), newest first. Unread ones are highlighted. Tap any notification to jump straight to that lead (and it's automatically marked read). Tap **Mark all read** to clear the unread count in one go. This list is personal — you only see notifications addressed to you, not your teammate's.

---

## 8. User Management (Admin)

Only admins see the **Users** tab in the main nav. This is where you invite teammates and manage existing accounts.

### Inviting a new user

1. Go to **Users**.
2. Under **Invite user**, enter their email address.
3. Choose a role from the dropdown:
   - **Admin** — full access to everything, same as you.
   - **Pending (no elevated access)** — they can sign in, but land on a screen that says their account is awaiting approval, and can't get into the app until promoted.
4. Tap **Send invite**.

They'll receive an email (see [Section 7](#7-notifications--emails) for exactly what it says) with a link to set up their account. If you invited them as **Admin**, they have full access as soon as they accept and sign in. If you invited them as **Pending**, they can sign in but will be stuck on the "awaiting approval" screen —

**Important, and worth knowing up front:** there is currently no button anywhere in the app to promote a Pending user to Admin after the fact. Role can only be set at the moment of invite. If you accidentally invite someone as Pending and need them elevated, that currently requires a direct database change — ask whoever manages the CRM's backend. In practice, since this CRM is just the two of you today, you'll almost always want to invite as **Admin**.

### Changing a user's role

Not currently possible from the Users page once someone's been invited — see the note above. The role dropdown only applies at invite time.

### Disabling / removing a user

Every user row has a button on the right: **Remove** (if they're active) or **Restore** (if they're disabled). You can't disable your own account — that button is grayed out on your own row.

What "disabled" actually does:
- They're signed out and blocked from the app — the next time they load a page or their session refreshes, they'll see **"Your account has been disabled. Contact an admin if you think this is a mistake."**
- If they were already using the app when disabled, they may not be booted out that exact instant — it takes effect the next time the app checks their session (loading a page, refreshing).
- **Nothing is deleted.** Their profile, past activity log entries, and everything they've ever done stays exactly as it was.
- Tapping **Restore** flips them straight back to active — no re-invite needed, they can sign in again immediately.

### Status badges on the Users list

Each user shows two separate badges — these are two different fields, not one:

- **Role badge** — either **admin** (full access) or **pending** (no access yet, awaiting a role change that currently has to happen outside the app).
- **Status badge** — either **active** (able to sign in, assuming their role isn't pending) or **disabled** (blocked entirely, per above).

So a user can be, for example, role "pending" + status "active" — meaning they *can* technically authenticate, but the app still blocks them at the door with the "awaiting approval" screen because of their role, not their status.

---

## 9. FAQ

**Why did I get signed out?**
Sessions expire after a while, or you may have followed an old magic-link email that had already expired (you'll see "This sign-in link has expired" instead of a blank page — tap **Back to sign in** and request a fresh one, or use your password).

**What if I forgot my password?**
There's no "forgot password" reset flow built yet. Just switch to the **Email me a link** tab on the sign-in screen instead — once you're in, go to the Dashboard and use **Set a password** to set a new one.

**What does it mean when a lead shows as a duplicate?**
The system found an existing lead with the same phone number or a matching property address when you tried to save a new one. See [Section 3](#3-leads) for the full explanation and your options.

**Why can't I edit a stage or source dropdown option?**
Nobody can, right now — not even admins. The list of stages (New, Contacted, etc.) and sources (Facebook ad, Website form, Referral) is fixed in the system. If you need one added or changed, that requires a direct change by whoever manages the CRM's backend, not something available in the app UI today.

**What happens if two of us are looking at the same lead at once?**
The Pipeline board updates live for both of you — if your teammate drags a card, you'll see it move on your screen too, no refresh needed. The Lead Detail page itself does *not* auto-refresh, though — if you're both viewing/editing the exact same lead's detail page, whoever saves last wins for that field, and the other person won't see the change until they leave and reopen the page.

**Why didn't I get an email for X?**
Check [Section 7](#7-notifications--emails) — a lot of actions are in-app-only by design (manually adding a lead, for instance, never sends an email). If it's an alert type that should have emailed you, check your spam folder, and confirm the account has an email on file.

**Does assigning a lead to someone restrict who can see or edit it?**
No. "Assigned to" is purely a label for organizing who's working what — both admins can always see and edit every lead in the shared pool, regardless of assignment.

---

## 10. Troubleshooting

**A sign-in link doesn't work / shows an error.**
Magic links expire fairly quickly and only work once. If you click one that's already been used or has expired, you'll land on a friendly "This sign-in link has expired" screen rather than a blank page — tap **Back to sign in** and request a new one, or switch to signing in with your password if you've set one.

**I see "Your account is awaiting admin approval."**
Your account exists but hasn't been given access yet (see the User Management section — this happens when someone's invited with the "Pending" role instead of "Admin"). Contact an admin to have your access sorted out.

**I see "Your account has been disabled."**
An admin has disabled your account. Nothing about your account is deleted, but you're blocked from signing back in until an admin taps **Restore** on your user row. Contact an admin if you think this happened by mistake.

**The app looks broken, blank, or something isn't loading.**
Try a hard refresh first (reload the page). If you're on the home-screen icon version, closing and reopening it usually helps too. If it's still broken, contact whoever manages the CRM's backend (Thomas or Tristan) — include what page you were on and what you were trying to do, since that makes it much faster to track down.

**Who do I contact if something seems broken or wrong?**
Thomas or Tristan — whichever of you isn't the one who broke it, most likely.
