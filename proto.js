/* ============================================================
   proto.js — the case view, minimum-intervention redesign.

   This is THEIR screen — same sections, same order, same right
   rail, same labels — with exactly five changes, each traceable
   to the diagnosis:

     1. A steps bar + ONE next-action button, added at the top.
     2. The complaint shows in full (their "See More" removed);
        genuinely long text folds under the reader's control.
     3. Their Zanko Analysis fields now say how sure the AI is,
        offer the why, and take Agree / Disagree with a reason.
     4. The draft reply tab opens itself when the case is ready
        to answer, with Approve & send right there.
     5. Resolution fields appear only when a case is actually
        resolved — plus a loud banner when a case is overdue.

   Everything else is untouched, so nobody relearns anything.
   ============================================================ */

function freshCase() { return JSON.parse(JSON.stringify(CASE_DATA)); }

let state = {
  c: freshCase(),
  scenario: "default",
  complaintExpanded: false,
  longContent: false,
  lowConfidence: false,
  overrideOpen: false,     // inline disagree-reason form
  whyOpen: false,          // the risk "why" expander
  activeTab: "draft",      // their Activity tabs; draft opens at Respond
};

const SCENARIOS = {
  default:    { label: "Respond stage" },
  long:       { label: "Long complaint" },
  lowconf:    { label: "Low-confidence AI" },
  overridden: { label: "Analyst disagreed" },
  overdue:    { label: "Overdue" },
  resolved:   { label: "Resolved" },
};

function setScenario(name) {
  state = { ...state, c: freshCase(), scenario: name, complaintExpanded: false,
            longContent: false, lowConfidence: false, overrideOpen: false,
            whyOpen: false, activeTab: "comments" };
  const c = state.c;
  if (name === "long") state.longContent = true;
  if (name === "lowconf") {
    state.lowConfidence = true;
    state.whyOpen = true;                      // AI unsure -> show its reasoning
    c.assessment.category.confidence = 58;
    c.assessment.category.primary = "Billing dispute";
    c.assessment.risk.confidence = 61;
  }
  if (name === "overridden") {
    c.assessment.analystDecision = {
      field: "Primary category", from: "Customer service failure", to: "Unauthorized charges",
      reason: "Service failure is secondary — the driver is the disputed charge.",
      who: "Maya Torres", at: "Jul 1, 9:12 AM",
    };
    c.timeline.push({ kind: "audit", who: "Maya Torres", at: "Jul 1, 9:12 AM",
      text: "Disagreed with AI category: Customer service failure -> Unauthorized charges." });
  }
  if (name === "overdue") { c.dueInDays = -2; c.due = "Jun 30, 2026"; }
  // their tab order stays; the Draft tab opens itself only when the
  // case is at the Respond step — "when it's time to reply"
  if (name !== "resolved" && c.stages[c.stage] === "Respond") state.activeTab = "draft";
  if (name === "resolved") {
    c.stage = 4;
    c.status = "Resolved";
    state.activeTab = "comments";
    c.timeline.push(
      { kind: "audit", who: "Maya Torres", at: "Jul 2, 10:05 AM", text: "Response approved and sent to customer." },
      { kind: "audit", who: "Maya Torres", at: "Jul 2, 10:06 AM", text: "Case marked resolved — not fraud; provisional credit issued." },
    );
  }
  render();
}

// ---------- the one next action ----------

function primaryAction() {
  const c = state.c;
  if (state.scenario === "resolved") return { label: "✓ Case resolved", disabled: true };
  if (state.lowConfidence)          return { label: "Review AI analysis" };
  switch (c.stages[c.stage]) {
    case "Review":      return { label: "Start investigating" };
    case "Investigate": return { label: "Write the reply" };
    case "Respond":     return { label: "Approve & send reply" };
    case "Resolve":     return { label: "Mark resolved" };
  }
}

function advance() {
  const c = state.c;
  if (state.scenario === "resolved") return;
  if (state.lowConfidence) {
    state.lowConfidence = false;
    c.assessment.category.confidence = 88;
    c.assessment.risk.confidence = 85;
    c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now", text: "AI analysis reviewed and confirmed by analyst." });
    render(); return;
  }
  c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now",
    text: c.stages[c.stage] === "Respond" ? "Response approved and sent to customer."
        : (c.stages[c.stage] + " finished — moved to " + (c.stages[c.stage + 1] || "done") + ".") });
  // "Approve & send reply" finishes the job: sending IS resolving,
  // and approving the reply implies the analysis was reviewed — the
  // confirmation checkbox flips with it (a disagreement is never
  // overwritten). Both land in the audit log.
  const wasRespond = c.stages[c.stage] === "Respond";
  if (wasRespond && !c.agreed && !c.assessment.analystDecision) {
    c.agreed = true;
    c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now",
      text: "AI analysis confirmed as part of approving the reply." });
  }
  c.stage = wasRespond ? 4 : c.stage + 1;
  if (c.stage >= 4) {
    state.scenario = "resolved"; state.c.status = "Resolved";
    // stay on the letter: its header turns "✓ Sent" right where you clicked
    if (wasRespond) state.activeTab = "draft";
  } else if (c.stages[c.stage] === "Respond") {
    state.activeTab = "draft";
  }
  render();
}


// ---------- helpers ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const conf = (n) => `<span class="conf ${n < 75 ? "low" : ""}">${n}% sure</span>`;

// ---------- CHANGE 1: the added strip (steps + one action) ----------

function renderStrip() {
  const c = state.c;
  const a = primaryAction();
  const overdue = c.dueInDays < 0;
  const slaChip = overdue
    ? `<span class="chip red">⏰ Overdue</span>`
    : `<span class="chip ${c.dueInDays <= 3 ? "amber" : ""}">Due ${c.due}</span>`;

  $("#strip").innerHTML = `
    ${c.stages.map((s, i) => {
      const cls = i < c.stage ? "done" : i === c.stage ? "current" : "";
      const line = i ? `<div class="step-line ${i <= c.stage ? "done" : i === c.stage + 1 ? "next" : ""}"></div>` : "";
      return `${line}<div class="step ${cls}"><span class="step-label">
        <span class="dot">${i < c.stage ? "✓" : i + 1}</span>${s}</span></div>`;
    }).join("")}
    <span style="width:14px"></span>
    ${slaChip}
    <button class="btn-primary" onclick="advance()" ${a.disabled ? "disabled" : ""}>${a.label}</button>`;

  $("#banner").innerHTML = overdue
    ? `<div class="banner red">⏰ This case is overdue — the reply was due ${c.due}. Sending it is the fastest fix.</div>`
    : state.scenario === "resolved"
    ? `<div class="banner green">✓ Resolved Jul 2 — reply sent, credit issued. This case is read-only.
       <button class="btn-primary" style="margin-left:auto" onclick="setScenario('default')">Next case →</button></div>`
    : "";
}

// ---------- their center column, section by section ----------

// CHANGE 2: description in full — their card, without their "See More"
function renderDescription() {
  const text = state.longContent ? state.c.complaint.long : state.c.complaint.short;
  const words = text.split(/\s+/).length;
  const needsFold = state.longContent && !state.complaintExpanded;
  $("#description").innerHTML = `
    <h2>📄 Description</h2>
    <div class="frow">
      <label>Complaint Description</label>
      <div class="complaint-text ${needsFold ? "collapsed" : ""}">${esc(text)}</div>
      ${state.longContent ? `<button class="expand-btn" onclick="state.complaintExpanded=!state.complaintExpanded;render()">
          ${state.complaintExpanded ? "Collapse ↑" : `Show the rest (${words} words) ↓`}</button>` : ""}
    </div>`;
}

// Their Resolution Description card — always visible, like theirs.
// It's the analyst's working field: she writes the outcome here as she
// works. Dates show "—" until they actually happen.
function renderResolution() {
  const el = $("#resolution");
  el.style.display = "";
  const done = state.scenario === "resolved";
  el.innerHTML = `
    <h2>📄 Resolution Description</h2>
    <div class="frow"><label>Resolution Description</label>
      ${done
        ? `Resolved by calling the customer and explaining the disclosure. Flagged for fraud;
           investigation found it was not actual fraud. Provisional credit of $487.20 issued.`
        : `<span style="color:var(--muted)">Written by the analyst as the case is worked — filled
           in before the case is closed.</span>`}</div>
    <div class="frow dates-inline">
      <span><label>Ticket Closed</label>${done ? "Jul 2, 2026" : "—"}</span>
      <span><label>Due Date</label>${state.c.due}</span>
      <span><label>Resolved Date</label>${done ? "Jul 2, 2026" : "—"}</span>
    </div>
  `;
}

// Their "Zanko Resolution Analysis" card — restored, in their place.
// Inherent risk lives here (their layout); resolution-derived values
// stay "—" until the case is actually resolved.
function renderResAnalysis() {
  const a = state.c.assessment;
  const done = state.scenario === "resolved";
  $("#resanalysis").innerHTML = `
    <h2>✦ Zanko Resolution Analysis <span class="sub">These fields are generated by Zanko engine for complaint analysis.</span></h2>
    <div class="frow"><label>Resolution Summary</label>
      ${done
        ? "The agent apologized for the poor customer service experience, confirmed receipt of the dispute form, and expedited the unauthorized-charge reversal."
        : `<span style="color:var(--muted)">— generated after the case is resolved.</span>`}</div>
    <div class="frow"><label>Resolution Quality Score</label>${done ? "82" : "—"}</div>
    <div class="frow"><label>Inherent Risks</label>
      <span class="chip">Change to Account</span> <span class="chip">Human Error</span>
      <span class="chip">Non-Courtesy Credit</span></div>
    <div class="frow"><label>Inherent Risk Score</label>${a.risk.score}</div>
    <div class="frow"><label>Inherent Risk Level ${conf(a.risk.confidence)}</label>
      <span class="chip red">${a.risk.level}</span>
      <button class="expand-btn" onclick="state.whyOpen=!state.whyOpen;render()">
        ${state.whyOpen ? "Hide the why ▴" : "Why? ▾"}</button>
      ${state.whyOpen ? `<div class="why">${a.risk.why}
        ${a.risk.evidence.map((e) => `<span class="ev">From the complaint: ${e}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

// CHANGE 3: their Zanko Analysis card — same fields, now accountable
function renderAnalysis() {
  const a = state.c.assessment;
  const d = a.analystDecision;
  $("#analysis").innerHTML = `
    <h2>✦ Zanko Analysis <span class="sub">These fields are generated by Zanko engine for complaint analysis.</span></h2>

    <div class="frow"><label>Complaint Summary ${conf(a.summaryConfidence)}</label>
      ${a.summary}</div>

    <div class="frow facts-grid">
      <span><label>Issue Type</label><span class="chip">${a.category.issueType}</span></span>
      <span><label>Zanko Primary Categories ${conf(a.category.confidence)}</label>
        <span class="chip purple">${d ? d.to : a.category.primary}</span>
        <span class="chip">${a.category.secondary}</span></span>
      <span><label>Alleged Risk Level</label><span class="chip">Low</span></span>
      <span><label>Emotion</label><span class="chip amber">Frustration</span></span>
    </div>
    ${d ? `<div class="frow"><div class="override-note"><strong>Analyst disagreed</strong> — was "${d.from}", now
      "${d.to}". Why: ${d.reason} <em>(${d.who}, ${d.at} — saved to the audit log)</em></div></div>` : ""}

    ${!d && (state.c.agreed || state.scenario !== "resolved") ? `
    <div class="frow decide-row" data-new="NEW — agree or disagree, with a saved reason">
      ${state.c.agreed
        ? `<label class="agree-check done"><input type="checkbox" checked disabled> Confirmed by analyst</label>`
        : `<label class="agree-check"><input type="checkbox" onchange="agreeAll()"> I agree with the AI's analysis</label>`}
      ${state.scenario === "resolved" || state.c.agreed ? ""
        : state.overrideOpen ? `
          <input id="ov-reason" class="ov-input" placeholder="Why do you disagree? (saved to the audit log)">
          <button class="btn-quiet" onclick="submitDisagree()">Save</button>
          <button class="linklike" onclick="state.overrideOpen=false;render()">cancel</button>`
        : `<button class="linklike" onclick="state.overrideOpen=true;render()">or disagree…</button>`}
    </div>` : ""}`;
}

function agreeAll() {
  state.c.agreed = true;
  state.c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now", text: "Confirmed the AI's analysis." });
  render();
}
function submitDisagree() {
  const reason = $("#ov-reason").value.trim();
  if (!reason) { $("#ov-reason").placeholder = "A reason is required"; return; }
  state.c.assessment.analystDecision = {
    field: "Primary category", from: state.c.assessment.category.primary,
    to: "Unauthorized charges", reason, who: "Maya Torres", at: "now",
  };
  state.c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now", text: "Disagreed with the AI. Why: " + reason });
  state.overrideOpen = false;
  render();
}

// ---------- their Activity card, tabs intact ----------
// CHANGE 4: at the Respond step the Draft Response tab is already open
// with Approve & send inside.

function renderActivity() {
  const c = state.c;
  const atRespond = c.stages[c.stage] === "Respond" && state.scenario !== "resolved";
  const tabs = ["comments", "draft", "attachments", "audit"];
  const labels = { comments: "Comments",
    draft: "Draft Response" + (state.scenario === "resolved" ? " ✓" : ""),
    attachments: "Attachments", audit: "Audit Log" };

  let body = "";
  if (state.activeTab === "draft") {
    body = `
      ${state.lowConfidence ? `<div class="held">⚠ Held — the AI isn't sure about its analysis.
        Review it above before this reply goes out.</div>` : ""}
      <div class="letter" data-new="CHANGED — opens itself when it's time to reply">
        <div class="letter-head ${state.scenario === "resolved" ? "sent" : ""}">
          ${state.scenario === "resolved"
            ? `✓ Sent to ${c.customer.name} <span>Jul 2, 2026, 10:05 AM</span>`
            : `Reply to ${c.customer.name} <span>drafted by Zanko · ${c.draft.generatedAt}</span>`}</div>
        <div class="letter-body">${esc(c.draft.text)}</div>
      </div>
      ${atRespond && !state.lowConfidence ? `<div class="decide-row" style="margin-top:10px">
        <button class="btn-primary" onclick="advance()">Approve &amp; send reply</button>
        <button class="btn-quiet">Edit</button>
      </div>` : ""}`;
  } else if (state.activeTab === "comments") {
    const items = c.timeline.filter((t) => t.kind === "comment").slice().reverse();
    body = items.map((t) => `<div class="tl-item"><div class="tl-icon comment">💬</div>
      <div><div>${t.text}</div><div class="meta">${t.who} · ${t.at} · <a href="#" onclick="return false" style="color:var(--purple)">Edit</a></div></div></div>`).join("")
      + `<div class="comment-box"><input placeholder="Add a comment…"><button class="btn-quiet">Post</button></div>`;
  } else if (state.activeTab === "audit") {
    const items = c.timeline.filter((t) => t.kind !== "comment").slice().reverse();
    body = items.map((t) => `<div class="tl-item"><div class="tl-icon ${t.kind}">${t.kind === "ai" ? "✦" : "🔒"}</div>
      <div><div>${t.text}</div><div class="meta">${t.who} · ${t.at}</div></div></div>`).join("");
  } else {
    body = `<div class="tl-item"><div class="tl-icon audit">📎</div>
      <div><a href="#" onclick="return false">dispute-form.pdf</a> · <a href="#" onclick="return false">txn-record.csv</a></div></div>`;
  }

  $("#activity").innerHTML = `
    <h2>💬 Activity</h2>
    <div class="tabs-row">
      ${tabs.map((t) => `<button class="${state.activeTab === t ? "on" : ""}"
        onclick="state.activeTab='${t}';render()">${labels[t]}</button>`).join("")}
    </div>
    ${body}`;
}

// ---------- their right rail, verbatim ----------

function renderRail() {
  const c = state.c;
  // field-for-field from their screenshot — nothing added, nothing moved
  $("#rail").innerHTML = `
    <div class="panel">
      <h2>📄 Complaint Details</h2>
      <div class="field"><label>Status</label>${state.scenario === "resolved" ? "Resolved" : c.status} ▾</div>
      <div class="field"><label>Case Owner</label>${c.owner} ▾</div>
      <div class="field"><label>Customer State</label></div>
      <div class="field"><label>Reviewers</label>Select Assignees ▾</div>
      <div class="field"><label>Date Received</label>${c.received}</div>
      <div class="field"><label>Channel</label>${c.channel}</div>
      <div class="field"><label>Customer ID</label>${c.customer.customerId}</div>
      <div class="field"><label>Source</label>${c.source}</div>
      <div class="field"><label>Related Conversation</label><a href="#" onclick="return false" style="color:var(--purple)">View related conversation →</a></div>
      <div class="field"><label>Tags</label>${c.tags.map((t) => `<span class="chip">${t}</span>`).join(" ")} <span class="chip">+ Add</span></div>
    </div>
    <div class="panel">
      <h2>📄 Additional Details</h2>
      <div class="field"><label>Agent ID</label>9502647806</div>
      <div class="field"><label>Customer Email</label>${c.customer.email}</div>
    </div>
    <div class="panel">
      <h2>🕐 Complaints</h2>
      <table class="mini-table">
        <tr><th>Complaint ID</th><th>Received</th><th>Resolved</th></tr>
        ${c.related.map((r) => `<tr><td>${r.id.slice(0,8)}…</td><td>${r.received}</td><td>${r.resolved}</td></tr>`).join("")}
      </table>
    </div>`;
}

// ---------- shell ----------

function render() {
  document.body.classList.toggle("readonly", state.scenario === "resolved");
  renderStrip(); renderDescription(); renderResolution(); renderResAnalysis();
  renderAnalysis(); renderActivity(); renderRail(); renderDemoBar();
}

function renderDemoBar() {
  $("#demo-scenarios").innerHTML = Object.entries(SCENARIOS).map(([k, s]) =>
    `<button class="${state.scenario === k ? "on" : ""}" onclick="setScenario('${k}')">${s.label}</button>`).join("");
}

function toggleNotes(btn) {
  document.body.classList.toggle("show-notes");
  btn.classList.toggle("on");
}

render();
