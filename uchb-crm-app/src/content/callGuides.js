// Call guides are reference content, not operational config (unlike
// stages/sources/tags) — they're long-form editorial scripts, not lookup
// data a form needs to populate. Kept as versioned code content, same as
// any other UI copy, so adding the next guide (FSBO, Tired Landlord,
// Expired Listing, ...) is just adding another object to this array.

export const CALL_GUIDES = [
  {
    slug: 'foreclosure',
    label: 'Foreclosure',
    description: 'Homeowner calls — reinstatement, loan mod, cash sale, or creative',
    script: {
      opener:
        "Hi [Name], this is [Your Name]. [How you got their info — e.g., 'I saw your property came up in county records' / 'so-and-so referred me']. I understand there may be a situation going on with the property at [address], and I wanted to reach out to see how I could help.",
      timeFrame:
        "I've got about [X] minutes before my next call — I just want to ask you a few questions so I can figure out what makes sense for you. If at any point I'm not making sense, stop me. And if you feel like I'm not the right fit, no hard feelings — just say so and I'll get out of your way.",
      transition: "So I can make sure I'm actually helpful here — can you catch me up on how things got to this point?",
      transitionNote: 'Then go quiet. Let them talk. Use only "okay," "I understand," "gotcha" to keep them going.',
      optionsIntro:
        'Options walkthrough (only after you understand their full situation) — walk these in order, asking questions at each step rather than declaring answers:',
      options: [
        {
          title: '1. Reinstatement',
          prompt: 'Do you have access to funds, family, a 401k, anything sellable to catch it up?',
        },
        {
          title: '2. Loan modification',
          prompt:
            "Are you employed right now? Have you started that paperwork? What's the timeline the lender gave you vs. your sale date?",
        },
        {
          title: '3. Cash sale',
          prompt: 'How do you feel about selling instead? If you did, what would you want to walk away with?',
        },
        {
          title: '4. Creative / subject-to',
          prompt:
            "Only if cash sale isn't a fit — explain via a short real example, not jargon. Invite them to verify independently if skeptical.",
        },
      ],
      close:
        "Let's talk again on [specific day/time] — that gives you time to [talk to your spouse / call the lender / think it over]. I'll text you right now to confirm and so you have my info.",
    },
    outline: [
      'Opener — identify yourself, reason for call, empathy',
      'Time boundary + mutual permission to exit',
      'Single open discovery question — then silence',
      "Listen, take notes, don't interrupt",
      'Reflect back what you heard ("so it sounds like...")',
      'Walk options in order — reinstatement → modification → cash → creative',
      'Let them self-disqualify each option via your questions, don\'t tell them "no"',
      'Land on their real preference and get a number/timeline from them',
      'Address the emotional/logistical fear, not just the financial one',
      'Set one specific next appointment (day + time)',
      'Confirm by text immediately after the call',
      'Save contact + log notes in CRM',
    ],
    voicemail: {
      script:
        "Hi [Name], it's [Your Name]. [Referral/source line — e.g., 'I understand there's a situation going on with the property at [address].'] I've actually got about [X] minutes before my next appointment, but I wanted to squeeze in a call to you. We help get these situations cleared up with lenders and families all the time, so don't worry — you've got options. I'll send you a text right now so you have my info. Talk soon.",
      note: 'Keep it under 30 seconds. Warm, unhurried tone — not urgent or alarming.',
    },
    text: {
      script:
        "Hi [Name], this is [Your Name]. [Source/referral line.] I understand there's a situation going on with the property at [address] — we help get these resolved with lenders and families all the time. Feel free to call/text me back anytime, or let me know a good time to reach you.",
      note: 'Send immediately after a voicemail — or at the end of a live call, to confirm the next appointment.',
    },
    questionGroups: [
      {
        title: 'Getting the full picture',
        note: 'Ask every call, in this general order.',
        questions: [
          'How did we get to this point?',
          "What's your current payoff / how much are you behind?",
          'When did you get that number, and where from?',
          'Is there a sale date scheduled? When?',
          'Who else has a say in this decision — spouse, family, other heirs?',
          'How long have you lived here?',
        ],
      },
      {
        title: 'Testing reinstatement',
        questions: [
          'Do you have access to savings, a 401k, or anything you could sell to catch this up?',
          'Have you talked to family or friends about helping?',
        ],
      },
      {
        title: 'Testing loan mod',
        questions: [
          'Are you currently employed?',
          'Have you already started that paperwork? What timeline did the lender give you?',
        ],
      },
      {
        title: 'Testing sale interest',
        questions: [
          'How do you feel about the idea of selling instead of trying to keep it?',
          'If you did sell, what would you want to walk away with?',
          "What's holding you back from making a decision — money, or something else (moving, kids, timing)?",
        ],
      },
      {
        title: 'Probate-specific (if applicable)',
        questions: [
          'Who are all the heirs?',
          "Who's the executor?",
          "Who's currently living in the property, and are they paying anything?",
        ],
      },
    ],
    logTemplate: `DATE:
HOMEOWNER:
PROPERTY ADDRESS:
PHONE:

CALL TYPE:  [ ] Live answer   [ ] Voicemail + text only

SITUATION SUMMARY (1-2 sentences):


KEY NUMBERS:
- Payoff/amount owed:
- Sale/auction date:
- Desired walk-away amount (if mentioned):

DECISION MAKERS INVOLVED:

OPTIONS DISCUSSED / RULED OUT:
[ ] Reinstatement — ruled out because:
[ ] Loan mod — ruled out because:
[ ] Cash sale — interest level:
[ ] Creative/subject-to — interest level:

HOMEOWNER'S STATED PREFERENCE:

NEXT STEP / APPOINTMENT: [date + time]

NOTES / FLAGS (emotional state, objections, red flags):
`,
    logNote:
      "Keep it to this one block per call — no more fields than that. If it doesn't help you decide the next action or prep the next call, leave it out.",
  },
]

export function getGuideBySlug(slug) {
  return CALL_GUIDES.find((g) => g.slug === slug) || null
}
