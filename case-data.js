/* ============================================================
   case-data.js — all the demo data for the prototype.

   Beginner note: this file plays the role of the backend. The UI
   never invents information; everything it shows comes from this
   one object, the same way a real screen would render an API
   response. Change a value here and the screen follows.

   Business note: the fields mirror what Zanko's current screen
   already tracks (status, owner, channel, risk, etc.) — the
   redesign reorganizes information, it does not require new data.
   The only additions are fields the workflow needs: `stage`,
   per-conclusion `confidence`, and `evidence` quotes, all of
   which Zanko's AI plausibly has internally already.
   ============================================================ */

const CASE_DATA = {
  id: "CNT-51788881253936",

  customer: {
    name: "Richard Ferrell",
    product: "Vera Credit Card",
    customerId: "6216809515",
    email: "r.ferrell@contoso-demo.com",
  },

  // Workflow: the analyst's brief says every case moves
  // review -> investigate -> respond -> resolve. The stage is the
  // organizing fact of the whole screen.
  stages: ["Review", "Investigate", "Respond", "Resolve"],
  stage: 2,                    // index into stages: currently "Respond"
  status: "In progress",
  owner: "maya.torres@lender-demo.com",

  received: "Jun 24, 2026",
  due: "Jul 8, 2026",
  dueInDays: 6,                // demo states flip this negative for "overdue"
  channel: "Email",
  source: "Direct",
  tags: ["Dispute form received"],

  // The complaint itself. `short` is the normal case; `long` is a
  // realistic worst case (forwarded email chains) used by the
  // long-content demo state.
  complaint: {
    short:
`Richard Ferrell, a Vera Credit Card customer, contacted the company expressing extreme dissatisfaction with their customer service. He reports an unauthorized charge of $487.20 posted on Jun 19 and says the first agent he called promised a provisional credit that never appeared. He has since called twice more, waited on hold "for over an hour combined," and was told a dispute form had been mailed — he never received it. He is requesting the charge be reversed and states that if it is not resolved this week he will file a complaint with the CFPB and close all accounts.`,
    long:
`Richard Ferrell, a Vera Credit Card customer, contacted the company expressing extreme dissatisfaction with their customer service. He reports an unauthorized charge of $487.20 posted on Jun 19 and says the first agent he called promised a provisional credit that never appeared. He has since called twice more, waited on hold "for over an hour combined," and was told a dispute form had been mailed — he never received it. He is requesting the charge be reversed and states that if it is not resolved this week he will file a complaint with the CFPB and close all accounts.

--- Forwarded message (Jun 26, 9:41 AM) ---
To whom it may concern: I am writing AGAIN because nobody has responded to my previous two emails. On June 19th a charge of $487.20 from "TRV*BOOKINGS LLC" appeared on my Vera card ending 4402. I did not make this charge. I have never used this merchant. I called the same day and spoke with an agent named Marcus who told me I would receive a provisional credit within 48 hours and that a dispute form would be mailed to me. Neither of those things happened.

--- Forwarded message (Jun 28, 2:17 PM) ---
This is my third attempt. I called again today and was on hold for 38 minutes before speaking with someone who told me there was "no record" of my earlier call. I find that unacceptable. I asked for a supervisor and was told one would call me back within 24 hours. No one called. I am a customer of nine years and I have never missed a payment.

I want three things: (1) the $487.20 charge reversed, (2) written confirmation that my card has been reissued, and (3) an explanation of why I was promised a credit that never came. If this is not resolved by the end of this week I will be filing complaints with the CFPB and my state attorney general, and I will be closing every account I hold with you. — R. Ferrell`,
  },

  // The AI's assessment. Business note: every conclusion carries a
  // confidence and a "why" — this is what lets the analyst trust or
  // question the AI instead of taking a bare score on faith.
  assessment: {
    summary:
      "Customer disputes an unauthorized $487.20 charge (Jun 19) and escalated after a promised provisional credit and dispute form never arrived. Primary harm is the service failure compounding the dispute; customer has stated CFPB intent.",
    summaryConfidence: 92,

    category: {
      issueType: "Complaint",
      primary: "Unauthorized charges",
      secondary: "Customer service failure",
      themes: ["Provisional credit not issued", "Broken follow-up promises", "CFPB threat"],
      confidence: 88,
    },

    risk: {
      level: "High",
      score: 78,
      confidence: 85,
      // Business note: the current screen shows "Alleged: Low" and
      // "Inherent: High" a full viewport apart with no explanation.
      // Here the reconciliation IS the content.
      why:
        "The disputed amount is routine, but two escalators raise inherent risk: a promised provisional credit was not issued (potential Reg E/Reg Z timeliness issue), and the customer has explicitly stated intent to file with the CFPB. Alleged severity is low; process failure makes overall risk high.",
      evidence: [
        "“promised a provisional credit that never appeared”",
        "“if it is not resolved this week I will file a complaint with the CFPB”",
      ],
    },

    // Set by the analyst at runtime (Agree / Override). Kept in the
    // data so the audit trail can show it — Dana's requirement (R4/R8).
    analystDecision: null,
  },

  // The drafted response — the analyst's main work product when the
  // case is in Respond (R7).
  draft: {
    text:
`Dear Mr. Ferrell,

Thank you for contacting us, and I'm sorry for the experience you've described. I've reviewed your account and confirmed the following actions today:

1. A provisional credit of $487.20 has been applied to your account while our investigation of the Jun 19 charge from TRV*BOOKINGS LLC is completed.
2. Your card ending 4402 has been deactivated and a replacement is being expedited to your address on file (2–3 business days).
3. Your dispute form was re-sent by email so there is no further delay by mail.

I also want to acknowledge that you were previously told a credit and a form were on their way and neither arrived. That fell short of our standards, and your feedback has been logged with our service-quality team.

You will receive written confirmation of each item above within 24 hours. If anything is missing, my direct line is below.

Sincerely,
Maya Torres · Complaints Team`,
    generatedBy: "Zanko engine",
    generatedAt: "Jul 1, 2026, 8:04 AM",
  },

  related: [
    { id: "CNT-78910070079295", received: "Mar 23, 2026", resolved: "Mar 24, 2026", note: "Prior fee dispute — resolved with courtesy credit" },
  ],

  // One unified history (R8). `kind` drives the timeline filter:
  // ai = agent actions, comment = human notes, audit = system events.
  timeline: [
    { kind: "audit",   who: "System",        at: "Jun 24, 8:02 AM", text: "Case created from inbound email. SLA due Jul 8." },
    { kind: "ai",      who: "Zanko agent",   at: "Jun 24, 8:03 AM", text: "Complaint summarized and categorized (Unauthorized charges · 88% confidence)." },
    { kind: "ai",      who: "Zanko agent",   at: "Jun 24, 8:07 AM", text: "Pulled transaction record from card processor: $487.20, TRV*BOOKINGS LLC, Jun 19." },
    { kind: "audit",   who: "System",        at: "Jun 24, 9:15 AM", text: "Assigned to maya.torres@lender-demo.com." },
    { kind: "comment", who: "Maya Torres",   at: "Jun 30, 2:12 PM", text: "Confirmed with processor: no prior dispute was opened on the first call. Service failure is on us — including an apology and expedited reissue in the response." },
    { kind: "ai",      who: "Zanko agent",   at: "Jul 1, 8:04 AM",  text: "Draft response generated for analyst review." },
  ],
};
