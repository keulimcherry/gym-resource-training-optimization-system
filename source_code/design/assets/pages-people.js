(function () {
  "use strict";
  const S = window.Store, U = window.UI, A = window.App;
  const { esc, rs, rsK, fdate, fshort, ftime, dayLabel, initials, ico, plural } = U;
  const { header, kpi, memberName, trainerName, statusTag, SESSION_TAG, ATT_TAG, paymentFor } = A;

  function revenueMonths(n = 6) {
    return Array.from({ length: n }, (_, i) => {
      const from = S.monthStart(i - n + 1), to = S.addDays(S.monthStart(i - n + 2), -1);
      return { label: S.parse(from).toLocaleDateString("en-GB", { month: "short" }), value: S.revenueIn(from, to) };
    });
  }
  function scheduleToday(filterTrainer) {
    const items = [];
    S.occurrencesOn(S.TODAY).forEach(o => { const c = S.get("ClassSchedule", o.class_id); if (!filterTrainer || c.trainer_id === filterTrainer) items.push([o.start_time, c.class_name, `${trainerName(c.trainer_id)} · ${c.duration_minutes} min`]); });
    S.sessionsOn(S.TODAY).forEach(s => { const e = S.get("PersonalTrainingEnrollment", s.pt_enrollment_id), tr = S.sessionTrainer(s); if (!filterTrainer || tr === filterTrainer) items.push([s.time_slot, `PT · ${memberName(e.member_id)}`, `${trainerName(tr)} · ${s.status}`]); });
    const nowHM = S.stamp(S.now()).slice(11);
    items.sort((a, b) => a[0].localeCompare(b[0]));
    const nextIdx = items.findIndex(i => i[0] >= nowHM);
    return items.length ? `<div class="tl">${items.map(([t, w, s], i) => `<div class="tl-item${i === nextIdx ? " now" : ""}"><time>${ftime(t)}</time><div><b>${esc(w)}</b><span>${esc(s)}</span></div></div>`).join("")}</div>` : `<div class="empty"><b>Quiet day</b>Nothing scheduled today.</div>`;
  }
  function duesList(limit = 5) {
    const rows = S.all("Member").map(m => [m, S.memberOwed(m.member_id)]).filter(([, o]) => o > 0).sort((a, b) => b[1] - a[1]).slice(0, limit);
    return rows.length ? rows.map(([m, o]) => {
      const cur = S.latestMembership(m.member_id);
      return `<a class="row" href="#/members/${m.member_id}?tab=payments"><div class="pic">${esc(initials(m.name))}</div><div class="who"><b>${esc(m.name)}</b><span>${cur ? esc(S.planOf(cur).plan_type) : "No plan"}${S.activePT(m.member_id) ? " + PT" : ""}</span></div><span class="amt owed">${rs(o)}</span></a>`;
    }).join("") : `<div class="empty"><b>All paid up</b>Nobody owes anything.</div>`;
  }
  function leadsList(limit = 3) {
    const leads = S.where("Lead", l => l.status === "New").sort((a, b) => b.submitted_date.localeCompare(a.submitted_date)).slice(0, limit);
    return leads.length ? leads.map(l => `<a class="row" href="#/leads"><div class="pic">${esc(initials(l.name))}</div><div class="who"><b>${esc(l.name)}</b><span>${esc(l.interest)} · ${U.rel(l.submitted_date)}</span></div><span class="tag y">New</span></a>`).join("") : `<div class="empty"><b>No new leads</b>Website enquiries land here.</div>`;
  }
  function staffDashboard() {
    const role = S.session.role;
    const active = S.all("Member").filter(m => S.currentMembership(m.member_id)).length;
    const owing = S.all("Member").filter(m => S.memberOwed(m.member_id) > 0).length;
    const checkinsToday = S.where("CheckIn", c => c.check_in_time.startsWith(S.TODAY)).length;
    const month = S.revenueIn(S.monthStart(0), S.TODAY), last = S.revenueIn(S.monthStart(-1), S.addDays(S.monthStart(0), -1));
    const expiring = S.all("Member").map(m => [m, S.currentMembership(m.member_id)]).filter(([, ms]) => ms && S.daysBetween(S.TODAY, ms.end_date) <= 7);
    return {
      html: `${header(`Good ${greet()}, ${S.session.user.display_name.split(" ")[0]}`, { actions: `${S.can("checkin") ? `<a class="btn btn-ghost" href="#/attendance?tab=checkin">${ico("door")}Check-in desk</a>` : ""}${S.can("member.create") ? `<button class="btn btn-yellow" data-act="add-member">${ico("plus")}Add member</button>` : ""}` })}
      <section class="kpis">
        ${kpi({ label: "Training right now", value: S.insideNow().length, delta: `<span class="up">${checkinsToday} check-ins today</span>`, cls: "dark", icon: "users", live: true, href: "/attendance?tab=checkin" })}
        ${kpi({ label: "Active members", value: active, delta: `${expiring.length} ending this week`, icon: "user", href: "/members?status=active" })}
        ${S.can("revenue.view") ? kpi({ label: "Collected this month", value: rsK(month), delta: `<span class="${month >= last ? "up" : "down"}">${month >= last ? "▲" : "▼"}</span> vs ${rs(last)} last month`, icon: "money", href: "/payments" })
          : kpi({ label: "PT sessions today", value: S.sessionsOn(S.TODAY).length, delta: `${S.occurrencesOn(S.TODAY).length} group classes`, icon: "dumbbell", href: "/pt?tab=schedule" })}
        ${kpi({ label: "Still owed (all)", value: rsK(S.owedTotal()), delta: `${owing} members with dues`, cls: "alert", icon: "inbox", href: "/payments?tab=dues" })}
      </section>
      <div class="grid g-2-1">
        ${A.attendanceCard()}
        <div class="stack">
          <section class="card fade"><div class="card-head"><h2>Dues to collect</h2><a href="#/payments?tab=dues">All dues →</a></div>${duesList()}</section>
          ${S.can("leads.manage") ? `<section class="card fade"><div class="card-head"><div><h2>New leads</h2><div class="sub">From the website "Get started" form</div></div><a href="#/leads">Leads →</a></div>${leadsList()}</section>` : ""}
        </div>
      </div>
      <div class="grid g-1-1">
        ${S.can("revenue.view") ? `<section class="card fade"><div class="card-head"><div><h2>Revenue</h2><div class="sub">Valid payments per month</div></div><a href="#/reports">Reports →</a></div>${U.bars(revenueMonths(), { fmt: v => (v / 1000).toFixed(0) + "k" })}<div class="chart-foot"><div><b>${rs(revenueMonths().reduce((s, d) => s + d.value, 0))}</b>Last 6 months</div><div><b>${rs(S.owedTotal())}</b>Still owed</div></div></section>`
          : `<section class="card fade"><div class="card-head"><div><h2>Memberships ending soon</h2><div class="sub">Next 7 days: remind them to renew</div></div></div>${expiring.length ? expiring.map(([m, ms]) => `<a class="row" href="#/members/${m.member_id}"><div class="pic">${esc(initials(m.name))}</div><div class="who"><b>${esc(m.name)}</b><span>${esc(S.planOf(ms).plan_type)} · ends ${fdate(ms.end_date)}</span></div>${statusTag(m.member_id)}</a>`).join("") : `<div class="empty"><b>None this week</b></div>`}</section>`}
        <section class="card fade"><div class="card-head"><h2>Today's schedule</h2><a href="#/classes">Classes →</a></div>${scheduleToday()}</section>
      </div>`,
      after: () => { A.wireSearch(); A.ATT.date = S.TODAY; A.renderAtt(); }
    };
  }
  function accountantDashboard() {
    const month = S.revenueIn(S.monthStart(0), S.TODAY), today = S.revenueIn(S.TODAY, S.TODAY);
    const voids = S.where("Payment", p => p.status === "void");
    const recent = S.all("Payment").slice().sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.payment_id - a.payment_id).slice(0, 8);
    const audits = S.all("AuditLog").slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
    return {
      html: `${header(`Good ${greet()}, ${S.session.user.display_name.split(" ")[0]}`, { actions: `<button class="btn btn-yellow" data-act="pay-new">${ico("plus")}Record payment</button>` })}
      <section class="kpis">
        ${kpi({ label: "Collected today", value: rsK(today), delta: `${S.where("Payment", p => p.payment_date === S.TODAY && p.status === "valid").length} payments`, cls: "dark", icon: "money" })}
        ${kpi({ label: "Collected this month", value: rsK(month), delta: "valid payments only", icon: "chart", href: "/reports" })}
        ${kpi({ label: "Still owed (all)", value: rsK(S.owedTotal()), delta: `${S.all("Member").filter(m => S.memberOwed(m.member_id) > 0).length} members`, cls: "alert", icon: "inbox", href: "/payments?tab=dues" })}
        ${kpi({ label: "Voided payments", value: voids.length, delta: "kept on record, never deleted", icon: "shield", href: "/audit" })}
      </section>
      <div class="grid g-2-1">
        <section class="card fade"><div class="card-head"><h2>Latest payments</h2><a href="#/payments">All payments →</a></div>
          ${U.table({ rows: recent, rowCls: p => p.status === "void" ? "voided" : "", cols: [
            { label: "Date", html: p => fshort(p.payment_date) },
            { label: "Member", html: p => `<a href="#/members/${p.member_id}?tab=payments">${esc(memberName(p.member_id))}</a>` },
            { label: "For", html: p => esc(paymentFor(p)) },
            { label: "Amount", cls: "num", html: p => `<span class="amt${p.status === "void" ? " void" : ""}">${rs(p.amount)}</span>` },
            { label: "", cls: "num", html: p => `<div class="acts">${A.paymentActions(p)}</div>` }] })}</section>
        <div class="stack">
          <section class="card fade"><div class="card-head"><h2>Biggest dues</h2><a href="#/payments?tab=dues">All →</a></div>${duesList(5)}</section>
          <section class="card fade"><div class="card-head"><h2>Recent changes</h2><a href="#/audit">Audit log →</a></div>${audits.map(a => `<div class="row"><div class="pic">${esc(initials(A.userName(a.user_id)))}</div><div class="who"><b>${esc(A.userName(a.user_id))} · ${esc(a.action)} ${esc(a.table_name)} #${a.record_id}</b><span>${U.rel(a.created_at)}${a.reason ? " · " + esc(a.reason) : ""}</span></div></div>`).join("")}</section>
        </div>
      </div>`,
      after: () => A.wireSearch()
    };
  }
  function trainerDashboard() {
    const tid = S.myTrainerId();
    const mine = S.where("PersonalTrainingEnrollment", e => e.trainer_id === tid);
    const myIds = mine.map(e => e.pt_enrollment_id);
    const weekAgo = S.addDays(S.TODAY, -7);
    const done = S.where("Session", s => S.sessionTrainer(s) === tid && s.status === "Completed" && s.session_date >= weekAgo).length;
    const todays = S.sessionsOn(S.TODAY).filter(s => S.sessionTrainer(s) === tid);
    const reqs = S.where("Session", s => myIds.includes(s.pt_enrollment_id) && s.status === "Requested");
    const clients = S.clientIdsOf(tid);
    const nowHM = S.stamp(S.now()).slice(11), next = todays.find(s => s.time_slot >= nowHM);
    return {
      html: `${header(`Good ${greet()}, ${S.session.user.display_name.split(" ")[0]}`, { actions: `<button class="btn btn-yellow" data-act="prog-new">${ico("plus")}Log progress</button>` })}
      <section class="kpis">
        ${kpi({ label: "My sessions today", value: todays.length, delta: next ? `Next at ${ftime(next.time_slot)}` : "All done for today", cls: "dark", icon: "cal", live: true })}
        ${kpi({ label: "My PT clients", value: clients.length, delta: "active enrollments", icon: "users", href: "/clients" })}
        ${kpi({ label: "Completed (7 days)", value: done, delta: "sessions", icon: "check", href: "/pt?tab=schedule" })}
        ${kpi({ label: "Session requests", value: reqs.length, delta: reqs.length ? "waiting for you" : "none waiting", cls: reqs.length ? "alert" : "", icon: "inbox", href: "/pt?tab=requests" })}
      </section>
      <div class="grid g-2-1">
        ${A.attendanceCard()}
        <div class="stack">
          <section class="card fade"><div class="card-head"><h2>Session requests</h2><a href="#/pt?tab=requests">All →</a></div>${reqs.length ? reqs.map(s => { const e = S.get("PersonalTrainingEnrollment", s.pt_enrollment_id); return `<div class="row"><div class="pic">${esc(initials(memberName(e.member_id)))}</div><div class="who"><b>${esc(memberName(e.member_id))}</b><span>${dayLabel(s.session_date)} · ${ftime(s.time_slot)}</span></div><button class="btn btn-ink btn-xs" data-act="req-accept" data-id="${s.session_id}">Accept</button></div>`; }).join("") : `<div class="empty"><b>No requests</b></div>`}</section>
          <section class="card fade"><div class="card-head"><h2>My clients</h2><a href="#/clients">All →</a></div>${clients.map(mid => clientRow(mid)).join("")}</section>
        </div>
      </div>
      <section class="card fade"><div class="card-head"><h2>My day</h2></div>${scheduleToday(tid)}</section>`,
      after: () => { A.wireSearch(); A.ATT.date = S.TODAY; A.renderAtt(); }
    };
  }
  function clientRow(mid) {
    const last = S.progressOf(mid).find(r => r.source === "trainer");
    const stale = !last || S.daysBetween(last.record_date, S.TODAY) > 14;
    return `<a class="row" href="#/members/${mid}?tab=progress"><div class="pic">${esc(initials(memberName(mid)))}</div><div class="who"><b>${esc(memberName(mid))}</b><span>${last ? `Last log ${U.rel(last.record_date + " 12:00")}${last.weight ? " · " + last.weight + " kg" : ""}` : "No logs yet"}</span></div><span class="tag ${stale ? "r" : "g"}">${stale ? "Log due" : "On track"}</span></a>`;
  }
  function memberDashboard() {
    const mid = S.myMemberId(), m = S.get("Member", mid);
    const cur = S.currentMembership(mid) || S.latestMembership(mid);
    const pt = S.activePT(mid);
    const owed = S.memberOwed(mid);
    const left = cur ? Math.max(0, S.daysBetween(S.TODAY, cur.end_date)) : 0;
    const total = cur ? S.daysBetween(cur.start_date, cur.end_date) : 1;
    const ws = S.progressOf(mid).filter(r => r.weight != null).sort((a, b) => a.record_date.localeCompare(b.record_date));
    const change = ws.length > 1 ? +(ws[ws.length - 1].weight - ws[0].weight).toFixed(1) : null;
    const visits = S.where("CheckIn", c => c.member_id === mid && c.check_in_time >= S.monthStart(0)).length;
    const upcoming = pt ? S.sessionsOf(pt.pt_enrollment_id).filter(s => s.session_date >= S.TODAY && (s.status === "Scheduled" || s.status === "Requested")).slice(0, 4) : [];
    const classes30 = S.where("ClassAttendance", a => a.member_id === mid && a.status === "Attended").length;
    const ver = pt ? S.currentVersion(pt.pt_enrollment_id) : null;
    return {
      html: `${header(`Hi ${m.name.split(" ")[0]}`, { actions: `<button class="btn btn-ghost" data-act="prog-new">${ico("pen")}Journal entry</button>${pt ? `<button class="btn btn-yellow" data-act="req-session">${ico("cal")}Request a session</button>` : ""}` })}
      <section class="hero-card fade">
        <div class="ring" style="--p:${cur ? Math.round(left / total * 100) : 0}"><div><div><b>${left}</b><span>days left</span></div></div></div>
        <div><div class="kicker">Your membership</div><h2>${cur ? esc(S.planOf(cur).plan_type) : "No active plan"}</h2><p>${cur ? `${fdate(cur.start_date)} – ${fdate(cur.end_date)}` : "Talk to the front desk to start a plan."}${pt ? ` · Personal training with ${esc(trainerName(pt.trainer_id))}` : ""}</p></div>
        <div class="due-box"><span>Amount due</span><b>${rs(owed)}</b><small>${owed ? "Pay at the front desk: cash, card or mobile banking" : "You're all paid up 🎉"}</small></div>
      </section>
      <section class="kpis">
        ${kpi({ label: "Weight change", value: change == null ? "—" : `${change > 0 ? "+" : ""}${change} kg`, delta: ws.length ? `since ${fdate(ws[0].record_date)}` : "add your first weigh-in", cls: "dark", icon: "trend", href: "/me/progress" })}
        ${kpi({ label: "Visits this month", value: visits, delta: "check-ins at the desk", icon: "check" })}
        ${kpi({ label: "Training plan", value: ver ? "v" + ver.version_number : "—", delta: ver ? `since ${fdate(ver.created_date)}` : "no PT plan", icon: "flag", href: "/me/progress?filter=plan" })}
        ${kpi({ label: "Classes attended", value: classes30, delta: "last 4 weeks", icon: "users", href: "/me/classes" })}
      </section>
      <div class="grid g-2-1">
        <section class="card fade"><div class="card-head"><div><h2>My progress</h2><div class="sub">Black dots: coach logs · Yellow dots: your journal · Blue lines: new plan versions</div></div><a href="#/me/progress">Full history →</a></div>
          <div class="line-chart">${A.progressChart(mid)}</div>${A.journalHtml(mid, "all", { limit: 3 })}</section>
        <div class="stack">
          <section class="card fade"><div class="card-head"><h2>Coming up</h2><a href="#/me/sessions">Sessions →</a></div>${upcoming.length ? `<div class="tl">${upcoming.map((s, i) => `<div class="tl-item${i === 0 ? " now" : ""}"><time>${dayLabel(s.session_date)}</time><div><b>PT with ${esc(trainerName(pt.trainer_id))}</b><span>${ftime(s.time_slot)} · ${s.status === "Requested" ? "waiting for your coach to confirm" : "confirmed"}</span></div></div>`).join("")}</div>` : `<div class="empty"><b>Nothing booked</b>${pt ? "Request a session with your coach." : "Check the class timetable."}</div>`}</section>
          ${pt ? tcCard(pt) : ""}
          ${ver ? `<section class="card fade"><div class="card-head"><h2>Current plan · v${ver.version_number}</h2></div><div class="card-body"><div class="plan-text" style="background:var(--white);border-radius:10px;padding:14px">${esc(ver.details)}</div></div></section>` : ""}
        </div>
      </div>`
    };
  }
  const greet = () => { const h = S.now().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };
  A.route("/", null, () => ({ owner: staffDashboard, front_desk: staffDashboard, accountant: accountantDashboard, trainer: trainerDashboard, member: memberDashboard }[S.session.role])());

  const FILTERS = [["all", "All"], ["active", "Active"], ["ending", "Ending soon"], ["expired", "Expired"], ["owing", "Owes money"], ["pt", "PT clients"]];
  function membersPage(_, q) {
    if (S.session.role === "trainer") return "/clients";
    const status = q.status || "all", trainer = q.trainer ? +q.trainer : null;
    const visits = {};
    S.all("CheckIn").forEach(c => { if (!visits[c.member_id] || c.check_in_time > visits[c.member_id]) visits[c.member_id] = c.check_in_time; });
    let rows = S.all("Member").slice().sort((a, b) => a.name.localeCompare(b.name));
    const counts = {};
    FILTERS.forEach(([k]) => counts[k] = rows.filter(m => matchStatus(m, k)).length);
    rows = rows.filter(m => matchStatus(m, status) && (!trainer || S.enrollmentsOf(m.member_id).some(e => e.trainer_id === trainer)));
    return {
      html: `${header("Members", { kicker: `${S.all("Member").length} members${trainer ? " · clients of " + trainerName(trainer) : ""}`, actions: S.can("member.create") ? `<button class="btn btn-yellow" data-act="add-member">${ico("plus")}Add member</button>` : "" })}
      <section class="card fade">
        <div class="card-head"><div class="tabs">${FILTERS.map(([k, l]) => `<a href="#/members?status=${k}${trainer ? "&trainer=" + trainer : ""}" class="${k === status ? "on" : ""}">${l} <span class="n">${counts[k]}</span></a>`).join("")}</div>
          <label class="search">${ico("search")}<span class="sr">Filter</span><input id="mfilter" placeholder="Filter by name, phone or email"></label></div>
        <div id="mtable">${membersTable(rows, visits)}</div>
        <div class="tbl-foot"><span>${plural(rows.length, "member")}</span>${trainer ? `<a href="#/members" class="card-link">Clear trainer filter</a>` : ""}</div>
      </section>`,
      after: () => {
        A.wireSearch();
        const f = document.getElementById("mfilter");
        f.addEventListener("input", () => {
          const t = f.value.trim().toLowerCase();
          document.getElementById("mtable").innerHTML = membersTable(rows.filter(m => !t || m.name.toLowerCase().includes(t) || m.contact_number.includes(t) || m.email.toLowerCase().includes(t)), visits);
        });
      }
    };
  }
  function matchStatus(m, k) {
    const s = S.memberStatus(m.member_id).key;
    return k === "all" || (k === "active" && (s === "active" || s === "ending")) || (k === "ending" && s === "ending") || (k === "expired" && s === "expired")
      || (k === "owing" && S.memberOwed(m.member_id) > 0) || (k === "pt" && !!S.activePT(m.member_id));
  }
  function membersTable(rows, visits) {
    return U.table({ rows, href: m => `/members/${m.member_id}`, empty: "No members match", cols: [
      { label: "Member", html: m => U.who(m.name, esc(m.contact_number)) },
      { label: "Plan", html: m => { const ms = S.currentMembership(m.member_id) || S.latestMembership(m.member_id); return ms ? `${esc(S.planOf(ms).plan_type)}<br><small class="muted">until ${fdate(ms.end_date)}</small>` : '<span class="muted">—</span>'; } },
      { label: "Status", html: m => statusTag(m.member_id) },
      { label: "Trainer", html: m => { const pt = S.activePT(m.member_id); return pt ? esc(trainerName(pt.trainer_id)) : '<span class="muted">—</span>'; } },
      ...(S.can("dues.view") ? [{ label: "Owes", cls: "num", html: m => { const o = S.memberOwed(m.member_id); return o ? `<span class="amt owed">${rs(o)}</span>` : '<span class="muted">—</span>'; } }] : []),
      { label: "Last visit", html: m => visits[m.member_id] ? U.rel(visits[m.member_id]) : '<span class="muted">never</span>' }
    ] });
  }
  A.route("/members", "member.view", membersPage);

  A.route("/clients", () => S.session.role === "trainer", () => {
    const tid = S.myTrainerId();
    const ens = S.where("PersonalTrainingEnrollment", e => e.trainer_id === tid && (!e.end_date || e.end_date >= S.TODAY));
    return {
      html: `${header("My clients", { kicker: `${ens.length} active PT clients`, actions: `<button class="btn btn-yellow" data-act="prog-new">${ico("plus")}Log progress</button>` })}
      <section class="card fade">${U.table({ rows: ens, href: e => `/members/${e.member_id}?tab=progress`, cols: [
        { label: "Client", html: e => U.who(memberName(e.member_id), esc(e.goal)) },
        { label: "Since", html: e => fdate(e.start_date) },
        { label: "Plan", html: e => { const v = S.currentVersion(e.pt_enrollment_id); return v ? `<span class="tag k">v${v.version_number}</span> <small class="muted">${fshort(v.created_date)}</small>` : "—"; } },
        { label: "Last log", html: e => { const r = S.progressOf(e.member_id).find(x => x.source === "trainer"); return r ? `${U.rel(r.record_date + " 12:00")}${r.weight ? ` · ${r.weight} kg` : ""}` : '<span class="down">none</span>'; } },
        { label: "Next session", html: e => { const s = S.sessionsOf(e.pt_enrollment_id).find(x => x.session_date >= S.TODAY && x.status === "Scheduled"); return s ? `${dayLabel(s.session_date)} · ${ftime(s.time_slot)}` : "—"; } },
        { label: "", cls: "num", html: e => `<div class="acts"><button class="btn btn-ghost btn-xs" data-act="prog-new" data-id="${e.member_id}">Log</button>${A.canWritePlan(e) ? `<button class="btn btn-ghost btn-xs" data-act="plan-new" data-id="${e.pt_enrollment_id}">New version</button>` : ""}</div>` }
      ] })}</section>`,
      after: A.wireSearch
    };
  });

  function memberDetail(id, q, { portal } = {}) {
    const m = S.get("Member", id);
    if (!m) return { html: `${header("Member not found")}<div class="card empty fade"><b>No member #${esc(id)}</b></div>` };
    const mid = m.member_id;
    const self = S.session.role === "member";
    const inside = S.insideNow().find(c => c.member_id === mid);
    const cur = S.currentMembership(mid), last = S.latestMembership(mid), pt = S.activePT(mid);
    const owed = S.memberOwed(mid);
    const showMoney = S.can("dues.view") || S.can("payment.view") || self;
    const visits30 = S.where("CheckIn", c => c.member_id === mid && c.check_in_time >= S.addDays(S.TODAY, -30)).length;
    const ver = pt ? S.currentVersion(pt.pt_enrollment_id) : null;
    const TABS = [["overview", "Overview"], ["progress", "Progress & journal"], ["plans", "Training plans"], ["sessions", "Sessions"], ["attendance", "Attendance"], ...(showMoney ? [["payments", "Payments"]] : [])];
    const tab = TABS.some(t => t[0] === q.tab) ? q.tab : portal || "overview";
    const base = portal ? null : `/members/${mid}`;
    const actions = portal ? "" : [
      S.can("checkin") ? (inside ? `<button class="btn btn-line" data-act="check-out" data-id="${mid}">${ico("door")}Check out</button>` : `<button class="btn btn-yellow" data-act="check-in" data-id="${mid}">${ico("door")}Check in</button>`) : "",
      S.can("payment.create") ? `<button class="btn btn-line" data-act="pay-new" data-id="${mid}">${ico("money")}Record payment</button>` : "",
      S.can("membership.create") ? `<button class="btn btn-line" data-act="add-plan" data-id="${mid}">${ico("plus")}Add plan / PT</button>` : "",
      S.can("progress.create") ? `<button class="btn btn-line" data-act="prog-new" data-id="${mid}">${ico("clip")}Log progress</button>` : "",
      S.can("member.edit") ? `<button class="btn btn-line" data-act="member-edit" data-id="${mid}">${ico("pen")}Edit details</button>` : ""
    ].filter(Boolean).join("");

    const top = portal ? header({ progress: "My progress", payments: "Payments", sessions: "Sessions" }[portal] || "Me", { kicker: m.name })
      : `${header(m.name, { crumbs: `<a href="#${S.session.role === "trainer" ? "/clients" : "/members"}">${S.session.role === "trainer" ? "My clients" : "Members"}</a> / #${mid}` })}
      <section class="profile fade">
        <div class="big-av">${esc(initials(m.name))}</div>
        <div><div class="kicker">Member #${mid} · joined ${fdate(m.joined_date)}${inside ? ' · <span style="color:var(--live)">● in the gym now</span>' : ""}</div><h1>${esc(m.name)}</h1>
          <div class="meta"><span>${ico("phone")}${esc(m.contact_number)}</span><span>${ico("mail")}${esc(m.email)}</span>${statusTag(mid)}${pt ? `<span>${ico("dumbbell")}PT with ${esc(trainerName(pt.trainer_id))}</span>` : ""}</div></div>
        <div class="profile-acts">${actions}</div>
      </section>
      <section class="facts">
        <div class="card fact fade"><div class="label">Membership</div><b>${cur ? esc(S.planOf(cur).plan_type) : last ? "Expired" : "None"}</b><span>${cur ? `${S.daysBetween(S.TODAY, cur.end_date)} days left · until ${fdate(cur.end_date)}` : last ? `ended ${fdate(last.end_date)}` : "no plan yet"}</span></div>
        <div class="card fact fade"><div class="label">Personal training</div><b>${pt ? esc(trainerName(pt.trainer_id)) : "—"}</b><span>${ver ? `Plan v${ver.version_number} · since ${fdate(pt.start_date)}` : "not enrolled"}</span></div>
        ${showMoney ? `<div class="card fact fade ${owed ? "alert" : "good"}"><div class="label">Amount due</div><b>${rs(owed)}</b><span>${owed ? "across membership & PT" : "all paid up"}</span></div>` : `<div class="card fact fade"><div class="label">Goal</div><b style="font-size:15px">${pt ? esc(pt.goal) : "—"}</b><span></span></div>`}
        <div class="card fact fade"><div class="label">Visits · 30 days</div><b>${visits30}</b><span>${inside ? "checked in now" : "check-ins"}</span></div>
      </section>`;

    const tabsBar = portal ? "" : `<div class="tabs page-tabs fade" role="tablist">${TABS.map(([k, l]) => `<a href="#${base}?tab=${k}" class="${k === tab ? "on" : ""}" role="tab" aria-selected="${k === tab}">${l}</a>`).join("")}</div>`;
    return { html: `${top}${tabsBar}${TABVIEWS[tab](m, q)}`, after: () => { A.wireSearch(); const f = document.querySelectorAll("[data-jfilter]"); f.forEach(b => b.addEventListener("click", () => { f.forEach(x => x.setAttribute("aria-pressed", x === b)); document.getElementById("journal").innerHTML = A.journalHtml(mid, b.dataset.jfilter); })); } };
  }

  const TABVIEWS = {
    overview(m) {
      const mid = m.member_id;
      const showMed = S.can("member.medical") || S.myMemberId() === mid;
      const showMoney = S.can("dues.view") || S.can("payment.view") || S.myMemberId() === mid;
      const ens = S.enrollmentsOf(mid);
      return `<div class="grid g-1-1">
        <div class="stack">
          <section class="card fade"><div class="card-head"><h2>Details</h2></div><dl class="kv">
            <dt>Phone</dt><dd>${esc(m.contact_number)}</dd><dt>Email</dt><dd>${esc(m.email)}</dd><dt>Joined</dt><dd>${fdate(m.joined_date)}</dd>
            <dt>Medical history</dt><dd>${showMed ? (m.medical_history ? esc(m.medical_history) : '<span class="muted">Nothing recorded</span>') : `<div class="lock">${ico("lock")}Hidden for your role</div>`}</dd></dl></section>
          <section class="card fade"><div class="card-head"><h2>Membership history</h2></div>${U.table({ rows: S.membershipsOf(mid), empty: "No memberships", cols: [
            { label: "Plan", html: ms => esc(S.planOf(ms).plan_type) },
            { label: "Period", html: ms => `${fshort(ms.start_date)} – ${fdate(ms.end_date)}` },
            ...(showMoney ? [{ label: "Price", cls: "num", html: ms => rs(ms.agreed_price) }, { label: "Owes", cls: "num", html: ms => { const o = S.membershipOwed(ms.membership_id); return o ? `<span class="amt owed">${rs(o)}</span>` : '<span class="tag g">Paid</span>'; } }] : []),
            { label: "", html: ms => ms.end_date < S.TODAY ? '<span class="tag">Ended</span>' : ms.start_date > S.TODAY ? '<span class="tag b">Upcoming</span>' : '<span class="tag g">Current</span>' }] })}</section>
        </div>
        <div class="stack">
          ${ens.length ? ens.map(e => { const v = S.currentVersion(e.pt_enrollment_id); const done = S.sessionsOf(e.pt_enrollment_id).filter(s => s.status === "Completed").length; return `<section class="card fade"><div class="card-head"><div><h2>Personal training</h2><div class="sub">since ${fdate(e.start_date)}${S.can("pt.assign") && S.pendingChange(e.pt_enrollment_id) ? ' · <a class="tag y" style="text-decoration:none" href="#/pt?tab=changes">Asked to change trainer</a>' : ""}</div></div>${S.can("pt.assign") ? `<button class="btn btn-ghost btn-sm" data-act="pt-trainer" data-id="${e.pt_enrollment_id}">Change trainer</button>` : ""}</div><dl class="kv">
            <dt>Trainer</dt><dd>${esc(trainerName(e.trainer_id))}</dd><dt>Goal</dt><dd>${esc(e.goal)}</dd><dt>Plan</dt><dd>${v ? `v${v.version_number} · ${fdate(v.created_date)}` : "—"}</dd><dt>Sessions done</dt><dd>${done}</dd>
            ${showMoney ? `<dt>Fee</dt><dd>${rs(e.fee)} · ${S.ptOwed(e.pt_enrollment_id) ? `<span class="down">owes ${rs(S.ptOwed(e.pt_enrollment_id))}</span>` : '<span class="up">paid</span>'}</dd>` : ""}</dl></section>`; }).join("")
            : `<section class="card fade"><div class="empty"><b>No personal training</b>${S.can("pt.create") ? `<p style="margin-top:12px"><button class="btn btn-ink btn-sm" data-act="add-pt" data-id="${mid}">Enroll in PT</button></p>` : ""}</div></section>`}
          <section class="card fade"><div class="card-head"><h2>Latest in the journal</h2><a href="#/members/${mid}?tab=progress">Full history →</a></div>${A.journalHtml(mid, "all", { limit: 3 })}</section>
        </div></div>`;
    },
    progress(m, q) {
      const mid = m.member_id;
      const recs = S.progressOf(mid);
      const ws = recs.filter(r => r.weight != null).sort((a, b) => a.record_date.localeCompare(b.record_date));
      const strength = recs.filter(r => r.strength_metric).sort((a, b) => a.record_date.localeCompare(b.record_date));
      const pt = S.activePT(mid), ver = pt ? S.currentVersion(pt.pt_enrollment_id) : null;
      const change = ws.length > 1 ? +(ws[ws.length - 1].weight - ws[0].weight).toFixed(1) : null;
      const canAdd = S.can("progress.create") && (S.session.role !== "trainer" || S.clientIdsOf(S.myTrainerId()).includes(mid));
      const f = ["all", "trainer", "member", "plan", "mile"].includes(q.filter) ? q.filter : "all";
      return `<section class="facts">
        <div class="card fact fade"><div class="label">Weight</div><b>${ws.length ? ws[ws.length - 1].weight + " kg" : "—"}</b><span>${ws.length ? `started at ${ws[0].weight} kg` : "no weigh-ins yet"}</span></div>
        <div class="card fact fade ${change != null ? "good" : ""}"><div class="label">Change</div><b>${change == null ? "—" : `${change > 0 ? "+" : ""}${change} kg`}</b><span>${ws.length > 1 ? `over ${S.daysBetween(ws[0].record_date, ws[ws.length - 1].record_date)} days` : ""}</span></div>
        <div class="card fact fade"><div class="label">Strength</div><b style="font-size:16px">${strength.length ? esc(strength[strength.length - 1].strength_metric) : "—"}</b><span>${strength.length > 1 ? `from ${esc(strength[0].strength_metric)}` : ""}</span></div>
        <div class="card fact fade"><div class="label">Plan version</div><b>${ver ? "v" + ver.version_number : "—"}</b><span>${recs.filter(r => r.source === "trainer").length} coach logs · ${recs.filter(r => r.source === "member").length} journal entries</span></div>
      </section>
      <section class="card fade"><div class="card-head"><div><h2>Weight over time</h2><div class="sub">Every weigh-in from coach logs and the member's own journal</div></div>${canAdd ? `<button class="btn btn-yellow btn-sm" data-act="prog-new" data-id="${mid}">${ico("plus")}${S.session.role === "member" ? "Add journal entry" : "Log progress"}</button>` : ""}</div>
        <div class="line-chart">${A.progressChart(mid)}</div>
        <div class="lc-legend"><span><i style="background:var(--fg)"></i>Coach log</span><span><i style="background:var(--yellow);box-shadow:inset 0 0 0 2px var(--ink)"></i>Member journal</span><span><i style="background:var(--blue);border-radius:3px"></i>New plan version</span></div></section>
      <section class="card fade"><div class="card-head"><div><h2>Full history</h2><div class="sub">Coach logs, the member's journal, plan versions and milestones, newest first</div></div>
        <div class="chips">${[["all", "Everything"], ["trainer", "Coach logs"], ["member", "Member journal"], ["plan", "Plan versions"], ["mile", "Milestones"]].map(([k, l]) => `<button class="chip-f" data-jfilter="${k}" aria-pressed="${k === f}">${l}</button>`).join("")}</div></div>
        <div id="journal">${A.journalHtml(mid, f)}</div></section>`;
    },
    plans(m) {
      const ens = S.enrollmentsOf(m.member_id);
      if (!ens.length) return `<section class="card fade"><div class="empty"><b>No training plans</b>Plans are written by the trainer once the member enrolls in personal training.</div></section>`;
      return ens.map(e => `<section class="card fade"><div class="card-head"><div><h2>${esc(e.goal)}</h2><div class="sub">With ${esc(trainerName(e.trainer_id))} · since ${fdate(e.start_date)}</div></div>${A.canWritePlan(e) ? `<button class="btn btn-yellow btn-sm" data-act="plan-new" data-id="${e.pt_enrollment_id}">${ico("plus")}New version</button>` : ""}</div>
        ${U.table({ rows: S.versionsOf(e.pt_enrollment_id).slice().reverse(), cols: [
          { label: "Version", html: v => `<span class="tag ${v.is_current ? "k" : ""}">v${v.version_number}${v.is_current ? " · current" : ""}</span>` },
          { label: "Written", html: v => fdate(v.created_date) },
          { label: "Plan", html: v => esc(v.details) },
          { label: "Sessions on it", cls: "num", html: v => S.where("Session", s => s.plan_version_id === v.plan_version_id && s.status === "Completed").length }] })}</section>`).join("");
    },
    sessions(m) {
      const ens = S.enrollmentsOf(m.member_id);
      if (!ens.length) return `<section class="card fade"><div class="empty"><b>No PT sessions</b>This member isn't enrolled in personal training.</div></section>`;
      return ens.map(e => {
        const all = S.sessionsOf(e.pt_enrollment_id);
        const up = all.filter(s => s.session_date >= S.TODAY && s.status !== "Cancelled"), past = all.filter(s => s.session_date < S.TODAY).reverse().slice(0, 20);
        const can = S.can("session.manage") && A.visibleEnrollment(e.pt_enrollment_id);
        const t = rows => U.table({ rows, empty: "None", cols: [
          { label: "Date", html: s => `${dayLabel(s.session_date)} <small class="muted">${fdate(s.session_date)}</small>` },
          { label: "Time", html: s => ftime(s.time_slot) },
          { label: "Plan", html: s => { const v = S.get("TrainingPlan", s.plan_version_id); return v ? "v" + v.version_number : "—"; } },
          { label: "Status", html: s => `<span class="tag ${SESSION_TAG[s.status]}">${s.status}</span>` },
          ...(can ? [{ label: "", cls: "num", html: s => `<button class="btn btn-ghost btn-xs" data-act="sess-edit" data-id="${s.session_id}">Change</button>` }] : [])] });
        return `${window.Sched.seriesCards(e)}<section class="card fade"><div class="card-head"><div><h2>Upcoming with ${esc(trainerName(e.trainer_id))}</h2></div>${can ? `<button class="btn btn-ghost btn-sm" data-act="sess-new" data-id="${e.pt_enrollment_id}">${ico("plus")}One session</button>` : ""}</div>${t(up)}</section>
          <section class="card fade"><div class="card-head"><h2>Past sessions</h2><span class="muted">${all.filter(s => s.status === "Completed").length} completed · ${all.filter(s => s.status === "No-show").length} no-shows</span></div>${t(past)}</section>`;
      }).join("");
    },
    attendance(m) {
      const mid = m.member_id;
      const att = S.where("ClassAttendance", a => a.member_id === mid).map(a => ({ a, o: S.get("GroupClass", a.occurrence_id) })).sort((x, y) => y.o.occurrence_date.localeCompare(x.o.occurrence_date));
      const cis = S.where("CheckIn", c => c.member_id === mid).sort((a, b) => b.check_in_time.localeCompare(a.check_in_time)).slice(0, 15);
      return `<div class="grid g-1-1">
        <section class="card fade"><div class="card-head"><h2>Group classes</h2><span class="muted">${att.filter(x => x.a.status === "Attended").length} attended</span></div>${U.table({ rows: att, empty: "No classes yet", cols: [
          { label: "Date", html: x => fdate(x.o.occurrence_date) }, { label: "Class", html: x => esc(S.get("ClassSchedule", x.o.class_id).class_name) }, { label: "Status", html: x => `<span class="tag ${ATT_TAG[x.a.status]}">${x.a.status}</span>` }] })}</section>
        <section class="card fade"><div class="card-head"><h2>Gym visits</h2><span class="muted">latest 15</span></div>${U.table({ rows: cis, empty: "No visits recorded", cols: [
          { label: "Date", html: c => fdate(c.check_in_time) }, { label: "In", html: c => ftime(c.check_in_time.slice(11)) }, { label: "Out", html: c => c.check_out_time ? ftime(c.check_out_time.slice(11)) : '<span class="tag g">In the gym</span>' }] })}</section></div>`;
    },
    payments(m) {
      const mid = m.member_id;
      const ps = S.where("Payment", p => p.member_id === mid).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
      const owed = S.memberOwed(mid);
      return `<section class="card fade"><div class="card-head"><div><h2>Payments</h2><div class="sub">Owed is calculated live: agreed price minus valid payments. It's never typed in by hand.</div></div>${S.can("payment.create") ? `<button class="btn btn-yellow btn-sm" data-act="pay-new" data-id="${mid}">${ico("plus")}Record payment</button>` : ""}</div>
        <div class="card-body"><div class="summary"><div><span>Total charged</span><b>${rs(S.membershipsOf(mid).reduce((s, x) => s + x.agreed_price, 0) + S.enrollmentsOf(mid).reduce((s, x) => s + x.fee, 0))}</b></div><div><span>Paid (valid)</span><b>${rs(ps.filter(p => p.status === "valid").reduce((s, p) => s + p.amount, 0))}</b></div><div class="total"><span>Still owed</span><b class="${owed ? "" : "zero"}">${rs(owed)}</b></div></div></div>
        ${U.table({ rows: ps, empty: "No payments yet", rowCls: p => p.status === "void" ? "voided" : "", cols: [
          { label: "Date", html: p => fdate(p.payment_date) }, { label: "For", html: p => esc(paymentFor(p)) }, { label: "Method", html: p => esc(p.method) },
          { label: "Amount", cls: "num", html: p => `<span class="amt${p.status === "void" ? " void" : ""}">${rs(p.amount)}</span>` },
          { label: "", cls: "num", html: p => `<div class="acts">${A.paymentActions(p)}</div>` }] })}</section>`;
    }
  };
  A.route("/members/:id", g => S.canSeeMember(+g.id), (g, q) => memberDetail(+g.id, q));

  A.ACT["member-edit"] = el => {
    const m = S.get("Member", el.dataset.id);
    U.form({
      title: `Edit ${m.name}`, fields: [
        { name: "name", label: "Full name", required: true, value: m.name, maxlength: 100 },
        { name: "contact_number", label: "Phone", type: "tel", required: true, value: m.contact_number, maxlength: 20 },
        { name: "email", label: "Email", type: "email", required: true, value: m.email, full: true, maxlength: 120 },
        ...(S.can("member.medical") ? [U.medField(m.medical_history)] : [])
      ],
      onSubmit: v => { S.tx(() => S.update("Member", m.member_id, Object.assign({ name: v.name, contact_number: v.contact_number, email: v.email }, S.can("member.medical") ? { medical_history: v.medical_history } : {}))); U.toast("Member updated"); A.refresh(); }
    });
  };
  A.ACT["pt-trainer"] = el => {
    const e = S.get("PersonalTrainingEnrollment", el.dataset.id);
    U.form({
      title: `Change trainer for ${memberName(e.member_id)}`, sub: `Currently with ${esc(trainerName(e.trainer_id))}. Upcoming sessions move to the new trainer; past sessions and logs keep the coach who ran them.`,
      fields: [{ name: "trainer_id", label: "New trainer", type: "select", options: A.trainerLoadOptions(e.trainer_id), full: true },
        { name: "note", label: "Note to the member", type: "textarea", placeholder: "e.g. Coach Mira will take your 6 PM sessions from Monday." }],
      onSubmit: v => { const n = A.applyTrainerChange(e.pt_enrollment_id, v.trainer_id, { note: v.note }); U.toast(`Now training with ${trainerName(+v.trainer_id)}. ${n} upcoming session${n === 1 ? "" : "s"} moved.`); A.refresh(); }
    });
  };

  const me = () => S.session.role === "member";
  A.route("/me/progress", me, (_, q) => memberDetail(S.myMemberId(), Object.assign({}, q, { tab: "progress" }), { portal: "progress" }));
  A.route("/me/payments", me, (_, q) => memberDetail(S.myMemberId(), { tab: "payments" }, { portal: "payments" }));
  A.route("/me/sessions", me, () => {
    const mid = S.myMemberId(), pt = S.activePT(mid);
    if (!pt) return { html: `${header("Sessions")}<section class="card fade"><div class="empty"><b>No personal training yet</b>Ask the front desk about adding a coach to your plan.</div></section>` };
    const all = S.sessionsOf(pt.pt_enrollment_id);
    const up = all.filter(s => s.session_date >= S.TODAY && s.status !== "Cancelled");
    const past = all.filter(s => s.session_date < S.TODAY).reverse().slice(0, 15);
    const t = (rows, upcoming) => U.table({ rows, empty: "Nothing here", cols: [
      { label: "Date", html: s => `${dayLabel(s.session_date)} <small class="muted">${fdate(s.session_date)}</small>` }, { label: "Time", html: s => ftime(s.time_slot) },
      { label: "Status", html: s => `<span class="tag ${SESSION_TAG[s.status]}">${s.status === "Requested" ? "Waiting for coach" : s.status}</span>` },
      ...(upcoming ? [{ label: "", cls: "num", html: s => window.Sched.memberAction(s) }] : [])] });
    return { html: `${header("Sessions", { kicker: `Personal training with ${trainerName(pt.trainer_id)}`, actions: `<button class="btn btn-ghost" data-act="tc-request">${ico("refresh")}Change trainer</button><button class="btn btn-yellow" data-act="req-session">${ico("cal")}Extra session</button>` })}
      ${window.Sched.memberSeriesCard(pt)}
      <section class="card fade"><div class="card-head"><div><h2>Upcoming</h2><div class="sub">Can't make one? Tap "Request change" and your coach will confirm a new time.</div></div></div>${t(up, true)}</section>
      ${tcCard(pt, { always: true })}<section class="card fade"><div class="card-head"><h2>Past</h2><span class="muted">${all.filter(s => s.status === "Completed").length} completed</span></div>${t(past)}</section>` };
  });
  A.route("/me/profile", me, () => {
    const m = S.get("Member", S.myMemberId());
    return { html: `${header("Profile", { kicker: "Your details" })}
      <div class="grid g-1-1"><section class="card fade"><div class="card-head"><h2>Contact details</h2><button class="btn btn-ghost btn-sm" data-act="me-edit">Edit</button></div><dl class="kv">
        <dt>Name</dt><dd>${esc(m.name)}</dd><dt>Phone</dt><dd>${esc(m.contact_number)}</dd><dt>Email</dt><dd>${esc(m.email)}</dd><dt>Member since</dt><dd>${fdate(m.joined_date)}</dd>
        <dt>Medical notes</dt><dd>${m.medical_history ? esc(m.medical_history) : '<span class="muted">None</span>'}<div class="hint muted" style="font-size:13px;margin-top:4px">To change medical notes, tell the front desk or your coach.</div></dd></dl></section>
      <section class="card fade"><div class="card-head"><h2>Account & security</h2></div><dl class="kv"><dt>Username</dt><dd>@${esc(S.session.user.username)}</dd><dt>Last login</dt><dd>${S.session.user.last_login ? U.rel(S.session.user.last_login) : "—"}</dd></dl>
        <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ink btn-sm" data-act="toast" data-msg="A password-reset link would be emailed to you (needs the real backend).">Change password</button><a class="btn btn-ghost btn-sm" href="home.html">Log out</a></div></section></div>` };
  });
  A.ACT["me-edit"] = () => {
    const m = S.get("Member", S.myMemberId());
    U.form({ title: "Edit contact details", fields: [
      { name: "contact_number", label: "Phone", type: "tel", required: true, value: m.contact_number, maxlength: 20 },
      { name: "email", label: "Email", type: "email", required: true, value: m.email, maxlength: 120 }],
      onSubmit: v => { S.tx(() => S.update("Member", m.member_id, { contact_number: v.contact_number, email: v.email })); U.toast("Details updated"); A.refresh(); } });
  };
  const REASONS = ["Schedule doesn't fit", "Need a different specialization", "Coaching style isn't working for me", "Other"];
  function tcCard(pt, { always } = {}) {
    const mine = S.where("TrainerChange", c => c.pt_enrollment_id === pt.pt_enrollment_id && c.requested_by !== null).sort((a, b) => b.requested_at.localeCompare(a.requested_at));
    const pending = mine.find(c => c.status === "Pending");
    const recent = mine.find(c => c.status !== "Pending" && c.status !== "Withdrawn" && c.decided_at && S.daysBetween(c.decided_at.slice(0, 10), S.TODAY) <= 14 && c.reason_type !== "Changed by staff");
    if (pending) return `<section class="card fade"><div class="card-head"><div><h2>Trainer change requested</h2><div class="sub">Sent ${U.rel(pending.requested_at)} · the front desk usually replies within a day</div></div><span class="tag y">Pending</span></div>
      <dl class="kv"><dt>Current coach</dt><dd>${esc(trainerName(pending.from_trainer_id))}</dd><dt>You asked for</dt><dd>${pending.to_trainer_id ? esc(trainerName(pending.to_trainer_id)) : "No preference"}</dd><dt>Reason</dt><dd>${esc(pending.reason_type)}${pending.reason ? `<br><span class="muted">${esc(pending.reason)}</span>` : ""}</dd></dl>
      <div class="card-body"><button class="btn btn-ghost btn-sm" data-act="tc-withdraw" data-id="${pending.change_id}">Withdraw request</button></div></section>`;
    if (recent) return `<section class="card fade"><div class="card-head"><div><h2>${recent.status === "Approved" ? `You're now with ${esc(trainerName(recent.to_trainer_id))}` : "Trainer change not possible right now"}</h2><div class="sub">Front desk reply · ${U.rel(recent.decided_at)}</div></div><span class="tag ${recent.status === "Approved" ? "g" : "r"}">${recent.status}</span></div>
      ${recent.staff_note ? `<div class="card-body"><p>${esc(recent.staff_note)}</p></div>` : ""}</section>`;
    return always ? `<section class="card fade"><div class="card-head"><div><h2>Not the right fit?</h2><div class="sub">You can ask to train with a different coach. The front desk handles it privately; your coach isn't shown your reason.</div></div><button class="btn btn-line btn-sm" data-act="tc-request">Request a different trainer</button></div></section>` : "";
  }
  A.ACT["tc-request"] = () => {
    const pt = S.activePT(S.myMemberId());
    if (!pt) { U.toast("You don't have personal training yet.", true); return; }
    if (S.pendingChange(pt.pt_enrollment_id)) { U.toast("You already have a request waiting. Withdraw it first to change it.", true); return; }
    U.form({
      title: "Request a different trainer", sub: `You're training with ${esc(trainerName(pt.trainer_id))}. The front desk checks availability and replies here. Your progress history and plan come with you.`,
      fields: [
        { name: "to_trainer_id", label: "Who would you like?", type: "select", full: true, options: [["", "No preference: help me choose"], ...S.all("Trainer").filter(t => t.trainer_id !== pt.trainer_id).map(t => [t.trainer_id, `${t.name} · ${t.specialization}`])] },
        { name: "reason_type", label: "Main reason", type: "select", full: true, options: REASONS.map(r => [r, r]) },
        { name: "reason", label: "Anything else we should know?", type: "textarea", maxlength: 500, placeholder: "e.g. I can only train after 5 PM now. Only staff see this." }],
      submit: "Send request",
      onSubmit: v => {
        S.tx(() => S.insert("TrainerChange", { pt_enrollment_id: pt.pt_enrollment_id, member_id: pt.member_id, from_trainer_id: pt.trainer_id, to_trainer_id: v.to_trainer_id ? +v.to_trainer_id : null,
          reason_type: v.reason_type, reason: v.reason || null, status: "Pending", requested_by: S.session.user.user_id, requested_at: S.stamp(S.now()), decided_by: null, decided_at: null, staff_note: null }));
        U.toast("Request sent to the front desk."); A.refresh();
      }
    });
  };
  A.ACT["tc-withdraw"] = el => { S.tx(() => S.update("TrainerChange", +el.dataset.id, { status: "Withdrawn", decided_at: S.stamp(S.now()) })); U.toast("Request withdrawn"); A.refresh(); };

  A.ACT["req-session"] = () => {
    const pt = S.activePT(S.myMemberId());
    if (!pt) { U.toast("Personal training isn't part of your plan yet.", true); return; }
    U.form({ title: `Request a session with ${trainerName(pt.trainer_id)}`, sub: "Your coach confirms or suggests another time.",
      fields: [{ name: "session_date", label: "Day", type: "date", min: S.addDays(S.TODAY, 1), value: S.addDays(S.TODAY, 1), required: true }, { name: "time_slot", label: "Time", type: "select", options: A.SLOTS, value: "07:00" }],
      submit: "Send request",
      onSubmit: v => {
        if (v.session_date <= S.TODAY) throw new Error("Pick a day from tomorrow onwards.");
        const ver = S.currentVersion(pt.pt_enrollment_id);
        S.tx(() => S.insert("Session", { pt_enrollment_id: pt.pt_enrollment_id, trainer_id: pt.trainer_id, plan_version_id: ver.plan_version_id, session_date: v.session_date, time_slot: v.time_slot, status: "Requested" }));
        U.toast("Request sent. You'll see it confirmed here."); A.refresh();
      } });
  };
})();
