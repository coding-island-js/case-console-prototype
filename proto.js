/* ============================================================
   proto.js — behavior for the redesigned case view.

   Beginner note: there is one `state` object. Every render
   function reads it and rewrites one region of the page. Any
   change (a demo state, an override, advancing the workflow)
   mutates `state` and calls render() — the same one-way pattern
   frameworks use, in ~200 lines of plain JS.

   Business note: the interesting logic is primaryAction() — the
   screen computes ONE next action from workflow stage + AI
   confidence. That single function is the answer to the brief's
   "make what-to-do-next obvious."
   ============================================================ */

// ---------- state ----------

// Deep-copy the demo data so demo states can mutate freely and reset cleanly.
function freshCase() { return JSON.parse(JSON.stringify(CASE_DATA)); }

let state = {
  c: freshCase(),          // the case record (from case-data.js)
  scenario: "default",     // which demo state is active
  complaintExpanded: false,
  longContent: false,      // demo: use the long complaint text
  lowConfidence: false,    // demo: AI is unsure -> screen behaves differently
  tlFilter: "all",         // timeline filter: all | ai | comment | audit
  overrideOpen: false,     // the inline override-reason form
  assessOpen: false,       // AI assessment: one line by default, expands
  tlOpen: false,           // history: last 2 entries by default
  moreOpen: false,         // Escalate/Reassign live behind a quiet toggle
};

// ---------- demo scenarios (the "key states" from the brief) ----------

const SCENARIOS = {
  default:       { label: "Respond stage" },
  long:          { label: "Long complaint" },
  lowconf:       { label: "Low-confidence AI" },
  overridden:    { label: "Analyst override" },
  overdue:       { label: "Overdue SLA" },
  resolved:      { label: "Resolved" },
};

function setScenario(name) {
  state = { ...state, c: freshCase(), scenario: name, complaintExpanded: false,
            longContent: false, lowConfidence: false, overrideOpen: false, tlFilter: "all",
            // calm by default; open the AI details only when they need a human
            assessOpen: (name === "lowconf" || name === "overridden"),
            tlOpen: false, moreOpen: false };
  const c = state.c;

  if (name === "long") state.longContent = true;

  if (name === "lowconf") {
    // Business note: when the AI is unsure, the screen must say so and
    // slow the analyst down — the draft is held until a human reviews.
    state.lowConfidence = true;
    c.assessment.category.confidence = 58;
    c.assessment.category.primary = "Billing dispute";
    c.assessment.risk.confidence = 61;
  }

  if (name === "overridden") {
    c.assessment.analystDecision = {
      field: "Primary category", from: "Customer service failure", to: "Unauthorized charges",
      reason: "Service failure is secondary — the driver is the disputed charge (Reg E timeline).",
      who: "Maya Torres", at: "Jul 1, 9:12 AM",
    };
    c.timeline.push({ kind: "audit", who: "Maya Torres", at: "Jul 1, 9:12 AM",
      text: "Overrode AI category: Customer service failure → Unauthorized charges. Reason: service failure is secondary — the driver is the disputed charge (Reg E timeline)." });
  }

  if (name === "overdue") { c.dueInDays = -2; c.due = "Jun 30, 2026"; }

  if (name === "resolved") {
    c.stage = 4; // past the last step — all four done
    c.status = "Resolved";
    c.timeline.push(
      { kind: "audit", who: "Maya Torres", at: "Jul 2, 10:05 AM", text: "Response approved and sent to customer." },
      { kind: "audit", who: "Maya Torres", at: "Jul 2, 10:06 AM", text: "Case marked resolved. Disposition: resolved with provisional credit; not fraud." },
    );
  }

  render();
}

// ---------- the one primary action (R6) ----------

// Returns { label, sub } for the single button that answers
// "what do I do next?", computed from stage + AI state.
function primaryAction() {
  const c = state.c;
  if (state.scenario === "resolved") return { label: "✓ Case resolved", disabled: true };
  if (state.lowConfidence)          return { label: "Review AI analysis", sub: "Draft held until reviewed" };
  switch (c.stages[c.stage]) {
    case "Review":      return { label: "Confirm intake → Investigate" };
    case "Investigate": return { label: "Generate draft response" };
    case "Respond":     return { label: "Approve & send response" };
    case "Resolve":     return { label: "Mark resolved" };
  }
}

// Advance the workflow when the primary action is clicked.
// Every advance writes to the timeline — nothing invisible (R8).
function advance() {
  const c = state.c;
  if (state.scenario === "resolved") return;
  if (state.lowConfidence) {
    // Reviewing the analysis resolves the uncertainty in this demo.
    state.lowConfidence = false;
    c.assessment.category.confidence = 88;
    c.assessment.risk.confidence = 85;
    c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now", text: "AI analysis reviewed and confirmed by analyst." });
    render(); return;
  }
  const stageName = c.stages[c.stage];
  c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now",
    text: stageName === "Respond" ? "Response approved and sent to customer."
        : `${stageName} completed — case moved to ${c.stages[c.stage + 1] || "done"}.` });
  c.stage += 1;
  if (c.stage >= 4) { setScenarioResolved(); return; }
  render();
}

function setScenarioResolved() {
  // Reaching the end of the workflow IS the resolved state.
  state.scenario = "resolved";
  state.c.status = "Resolved";
  state.c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now",
    text: "Case marked resolved. Disposition recorded." });
  render();
}

// ---------- tiny helpers ----------

const $ = (sel) => document.querySelector(sel);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const confBadge = (n) =>
  `<span class="conf ${n < 75 ? "low" : ""}">${n < 75 ? "⚠ " : ""}${n}% confidence</span>`;

// ---------- render functions: one per region ----------

function renderHeader() {
  const c = state.c;
  const a = primaryAction();
  const overdue = c.dueInDays < 0;
  const slaChip = overdue
    ? `<span class="chip red">⏰ Overdue by ${-c.dueInDays}d</span>`
    : `<span class="chip ${c.dueInDays <= 3 ? "amber" : ""}">Due ${c.due} · ${c.dueInDays}d</span>`;
  // no status chip: the steps bar IS the status (each fact once, R9)
  const resolvedChip = state.scenario === "resolved" ? `<span class="chip green">✓ Resolved</span>` : "";

  $("#hdr-row").innerHTML = `
    <a class="back" href="#" onclick="return false">← Queue</a>
    <div class="who">${c.customer.name}<small>${c.customer.product}</small></div>
    <span class="chip red">Risk: ${c.assessment.risk.level}</span>
    ${resolvedChip}
    ${slaChip}
    <span class="case-id">${c.id}
      <button class="copy-id" title="Copy ID" onclick="navigator.clipboard && navigator.clipboard.writeText('${c.id}'); this.textContent='✓'; setTimeout(()=>this.textContent='⧉',900)">⧉</button>
    </span>
    <div class="ch-actions">
      ${state.moreOpen ? `<button class="btn-quiet">Escalate</button>
      <button class="btn-quiet">Reassign</button>` : ""}
      <button class="btn-more" onclick="state.moreOpen=!state.moreOpen;render()" title="More actions">⋯</button>
      <button class="btn-primary" onclick="advance()" ${a.disabled ? "disabled" : ""}>${a.label}</button>
    </div>
    <span class="dnote">Identity, stakes, SLA — zero scroll (R1, R10)</span>`;

  // Stepper: done / current / todo, clickable for the demo.
  $("#stepper").innerHTML = c.stages.map((s, i) => {
    const cls = i < c.stage ? "done" : i === c.stage ? "current" : "";
    const dot = i < c.stage ? "✓" : i + 1;
    const lineCls = i <= c.stage ? "done" : i === c.stage + 1 ? "next" : "";
    return `${i ? `<div class="step-line ${lineCls}"></div>` : ""}
      <div class="step ${cls}"><button onclick="jumpStage(${i})"><span class="dot">${dot}</span>${s}</button></div>`;
  }).join("") +
  (a.sub ? `<span class="chip amber" style="margin-left:14px">${a.sub}</span>` : "") +
  `<span class="dnote" style="top:auto;bottom:6px">Always know where the case is and what's next (R5, R6)</span>`;

  // SLA banner appears only when the case demands attention (R10).
  $("#banner").innerHTML = overdue
    ? `<div class="banner red">⏰ SLA overdue by ${-c.dueInDays} days — regulatory response deadline was ${c.due}. Sending the response is the fastest path to compliance.</div>`
    : state.scenario === "resolved"
    // Throughput matters (~40 cases/day): closing a case offers the next
    // one directly, so the loop continues without a trip to the queue.
    ? `<div class="banner green">✓ Resolved on Jul 2, 2026 — response sent, provisional credit issued. This case is now read-only.
       <button class="btn-primary" style="margin-left:auto" onclick="setScenario('default')">Next case in queue →</button></div>`
    : "";
}

function jumpStage(i) {  // demo shortcut: click any step to move the case
  if (state.scenario === "resolved") return;
  state.c.stage = i; render();
}

function renderComplaint() {
  const text = state.longContent ? state.c.complaint.long : state.c.complaint.short;
  const words = text.split(/\s+/).length;
  const needsCollapse = state.longContent && !state.complaintExpanded;
  $("#complaint").innerHTML = `
    <h2>Complaint <span class="sub">${state.c.channel} · received ${state.c.received}</span></h2>
    <div class="complaint-text ${needsCollapse ? "collapsed" : ""}">${esc(text)}</div>
    ${state.longContent ? `<button class="expand-btn" onclick="toggleComplaint()">
        ${state.complaintExpanded ? "Collapse ↑" : `Show full complaint (${words} words) ↓`}</button>` : ""}
    <span class="dnote">Full text by default; the reader controls long content (R2)</span>`;
}
function toggleComplaint() { state.complaintExpanded = !state.complaintExpanded; render(); }

function renderAssessment() {
  const a = state.c.assessment;
  const d = a.analystDecision;
  // One scannable line answers "what does the AI think, how sure is it?"
  // The full reasoning is one click away — calm by default.
  const headline = `
    <div class="assess-row">
      <span class="lead">✦ AI read:</span>
      <span class="chip purple">${d ? d.to : a.category.primary}</span>
      <span class="chip red">Risk ${a.risk.level} · ${a.risk.score}</span>
      ${confBadge(Math.min(a.category.confidence, a.risk.confidence))}
      ${d ? `<span class="chip amber">edited by analyst</span>` : ""}
      ${state.scenario !== "resolved" && !d ? (state.c.agreed_category
          ? `<span class="decided">✓ Confirmed</span>`
          : `<button class="btn-agree" onclick="agree('category')">✓ Agree</button>
             <button class="btn-override" onclick="state.overrideOpen='category';state.assessOpen=true;render()">Override…</button>`) : ""}
      <button class="btn-details" onclick="state.assessOpen=!state.assessOpen;render()">
        ${state.assessOpen ? "Hide the why ▴" : "See the why ▾"}</button>
    </div>`;

  const detail = !state.assessOpen ? "" : `
    <div class="assess-detail">
    <div class="assess-block">
      <div class="assess-label">Summary ${confBadge(a.summaryConfidence)}</div>
      <div>${a.summary}</div>
    </div>
    <div class="assess-block">
      <div class="assess-label">Categorization ${confBadge(a.category.confidence)}</div>
      <div>
        <span class="chip">${a.category.issueType}</span>
        <span class="chip purple">${d ? d.to : a.category.primary}</span>
        <span class="chip">${a.category.secondary}</span>
        ${a.category.themes.map((t) => `<span class="chip">${t}</span>`).join(" ")}
      </div>
      ${d ? `<div class="override-note"><strong>Analyst override</strong> — was “${d.from}”, now “${d.to}”.
              Reason: ${d.reason} <em>(${d.who}, ${d.at} · recorded in audit log)</em></div>`
          : decideButtons("category")}
    </div>
    <div class="assess-block">
      <div class="assess-label">Risk: ${a.risk.level} (${a.risk.score}/100) ${confBadge(a.risk.confidence)}</div>
      <div class="why">
        <strong>Why:</strong> ${a.risk.why}
        ${a.risk.evidence.map((e) => `<span class="ev">Evidence: ${e}</span>`).join("")}
      </div>
      ${decideButtons("risk")}
    </div>
    </div>`;

  $("#assessment").innerHTML = headline + detail +
    `<span class="dnote">R3 R4 · one scannable line; the why is one click away</span>`;
}

// Agree is one click (cheap, frequent). Override asks for a reason
// (rare, consequential) — friction proportional to consequence (R4).
function decideButtons(field) {
  if (state.scenario === "resolved") return "";
  if (state.overrideOpen === field) {
    return `<div class="override-form">
      <input id="ov-reason" placeholder="Reason for override (required — written to the audit log)">
      <button class="btn-agree" onclick="submitOverride('${field}')">Save</button>
      <button class="btn-override" onclick="state.overrideOpen=false;render()">Cancel</button>
    </div>`;
  }
  const agreed = state.c["agreed_" + field];
  return `<div class="decide">
    ${agreed ? `<span class="decided">✓ Confirmed by analyst</span>`
             : `<button class="btn-agree" onclick="agree('${field}')">✓ Agree</button>`}
    <button class="btn-override" onclick="state.overrideOpen='${field}';render()">Override…</button>
  </div>`;
}
function agree(field) {
  state.c["agreed_" + field] = true;
  state.c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now", text: `Confirmed AI ${field} assessment.` });
  render();
}
function submitOverride(field) {
  const reason = $("#ov-reason").value.trim();
  if (!reason) { $("#ov-reason").placeholder = "A reason is required for the audit log"; return; }
  state.c.assessment.analystDecision = {
    field, from: state.c.assessment.category.primary, to: "Unauthorized charges",
    reason, who: "Maya Torres", at: "now",
  };
  state.c.timeline.push({ kind: "audit", who: "Maya Torres", at: "now",
    text: `Overrode AI ${field}. Reason: ${reason}` });
  state.overrideOpen = false;
  render();
}

function renderWorkspace() {
  const c = state.c;
  const stageName = c.stages[c.stage] || "Done";
  let body = "";
  if (state.scenario === "resolved") {
    body = `<div class="resolved-summary"><strong>Closure summary:</strong> Provisional credit of
      $487.20 issued; card reissued; response sent Jul 2. Disposition: resolved — not fraud.
      Resolution time: 8 days (SLA met).</div>
      <div class="draft-box">${esc(c.draft.text)}</div>
      <p class="draft-meta">Sent Jul 2, 2026, 10:05 AM · approved by Maya Torres</p>`;
  } else if (stageName === "Respond") {
    body = `${state.lowConfidence ? `<div class="held">⚠ Draft held — the AI's categorization is
        below the confidence threshold. Review the assessment above before sending.</div>` : ""}
      <div class="draft-box">${esc(c.draft.text)}</div>
      <p class="draft-meta">Drafted by ${c.draft.generatedBy} · ${c.draft.generatedAt} · edits are tracked</p>
      <div class="decide">
        <button class="btn-quiet">Edit draft</button>
        <button class="btn-quiet">Regenerate</button>
      </div>`;
  } else if (stageName === "Review") {
    body = `<p style="color:var(--muted)">Confirm the intake details and the AI's categorization
      above, then move the case to Investigate.</p>`;
  } else if (stageName === "Investigate") {
    body = `<p style="color:var(--muted)">Records pulled by the Zanko agent — transaction detail,
      call logs, and the customer's dispute history are attached and summarized in the timeline.
      Generate the draft response when the facts are confirmed.</p>`;
  }
  $("#workspace").innerHTML = `
    <h2>${stageName === "Respond" ? "Draft response" : stageName + " workspace"}
      <span class="sub">the work of the current stage, front and center</span></h2>
    ${body}
    <span class="dnote">The current stage's work, front and center — not in a tab (R7)</span>`;
}

function renderTimeline() {
  const all = state.c.timeline
    .filter((t) => state.tlFilter === "all" || t.kind === state.tlFilter)
    .slice().reverse();
  const items = state.tlOpen ? all : all.slice(0, 2);
  const icon = { ai: "✦", comment: "💬", audit: "🔒" };
  $("#timeline").innerHTML = `
    <h2>Activity <span class="sub">one history: analyst, AI, and system — filter, don't hunt</span></h2>
    ${state.tlOpen ? `<div class="tl-filters">
      ${["all", "comment", "ai", "audit"].map((f) =>
        `<button class="${state.tlFilter === f ? "on" : ""}" onclick="state.tlFilter='${f}';render()">
          ${{ all: "All", comment: "Comments", ai: "AI actions", audit: "Audit" }[f]}</button>`).join("")}
    </div>` : ""}
    ${items.map((t) => `
      <div class="tl-item">
        <div class="tl-icon ${t.kind}">${icon[t.kind]}</div>
        <div><div>${t.text}</div><div class="meta">${t.who} · ${t.at}</div></div>
      </div>`).join("")}
    ${!state.tlOpen && all.length > 2 ? `<button class="show-more-tl" onclick="state.tlOpen=true;render()">Show all ${all.length} entries ▾</button>` : ""}
    <div class="comment-box"><input placeholder="Add a comment…"><button class="btn-quiet">Post</button></div>
    <span class="dnote">One auditable history: analyst, AI, system (R8)</span>`;
}

function renderRail() {
  const c = state.c;
  $("#rail").innerHTML = `
    <div class="panel">
      <h2>Case details</h2>
      <div class="field"><label>Owner</label>${c.owner}</div>
      <div class="field"><label>Received</label>${c.received} · ${c.channel} (${c.source})</div>
      <div class="field"><label>Customer ID</label>${c.customer.customerId}</div>
      <div class="field"><label>Customer email</label>${c.customer.email}</div>
      <div class="field"><label>Attachments</label><a href="#" onclick="return false" style="color:var(--purple)">dispute-form.pdf</a> · <a href="#" onclick="return false" style="color:var(--purple)">txn-record.csv</a></div>
      <div class="field"><label>Tags</label>${c.tags.map((t) => `<span class="chip">${t}</span>`).join(" ")} <span class="chip">+ Add</span></div>
      <span class="dnote">Reference data grouped by meaning, each field once (R9)</span>
    </div>
    <div class="panel">
      <h2>Customer history</h2>
      ${c.related.map((r) => `
        <div class="field"><label>${r.id}</label>${r.note}<br>
        <span style="color:var(--muted);font-size:12px">Received ${r.received} · resolved ${r.resolved}</span></div>`).join("")}
      <div class="field"><a href="#" onclick="return false" style="color:var(--purple)">View related conversation →</a></div>
    </div>`;
}

function renderDemoBar() {
  $("#demo-scenarios").innerHTML = Object.entries(SCENARIOS).map(([k, s]) =>
    `<button class="${state.scenario === k ? "on" : ""}" onclick="setScenario('${k}')">${s.label}</button>`).join("");
}

function render() {
  document.body.classList.toggle("readonly", state.scenario === "resolved");
  renderHeader(); renderComplaint(); renderAssessment();
  renderWorkspace(); renderTimeline(); renderRail(); renderDemoBar();
}

// Design-notes toggle: shows the purple pins that map each element
// back to the requirement it serves (see task1.html for the R# table).
function toggleNotes(btn) {
  document.body.classList.toggle("show-notes");
  btn.classList.toggle("on");
}

render();
