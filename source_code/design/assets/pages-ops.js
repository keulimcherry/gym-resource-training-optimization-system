(function () {
  "use strict";
  const S = window.Store, U = window.UI, A = window.App;
  const { esc, rs, rsK, fdate, fshort, ftime, dayLabel, initials, ico, plural } = U;
  const { header, kpi, memberName, trainerName, statusTag, SESSION_TAG, paymentFor } = A;
  const tabsHtml = (base, tabs, cur) => `<div class="tabs page-tabs fade" role="tablist">${tabs.map(([k, l, n]) => `<a href="#${base}?tab=${k}" class="${k === cur ? "on" : ""}" role="tab" aria-selected="${k === cur}">${esc(l)}${n ? ` <span class="n">${n}</span>` : ""}</a>`).join("")}</div>`;

  A.route("/attendance", () => S.can("attendance.mark") || S.can("checkin"), (_, q) => {
    const tabs = [...(S.can("attendance.mark") ? [["classes", "Classes & PT"]] : []), ...(S.can("checkin") ? [["checkin", "Check-in desk", S.insideNow().length]] : [])];
    const tab = tabs.some(t => t[0] === q.tab) ? q.tab : tabs[0][0];
    if (tab === "classes") return {
      html: `${header("Attendance", { kicker: "Phase 3 · take a whole room in seconds" })}${tabsHtml("/attendance", tabs, tab)}${A.attendanceCard()}`,
      after: () => { A.wireSearch(); A.renderAtt(); }
    };
    const inside = S.insideNow().sort((a, b) => b.check_in_time.localeCompare(a.check_in_time));
    const via = c => c.via && c.via.startsWith("class:") ? `from class · ${esc(c.via.slice(6))}` : c.via === "pt" ? "from PT session" : "at the desk";
    const todayAll = S.where("CheckIn", c => c.check_in_time.startsWith(S.TODAY));
    return {
      html: `${header("Check-in desk", { kicker: `${todayAll.length} check-ins today` })}${tabsHtml("/attendance", tabs, tab)}
      <div class="grid g-1-1">
        <section class="card fade"><div class="card-head"><div><h2>Check a member in</h2><div class="sub">Search, then tap Check in. Expired plans and dues are flagged.</div></div></div>
          <div class="filters"><label class="search" style="flex:1">${ico("search")}<span class="sr">Find member</span><input id="cifind" placeholder="Name or phone number" style="width:100%"></label></div>
          <div id="cilist"></div></section>
        <section class="card fade"><div class="card-head"><div><h2><span class="dot" style="margin-right:10px"></span>In the gym now · ${inside.length}</h2><div class="sub">Open check-ins. People marked present in a class or PT session are checked in automatically. Anyone still here after 3 hours drops off the live count.</div></div></div>
          ${inside.length ? inside.map(c => `<div class="row"><div class="pic">${esc(initials(memberName(c.member_id)))}</div><div class="who"><b><a href="#/members/${c.member_id}">${esc(memberName(c.member_id))}</a></b><span>in since ${ftime(c.check_in_time.slice(11))} · ${U.rel(c.check_in_time)} · ${via(c)}</span></div><button class="btn btn-ghost btn-xs" data-act="check-out" data-id="${c.member_id}">Check out</button></div>`).join("") : `<div class="empty"><b>Nobody inside</b></div>`}
        </section></div>`,
      after: () => {
        A.wireSearch();
        const inp = document.getElementById("cifind"), list = document.getElementById("cilist");
        const insideIds = inside.map(c => c.member_id);
        const draw = () => {
          const t = inp.value.trim().toLowerCase();
          const ms = S.all("Member").filter(m => !insideIds.includes(m.member_id) && (!t || m.name.toLowerCase().includes(t) || m.contact_number.includes(t))).sort((a, b) => a.name.localeCompare(b.name)).slice(0, t ? 12 : 8);
          list.innerHTML = ms.map(m => { const st = S.memberStatus(m.member_id), o = S.can("dues.view") ? S.memberOwed(m.member_id) : 0;
            return `<div class="row"><div class="pic">${esc(initials(m.name))}</div><div class="who"><b>${esc(m.name)}</b><span>${esc(m.contact_number)} · <span class="tag ${st.cls}">${esc(st.label)}</span>${o ? ` <span class="down">owes ${rs(o)}</span>` : ""}</span></div><button class="btn btn-yellow btn-xs" data-act="check-in" data-id="${m.member_id}">Check in</button></div>`; }).join("") || `<div class="empty"><b>No match</b></div>`;
        };
        inp.addEventListener("input", draw); draw(); inp.focus();
      }
    };
  });

  A.route("/payments", () => S.can("payment.view") || S.can("dues.view"), (_, q) => {
    const owing = S.all("Member").map(m => ({ m, o: S.memberOwed(m.member_id) })).filter(x => x.o > 0).sort((a, b) => b.o - a.o);
    const tabs = [...(S.can("payment.view") ? [["all", "All payments"]] : []), ["dues", "Dues", owing.length]];
    const tab = tabs.some(t => t[0] === q.tab) ? q.tab : tabs[0][0];
    const act = S.can("payment.create") ? `<button class="btn btn-yellow" data-act="pay-new">${ico("plus")}Record payment</button>` : "";
    if (tab === "dues") return {
      html: `${header("Dues", { kicker: `${rs(S.owedTotal())} owed by ${plural(owing.length, "member")}`, actions: act })}${tabsHtml("/payments", tabs, tab)}
      <section class="card fade"><div class="card-head"><div><h2>Who owes what</h2><div class="sub">Calculated live from agreed prices minus valid payments, so it can never drift out of sync.</div></div></div>
      ${U.table({ rows: owing, href: x => `/members/${x.m.member_id}?tab=payments`, empty: "Nobody owes anything", cols: [
        { label: "Member", html: x => U.who(x.m.name, esc(x.m.contact_number)) },
        { label: "Owed for", html: x => [...S.membershipsOf(x.m.member_id).filter(ms => S.membershipOwed(ms.membership_id)).map(ms => `${esc(S.planOf(ms).plan_type)} <b>${rs(S.membershipOwed(ms.membership_id))}</b>`), ...S.enrollmentsOf(x.m.member_id).filter(e => S.ptOwed(e.pt_enrollment_id)).map(e => `PT <b>${rs(S.ptOwed(e.pt_enrollment_id))}</b>`)].join("<br>") },
        { label: "Status", html: x => statusTag(x.m.member_id) },
        { label: "Last paid", html: x => { const p = S.where("Payment", p => p.member_id === x.m.member_id && p.status === "valid").sort((a, b) => b.payment_date.localeCompare(a.payment_date))[0]; return p ? U.rel(p.payment_date + " 12:00") : '<span class="muted">never</span>'; } },
        { label: "Total", cls: "num", html: x => `<span class="amt owed">${rs(x.o)}</span>` },
        ...(S.can("payment.create") ? [{ label: "", cls: "num", html: x => `<button class="btn btn-ink btn-xs" data-act="pay-new" data-id="${x.m.member_id}">Collect</button>` }] : [])] })}</section>`,
      after: A.wireSearch
    };
    const method = q.method || "", status = q.status || "", month = q.month || "";
    const months = [...new Set(S.all("Payment").map(p => p.payment_date.slice(0, 7)))].sort().reverse();
    const rows = S.all("Payment").filter(p => (!method || p.method === method) && (!status || p.status === status) && (!month || p.payment_date.startsWith(month)))
      .sort((a, b) => b.payment_date.localeCompare(a.payment_date) || b.payment_id - a.payment_id);
    const total = rows.filter(p => p.status === "valid").reduce((s, p) => s + p.amount, 0);
    const sel = (name, opts, val) => `<div class="sel"><select data-filter="${name}" aria-label="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
    return {
      html: `${header("Payments", { kicker: S.can("payment.edit") ? "You can edit and void payments. Every change is audited." : "You can record payments. Only accounts can edit or void them.", actions: act })}${tabsHtml("/payments", tabs, tab)}
      <section class="card fade"><div class="card-head"><h2>${plural(rows.length, "payment")}</h2></div>
        <div class="filters">${sel("month", [["", "All months"], ...months.map(m => [m, S.parse(m + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })])], month)}${sel("method", [["", "All methods"], ...A.METHODS], method)}${sel("status", [["", "Valid & void"], ["valid", "Valid only"], ["void", "Void only"]], status)}</div>
        ${U.table({ rows: rows.slice(0, 120), rowCls: p => p.status === "void" ? "voided" : "", cols: [
          { label: "#", html: p => `<span class="muted">${p.payment_id}</span>` },
          { label: "Date", html: p => fdate(p.payment_date) },
          { label: "Member", html: p => `<a href="#/members/${p.member_id}?tab=payments">${esc(memberName(p.member_id))}</a>` },
          { label: "For", html: p => esc(paymentFor(p)) },
          { label: "Method", html: p => esc(p.method) },
          { label: "Recorded by", html: p => `<small class="muted">${esc(A.userName(p.recorded_by))}</small>` },
          { label: "Amount", cls: "num", html: p => `<span class="amt${p.status === "void" ? " void" : ""}">${rs(p.amount)}</span>${p.status === "void" ? `<br><small class="muted" title="${esc(p.void_reason)}">void</small>` : ""}` },
          { label: "", cls: "num", html: p => `<div class="acts">${A.paymentActions(p)}</div>` }] })}
        <div class="tbl-foot"><span>Valid total for this view</span><b class="amt">${rs(total)}</b></div></section>`,
      after: () => {
        A.wireSearch();
        document.querySelectorAll("[data-filter]").forEach(s => s.addEventListener("change", () => {
          const p = new URLSearchParams({ tab: "all" });
          document.querySelectorAll("[data-filter]").forEach(x => x.value && p.set(x.dataset.filter, x.value));
          location.hash = "#/payments?" + p;
        }));
      }
    };
  });

  A.route("/pt", "session.view", (_, q) => {
    const vis = S.all("PersonalTrainingEnrollment").filter(e => A.visibleEnrollment(e.pt_enrollment_id));
    const visIds = vis.map(e => e.pt_enrollment_id);
    const reqs = S.where("Session", s => s.status === "Requested" && visIds.includes(s.pt_enrollment_id));
    const changeReqs = S.where("SessionChangeRequest", r => r.status === "Pending" && visIds.includes(S.get("Session", r.session_id).pt_enrollment_id));
    const activeSeries = S.where("SessionSeries", x => visIds.includes(x.pt_enrollment_id) && x.status !== "Ended" && x.end_date >= S.TODAY);
    const pendingTC = S.where("TrainerChange", c => c.status === "Pending");
    const tabs = [["schedule", "Schedule"], ["series", "Recurring", activeSeries.length], ["requests", "Requests", reqs.length + changeReqs.length], ["enrollments", "Enrollments", vis.length], ...(S.can("pt.assign") ? [["changes", "Trainer changes", pendingTC.length]] : [])];
    const tab = tabs.some(t => t[0] === q.tab) ? q.tab : "schedule";
    const acts = `${S.can("pt.create") ? `<button class="btn btn-ghost" data-act="pt-new">${ico("plus")}New PT enrollment</button>` : ""}${S.can("session.manage") ? `<button class="btn btn-ghost" data-act="sess-new">${ico("cal")}One session</button><button class="btn btn-yellow" data-act="series-new">${ico("repeat")}Recurring schedule</button>` : ""}`;
    let body = "";
    if (tab === "schedule") {
      const from = q.from || S.TODAY;
      const days = Array.from({ length: 7 }, (_, i) => S.addDays(from, i));
      body = `<section class="card fade"><div class="card-head"><div><h2>${dayLabel(days[0])} – ${fdate(days[6])}</h2><div class="sub">${S.session.role === "trainer" ? "Your sessions only" : "All trainers"}</div></div>
        <div style="display:flex;gap:6px"><a class="btn btn-ghost btn-sm" href="#/pt?tab=schedule&from=${S.addDays(from, -7)}">← Week</a><a class="btn btn-ghost btn-sm" href="#/pt?tab=schedule">Today</a><a class="btn btn-ghost btn-sm" href="#/pt?tab=schedule&from=${S.addDays(from, 7)}">Week →</a></div></div>
        ${days.map(d => { const ss = S.sessionsOn(d).filter(s => visIds.includes(s.pt_enrollment_id)); return `<div style="padding:6px 22px 2px" class="kicker">${esc(dayLabel(d))} · ${fdate(d)}</div>${ss.length ? ss.map(s => sessionRow(s)).join("") : `<div class="row"><span class="muted">No sessions</span></div>`}`; }).join("")}</section>`;
    } else if (tab === "series") {
      body = window.Sched.seriesTab(visIds);
    } else if (tab === "requests") {
      body = `${window.Sched.changeRequests(visIds)}<section class="card fade"><div class="card-head"><div><h2>Extra session requests</h2><div class="sub">Members ask for an extra session; the trainer or the desk confirms.</div></div></div>
        ${reqs.length ? reqs.map(s => { const e = S.get("PersonalTrainingEnrollment", s.pt_enrollment_id); return `<div class="row"><div class="pic">${esc(initials(memberName(e.member_id)))}</div><div class="who"><b>${esc(memberName(e.member_id))}</b><span>wants ${dayLabel(s.session_date)} ${fdate(s.session_date)} at ${ftime(s.time_slot)} · with ${esc(trainerName(e.trainer_id))}</span></div>
          ${S.can("session.manage") ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ink btn-xs" data-act="req-accept" data-id="${s.session_id}">Accept</button><button class="btn btn-ghost btn-xs" data-act="sess-edit" data-id="${s.session_id}">Suggest time</button><button class="btn btn-ghost btn-xs" data-act="req-decline" data-id="${s.session_id}">Decline</button></div>` : ""}</div>`; }).join("") : `<div class="empty"><b>No requests waiting</b></div>`}</section>`;
    } else if (tab === "changes") {
      const history = S.where("TrainerChange", c => c.status !== "Pending").sort((a, b) => (b.decided_at || "").localeCompare(a.decided_at || "")).slice(0, 15);
      const TC_TAG = { Approved: "g", Declined: "r", Withdrawn: "" };
      body = `<section class="card fade"><div class="card-head"><div><h2>Waiting for a decision</h2><div class="sub">Members ask from their portal. The reason is visible to staff only, never to the trainer.</div></div></div>
        ${pendingTC.length ? pendingTC.map(c => `<div class="row" style="align-items:flex-start"><div class="pic">${esc(initials(memberName(c.member_id)))}</div>
          <div class="who"><b><a href="#/members/${c.member_id}">${esc(memberName(c.member_id))}</a></b><span>${esc(trainerName(c.from_trainer_id))} → <strong style="color:var(--fg)">${c.to_trainer_id ? esc(trainerName(c.to_trainer_id)) : "no preference"}</strong> · ${U.rel(c.requested_at)}</span>
            <div style="margin-top:8px"><span class="tag a">${esc(c.reason_type)}</span>${c.reason ? `<p style="margin-top:8px;font-size:15px">"${esc(c.reason)}"</p>` : ""}</div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ink btn-xs" data-act="tc-approve" data-id="${c.change_id}">Approve</button><button class="btn btn-ghost btn-xs" data-act="tc-decline" data-id="${c.change_id}">Decline</button></div></div>`).join("") : `<div class="empty"><b>No requests waiting</b></div>`}</section>
        <section class="card fade"><div class="card-head"><h2>History</h2></div>${U.table({ rows: history, empty: "No trainer changes yet", cols: [
          { label: "When", html: c => c.decided_at ? U.rel(c.decided_at) : "—" },
          { label: "Member", html: c => `<a href="#/members/${c.member_id}">${esc(memberName(c.member_id))}</a>` },
          { label: "Change", html: c => `${esc(trainerName(c.from_trainer_id))} → ${c.to_trainer_id ? esc(trainerName(c.to_trainer_id)) : "—"}` },
          { label: "Why", html: c => esc(c.reason_type) },
          { label: "Status", html: c => `<span class="tag ${TC_TAG[c.status]}">${c.status}</span>` },
          { label: "Decided by", html: c => c.decided_by ? esc(A.userName(c.decided_by)) : '<span class="muted">member</span>' },
          { label: "Note to member", html: c => c.staff_note ? `<span class="muted">${esc(c.staff_note)}</span>` : "—" }] })}</section>`;
    } else {
      body = `<section class="card fade">${U.table({ rows: vis.sort((a, b) => b.start_date.localeCompare(a.start_date)), href: e => `/members/${e.member_id}?tab=plans`, cols: [
        { label: "Member", html: e => U.who(memberName(e.member_id), esc(e.goal)) },
        { label: "Trainer", html: e => esc(trainerName(e.trainer_id)) },
        { label: "Since", html: e => fdate(e.start_date) },
        { label: "Plan", html: e => { const v = S.currentVersion(e.pt_enrollment_id); return v ? `<span class="tag k">v${v.version_number}</span>` : "—"; } },
        { label: "Done", cls: "num", html: e => S.sessionsOf(e.pt_enrollment_id).filter(s => s.status === "Completed").length },
        ...(S.can("dues.view") ? [{ label: "Fee", cls: "num", html: e => `${rs(e.fee)}${S.ptOwed(e.pt_enrollment_id) ? `<br><small class="down">owes ${rs(S.ptOwed(e.pt_enrollment_id))}</small>` : ""}` }] : []),
        { label: "", cls: "num", html: e => `<div class="acts">${S.can("pt.assign") ? `<button class="btn btn-ghost btn-xs" data-act="pt-trainer" data-id="${e.pt_enrollment_id}">Trainer</button>` : ""}${A.canWritePlan(e) ? `<button class="btn btn-ghost btn-xs" data-act="plan-new" data-id="${e.pt_enrollment_id}">New version</button>` : ""}</div>` }] })}</section>`;
    }
    return { html: `${header("PT & sessions", { kicker: S.session.role === "trainer" ? "Your clients only" : "Personal training across the gym", actions: acts })}${tabsHtml("/pt", tabs, tab)}${body}`, after: A.wireSearch };
  });
  function sessionRow(s) {
    const e = S.get("PersonalTrainingEnrollment", s.pt_enrollment_id);
    return `<div class="row"><div class="pic sq">${ftime(s.time_slot)}</div><div class="who"><b><a href="#/members/${e.member_id}?tab=sessions">${esc(memberName(e.member_id))}</a></b><span>with ${esc(trainerName(S.sessionTrainer(s)))} · plan v${(S.get("TrainingPlan", s.plan_version_id) || {}).version_number || "—"}</span></div>${s.series_id ? `<span class="tag" title="Part of a recurring schedule">${ico("repeat").replace("<svg", '<svg style="width:12px;height:12px;vertical-align:-2px"')}</span>` : ""}${window.Sched.pendingReq(s.session_id) ? '<span class="tag y">Change asked</span>' : ""}<span class="tag ${SESSION_TAG[s.status]}">${s.status}</span>${S.can("session.manage") ? `<button class="btn btn-ghost btn-xs" data-act="sess-edit" data-id="${s.session_id}">Change</button>` : ""}</div>`;
  }
  const enrollmentOptions = () => S.all("PersonalTrainingEnrollment").filter(e => A.visibleEnrollment(e.pt_enrollment_id) && (!e.end_date || e.end_date >= S.TODAY)).map(e => [e.pt_enrollment_id, `${memberName(e.member_id)} · ${trainerName(e.trainer_id)}`]);
  A.ACT["sess-new"] = el => {
    const opts = enrollmentOptions();
    if (!opts.length) { U.toast("No active PT enrollments to schedule.", true); return; }
    U.form({ title: "Schedule a PT session", fields: [
      { name: "pt_enrollment_id", label: "Client", type: "select", options: opts, value: el.dataset.id || opts[0][0], full: true },
      { name: "session_date", label: "Date", type: "date", value: S.addDays(S.TODAY, 1), min: S.TODAY, required: true },
      { name: "time_slot", label: "Time", type: "select", options: A.SLOTS, value: "07:00" }],
      submit: "Schedule",
      onSubmit: v => { const ver = S.currentVersion(v.pt_enrollment_id); S.tx(() => S.insert("Session", { pt_enrollment_id: +v.pt_enrollment_id, trainer_id: S.get("PersonalTrainingEnrollment", v.pt_enrollment_id).trainer_id, plan_version_id: ver.plan_version_id, session_date: v.session_date, time_slot: v.time_slot, status: "Scheduled" })); U.toast("Session scheduled"); A.refresh(); } });
  };
  A.ACT["sess-edit"] = el => {
    const s = S.get("Session", el.dataset.id), e = S.get("PersonalTrainingEnrollment", s.pt_enrollment_id);
    U.form({ title: `Session · ${memberName(e.member_id)}`, sub: `With ${esc(trainerName(S.sessionTrainer(s)))}`, fields: [
      { name: "session_date", label: "Date", type: "date", value: s.session_date, required: true },
      { name: "time_slot", label: "Time", type: "select", options: A.SLOTS.some(x => x[0] === s.time_slot) ? A.SLOTS : [[s.time_slot, ftime(s.time_slot)], ...A.SLOTS], value: s.time_slot },
      { name: "status", label: "Status", type: "select", options: ["Scheduled", "Completed", "No-show", "Cancelled"].map(x => [x, x]), value: s.status === "Requested" ? "Scheduled" : s.status, full: true }],
      onSubmit: v => { S.tx(() => S.update("Session", s.session_id, { session_date: v.session_date, time_slot: v.time_slot, status: v.status })); U.toast("Session updated"); A.refresh(); } });
  };
  A.ACT["tc-approve"] = el => {
    const c = S.get("TrainerChange", el.dataset.id), e = S.get("PersonalTrainingEnrollment", c.pt_enrollment_id);
    const opts = A.trainerLoadOptions(e.trainer_id);
    U.form({
      title: `Approve trainer change · ${memberName(c.member_id)}`,
      sub: `${esc(trainerName(e.trainer_id))} → ${c.to_trainer_id ? esc(trainerName(c.to_trainer_id)) : "no preference"}. Reason: ${esc(c.reason_type)}. Upcoming sessions move to the new coach; the fee and payments stay the same.`,
      fields: [
        { name: "trainer_id", label: "New trainer", type: "select", options: opts, value: c.to_trainer_id || opts[0][0], full: true, hint: "Client counts help you avoid overloading one coach." },
        { name: "note", label: "Message to the member", type: "textarea", value: "", placeholder: "e.g. Done! Coach Mira will see you Monday at 6 PM." }],
      submit: "Approve & switch",
      onSubmit: v => { const n = A.applyTrainerChange(e.pt_enrollment_id, v.trainer_id, { note: v.note }); U.toast(`${memberName(c.member_id)} now trains with ${trainerName(+v.trainer_id)}. ${n} upcoming session${n === 1 ? "" : "s"} moved.`); A.refresh(); }
    });
  };
  A.ACT["tc-decline"] = el => {
    const c = S.get("TrainerChange", el.dataset.id);
    U.form({ title: `Decline request · ${memberName(c.member_id)}`, sub: "The member sees your message in their portal.", size: "narrow",
      fields: [{ name: "note", label: "Message to the member", type: "textarea", required: true, placeholder: "e.g. Coach Mira's evenings are full this month. We'll offer you the first slot that opens." }],
      submit: "Decline", danger: true,
      onSubmit: v => { S.tx(() => { S.update("TrainerChange", c.change_id, { status: "Declined", decided_by: S.session.user.user_id, decided_at: S.stamp(S.now()), staff_note: v.note }); S.notify(S.userOfMember(c.member_id), "Trainer change not possible right now", v.note, "#/me/sessions"); }); U.toast("Request declined. The member will see your note."); A.refresh(); } });
  };
  A.ACT["req-accept"] = el => { S.tx(() => S.update("Session", +el.dataset.id, { status: "Scheduled" })); U.toast("Confirmed. The member sees it in their portal."); A.refresh(); };
  A.ACT["req-decline"] = el => { S.tx(() => S.update("Session", +el.dataset.id, { status: "Cancelled" })); U.toast("Request declined"); A.refresh(); };
  A.ACT["pt-new"] = () => {
    U.form({ title: "New PT enrollment", sub: "Pick the member first. The next screen adds the trainer, fee and first payment together.",
      fields: [{ name: "member_id", label: "Member", type: "select", options: A.memberOptions(m => !S.activePT(m.member_id)), full: true }],
      submit: "Continue", onSubmit: v => { setTimeout(() => A.addMemberFlow({ member: S.get("Member", v.member_id), ptOnly: true }), 50); } });
  };

  A.route("/progress", "progress.view", (_, q) => {
    const src = q.source || "all";
    const recs = S.all("ProgressRecord").filter(r => S.canSeeMember(r.member_id) && (src === "all" || r.source === src)).sort((a, b) => b.record_date.localeCompare(a.record_date)).slice(0, 40);
    return {
      html: `${header("Progress logs", { kicker: S.session.role === "trainer" ? "Your clients' latest entries" : "Latest entries across all members", actions: S.can("progress.create") ? `<button class="btn btn-yellow" data-act="prog-new">${ico("plus")}Log progress</button>` : "" })}
      <div class="chips fade">${[["all", "Everything"], ["trainer", "Coach logs"], ["member", "Member journals"]].map(([k, l]) => `<a class="chip-f" style="text-decoration:none" href="#/progress?source=${k}" aria-pressed="${k === src}">${l}</a>`).join("")}</div>
      <section class="card fade">${U.table({ rows: recs, href: r => `/members/${r.member_id}?tab=progress`, empty: "No entries", cols: [
        { label: "Date", html: r => fdate(r.record_date) },
        { label: "Member", html: r => U.who(memberName(r.member_id)) },
        { label: "By", html: r => r.source === "trainer" ? `<span class="tag k">Coach</span> ${esc(trainerName(r.trainer_id))}` : `<span class="tag y">Member</span>` },
        { label: "Weight", cls: "num", html: r => r.weight != null ? r.weight + " kg" : "—" },
        { label: "Strength", html: r => esc(r.strength_metric || "—") },
        { label: "Notes", html: r => `<span class="muted">${esc((r.notes || "").slice(0, 70))}${(r.notes || "").length > 70 ? "…" : ""}</span>` }] })}</section>`,
      after: A.wireSearch
    };
  });

  A.route("/trainers", "trainer.view", () => ({
    html: `${header("Trainers", { kicker: `${S.all("Trainer").length} coaches on staff`, actions: S.can("trainer.manage") ? `<button class="btn btn-yellow" data-act="trainer-form">${ico("plus")}Add trainer</button>` : "" })}
    <div class="cards">${S.all("Trainer").map(t => {
      const clients = S.clientIdsOf(t.trainer_id).length;
      const week = S.where("Session", s => S.sessionTrainer(s) === t.trainer_id && s.status === "Completed" && s.session_date >= S.addDays(S.TODAY, -7)).length;
      const classes = S.where("ClassSchedule", c => c.trainer_id === t.trainer_id);
      return `<article class="card tcard fade"><div style="display:flex;gap:14px;align-items:center"><div class="pic">${esc(initials(t.name))}</div><div><h3>${esc(t.name)}</h3><span class="muted">${esc(t.specialization)}</span></div></div>
        <div class="stats"><div><b>${clients}</b>PT clients</div><div><b>${week}</b>sessions (7d)</div><div><b>${classes.length}</b>classes/wk</div></div>
        <div class="muted" style="font-size:14px">${ico("phone").replace("<svg", '<svg style="width:14px;height:14px;vertical-align:-2px"')} ${esc(t.contact_number)}${classes.length ? ` · ${esc([...new Set(classes.map(c => c.class_name))].join(", "))}` : ""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-ink btn-sm" href="#/members?trainer=${t.trainer_id}">View clients</a>${S.can("trainer.manage") ? `<button class="btn btn-ghost btn-sm" data-act="trainer-form" data-id="${t.trainer_id}">Edit</button>` : ""}</div></article>`;
    }).join("")}</div>`,
    after: A.wireSearch
  }));
  A.ACT["trainer-form"] = el => {
    const t = el.dataset.id ? S.get("Trainer", el.dataset.id) : null;
    U.form({ title: t ? `Edit ${t.name}` : "Add trainer", sub: t ? "" : "Create their login under Staff & pricing so they can use the trainer portal.", fields: [
      { name: "name", label: "Full name", required: true, value: t ? t.name : "", maxlength: 100 },
      { name: "contact_number", label: "Phone", type: "tel", required: true, value: t ? t.contact_number : "", maxlength: 20 },
      { name: "specialization", label: "Specialization", required: true, value: t ? t.specialization : "", full: true, maxlength: 100 }],
      onSubmit: v => { S.tx(() => t ? S.update("Trainer", t.trainer_id, v) : S.insert("Trainer", v)); U.toast(t ? "Trainer updated" : `${v.name} added`); A.refresh(); } });
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function timetable({ manage, mine } = {}) {
    const today = S.dowOf(S.TODAY);
    return `<div class="week">${DAYS.map(d => `<div class="day${d === today ? " today" : ""}"><h3>${d.slice(0, 3)}</h3>${S.where("ClassSchedule", c => c.day_of_week === d && (!mine || c.trainer_id === mine)).sort((a, b) => a.usual_start_time.localeCompare(b.usual_start_time)).map(c =>
      `<div class="cls"><b>${esc(c.class_name)}</b><span>${ftime(c.usual_start_time)} · ${c.duration_minutes} min</span><span>${esc(trainerName(c.trainer_id))}</span>${manage ? `<div class="cls-acts"><button class="btn btn-ghost btn-xs" data-act="class-form" data-id="${c.class_id}">Edit</button></div>` : ""}</div>`).join("") || '<span class="muted" style="font-size:13px;padding:4px">—</span>'}</div>`).join("")}</div>`;
  }
  A.route("/classes", "class.view", (_, q) => {
    const tab = q.tab === "occurrences" ? "occurrences" : "timetable";
    const mine = S.session.role === "trainer" ? S.myTrainerId() : null;
    const manage = S.can("class.manage");
    const acts = manage ? `<button class="btn btn-ghost" data-act="occ-generate">${ico("refresh")}Generate next week</button><button class="btn btn-yellow" data-act="class-form">${ico("plus")}New class</button>` : "";
    let body;
    if (tab === "timetable") body = `<section class="card fade"><div class="card-head"><div><h2>Weekly timetable</h2><div class="sub">ClassSchedule: the recurring class types. Each dated run is a GroupClass occurrence.</div></div></div>${timetable({ manage, mine })}</section>`;
    else {
      const occ = S.where("GroupClass", o => o.occurrence_date >= S.addDays(S.TODAY, -7) && o.occurrence_date <= S.addDays(S.TODAY, 14) && (!mine || S.get("ClassSchedule", o.class_id).trainer_id === mine))
        .sort((a, b) => (a.occurrence_date + a.start_time).localeCompare(b.occurrence_date + b.start_time));
      body = `<section class="card fade"><div class="card-head"><h2>Last 7 days & next 2 weeks</h2></div>${U.table({ rows: occ, cols: [
        { label: "Date", html: o => `${dayLabel(o.occurrence_date)} <small class="muted">${fdate(o.occurrence_date)}</small>` },
        { label: "Class", html: o => `<b>${esc(S.get("ClassSchedule", o.class_id).class_name)}</b>` },
        { label: "Time", html: o => ftime(o.start_time) },
        { label: "Trainer", html: o => esc(trainerName(S.get("ClassSchedule", o.class_id).trainer_id)) },
        { label: "Attended", cls: "num", html: o => { const a = S.attendanceOf(o.occurrence_id); return o.occurrence_date > S.TODAY ? '<span class="muted">upcoming</span>' : a.length ? `${a.filter(x => x.status === "Attended").length} / ${a.length}` : '<span class="down">not taken</span>'; } },
        { label: "", cls: "num", html: o => o.occurrence_date <= S.TODAY && S.can("attendance.mark") ? `<button class="btn btn-ghost btn-xs" data-act="occ-take" data-date="${o.occurrence_date}" data-k="o${o.occurrence_id}">Take attendance</button>` : "" }] })}</section>`;
    }
    return { html: `${header(mine ? "My classes" : "Classes", { kicker: `${S.all("ClassSchedule").length} classes a week`, actions: acts })}${tabsHtml("/classes", [["timetable", "Timetable"], ["occurrences", "Occurrences"]], tab)}${body}`, after: A.wireSearch };
  });
  A.ACT["occ-take"] = el => { A.ATT.date = el.dataset.date; A.ATT.tab = el.dataset.k; location.hash = "#/attendance?tab=classes"; };
  A.ACT["class-form"] = el => {
    const c = el.dataset.id ? S.get("ClassSchedule", el.dataset.id) : null;
    U.form({ title: c ? `Edit ${c.class_name}` : "New recurring class", sub: c ? "Changes apply to future occurrences." : "Adds a weekly slot. Use 'Generate next week' to create the dated occurrences.", fields: [
      { name: "class_name", label: "Class name", required: true, value: c ? c.class_name : "", maxlength: 100 },
      { name: "trainer_id", label: "Trainer", type: "select", options: A.trainerOptions(), value: c ? c.trainer_id : "" },
      { name: "day_of_week", label: "Day", type: "select", options: DAYS.map(d => [d, d]), value: c ? c.day_of_week : "Monday" },
      { name: "usual_start_time", label: "Start time", type: "time", value: c ? c.usual_start_time : "07:00", required: true },
      { name: "duration_minutes", label: "Duration (minutes)", type: "number", min: 15, max: 180, step: 5, value: c ? c.duration_minutes : 60, required: true }],
      onSubmit: v => {
        const d = U.num(v.duration_minutes, "Duration", { min: 15 }); if (d > 180) throw new Error("Classes can be at most 180 minutes.");
        const row = { class_name: v.class_name, trainer_id: +v.trainer_id, day_of_week: v.day_of_week, usual_start_time: v.usual_start_time, duration_minutes: d };
        S.tx(() => c ? S.update("ClassSchedule", c.class_id, row) : S.insert("ClassSchedule", row)); U.toast(c ? "Class updated" : "Class added to the timetable"); A.refresh();
      } });
  };
  A.ACT["occ-generate"] = () => {
    let n = 0;
    S.tx(() => { for (let i = 1; i <= 14; i++) { const d = S.addDays(S.TODAY, i); S.where("ClassSchedule", c => c.day_of_week === S.dowOf(d)).forEach(c => { if (!S.where("GroupClass", o => o.class_id === c.class_id && o.occurrence_date === d).length) { S.insert("GroupClass", { class_id: c.class_id, occurrence_date: d, start_time: c.usual_start_time }); n++; } }); } });
    U.toast(n ? `Created ${plural(n, "class occurrence")} for the next 2 weeks` : "Next 2 weeks are already generated"); A.refresh();
  };
  A.route("/me/classes", () => S.session.role === "member", () => {
    const mid = S.myMemberId();
    const mine = S.where("ClassAttendance", a => a.member_id === mid).map(a => ({ a, o: S.get("GroupClass", a.occurrence_id) })).sort((x, y) => y.o.occurrence_date.localeCompare(x.o.occurrence_date)).slice(0, 12);
    return { html: `${header("Classes", { kicker: "Weekly timetable" })}<section class="card fade"><div class="card-head"><div><h2>This week at Moksha</h2><div class="sub">Just show up. The trainer marks attendance at the start of class.</div></div></div>${timetable()}</section>
      <section class="card fade"><div class="card-head"><h2>My recent classes</h2></div>${U.table({ rows: mine, empty: "You haven't joined a class yet", cols: [
        { label: "Date", html: x => fdate(x.o.occurrence_date) }, { label: "Class", html: x => esc(S.get("ClassSchedule", x.o.class_id).class_name) }, { label: "Status", html: x => `<span class="tag ${A.ATT_TAG[x.a.status]}">${x.a.status}</span>` }] })}</section>` };
  });

  const eqStatus = e => { const d = S.daysBetween(S.TODAY, e.next_service_due); return d < 0 ? ["Overdue", "r", d] : d <= 14 ? [`Due in ${d}d`, "a", d] : ["OK", "g", d]; };
  A.route("/equipment", "equipment.view", () => {
    const eq = S.all("Equipment").slice().sort((a, b) => a.next_service_due.localeCompare(b.next_service_due));
    const over = eq.filter(e => eqStatus(e)[1] === "r").length, soon = eq.filter(e => eqStatus(e)[1] === "a").length;
    const manage = S.can("equipment.manage");
    return {
      html: `${header("Equipment", { kicker: "Servicing every 90 days", actions: manage ? `<button class="btn btn-yellow" data-act="eq-form">${ico("plus")}Add equipment</button>` : "" })}
      <section class="kpis k3">${kpi({ label: "Pieces on the floor", value: eq.reduce((s, e) => s + e.quantity, 0), delta: `${eq.length} equipment types`, cls: "dark", icon: "dumbbell" })}${kpi({ label: "Overdue service", value: over, delta: over ? "service these first" : "none", cls: over ? "alert" : "", icon: "wrench" })}${kpi({ label: "Due in 14 days", value: soon, delta: "book the technician", icon: "cal" })}</section>
      <section class="card fade">${U.table({ rows: eq, cols: [
        { label: "Equipment", html: e => `<b>${esc(e.name)}</b>` }, { label: "Category", html: e => esc(e.category) }, { label: "Qty", cls: "num", html: e => e.quantity },
        { label: "Last service", html: e => fdate(e.last_service_date) }, { label: "Next due", html: e => fdate(e.next_service_due) },
        { label: "Status", html: e => `<span class="tag ${eqStatus(e)[1]}">${eqStatus(e)[0]}</span>` },
        ...(manage ? [{ label: "", cls: "num", html: e => `<div class="acts"><button class="btn btn-ink btn-xs" data-act="eq-serviced" data-id="${e.equipment_id}">Serviced today</button><button class="btn btn-ghost btn-xs" data-act="eq-form" data-id="${e.equipment_id}">Edit</button></div>` }] : [])] })}</section>`,
      after: A.wireSearch
    };
  });
  A.ACT["eq-serviced"] = el => { const e = S.get("Equipment", el.dataset.id); S.tx(() => S.update("Equipment", e.equipment_id, { last_service_date: S.TODAY, next_service_due: S.addDays(S.TODAY, 90) })); U.toast(`${e.name} marked serviced. Next due ${fdate(S.addDays(S.TODAY, 90))}`); A.refresh(); };
  A.ACT["eq-form"] = el => {
    const e = el.dataset.id ? S.get("Equipment", el.dataset.id) : null;
    U.form({ title: e ? `Edit ${e.name}` : "Add equipment", fields: [
      { name: "name", label: "Name", required: true, value: e ? e.name : "", maxlength: 100 },
      { name: "category", label: "Category", type: "select", options: ["Cardio", "Strength", "Free Weights", "Accessories"].map(x => [x, x]), value: e ? e.category : "Strength" },
      { name: "quantity", label: "Quantity", type: "number", min: 0, step: 1, value: e ? e.quantity : 1, required: true },
      { name: "last_service_date", label: "Last serviced", type: "date", value: e ? e.last_service_date : S.TODAY, required: true }],
      onSubmit: v => { const row = { name: v.name, category: v.category, quantity: U.num(v.quantity, "Quantity"), last_service_date: v.last_service_date, next_service_due: S.addDays(v.last_service_date, 90) }; S.tx(() => e ? S.update("Equipment", e.equipment_id, row) : S.insert("Equipment", row)); U.toast(e ? "Saved" : `${v.name} added`); A.refresh(); } });
  };

  const IMAGES = [["https://images.unsplash.com/photo-1728486145245-d4cb0c9c3470?w=900&q=70&auto=format&fit=crop", "Gym floor"], ["https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=900&q=70&auto=format&fit=crop", "Group class"],
    ["https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=900&q=70&auto=format&fit=crop", "Battle ropes"], ["https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=70&auto=format&fit=crop", "Deadlift"], ["https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&q=70&auto=format&fit=crop", "Personal training"], ["", "No image"]];
  A.route("/updates", "updates.manage", () => ({
    html: `${header("Updates", { kicker: "Posts appear in the homepage's Live updates feed", actions: `<button class="btn btn-yellow" data-act="post-form">${ico("plus")}New post</button>` })}
    <div class="posts">${S.all("Announcement").slice().sort((a, b) => b.posted_date.localeCompare(a.posted_date)).map(p => `<article class="card post fade${p.is_published ? "" : " unpub"}">${p.image_path ? `<img src="${esc(p.image_path)}" alt="" loading="lazy">` : ""}
      <div class="pb"><div style="display:flex;gap:8px;align-items:center"><span class="tag y">${esc(p.tag)}</span>${p.is_published ? "" : '<span class="tag">Hidden</span>'}<small class="muted">${fdate(p.posted_date)} · ${esc(A.userName(p.posted_by))}</small></div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>
      <div class="pf"><button class="btn btn-ghost btn-xs" data-act="post-form" data-id="${p.announcement_id}">Edit</button><button class="btn btn-ghost btn-xs" data-act="post-toggle" data-id="${p.announcement_id}">${p.is_published ? "Hide from site" : "Publish"}</button></div></article>`).join("")}</div>`,
    after: A.wireSearch
  }));
  A.ACT["post-form"] = el => {
    const p = el.dataset.id ? S.get("Announcement", el.dataset.id) : null;
    U.form({ title: p ? "Edit post" : "New post", fields: [
      { name: "title", label: "Title", required: true, value: p ? p.title : "", maxlength: 120, full: true },
      { name: "tag", label: "Type", type: "select", options: ["Announcement", "Class", "Offer", "Event"].map(x => [x, x]), value: p ? p.tag : "Announcement" },
      { name: "image_path", label: "Image", type: "select", options: IMAGES, value: p ? p.image_path : IMAGES[0][0], hint: "In the real site staff upload a photo instead." },
      { name: "body", label: "Text", type: "textarea", required: true, value: p ? p.body : "", maxlength: 500 }],
      submit: p ? "Save" : "Publish",
      onSubmit: v => { S.tx(() => p ? S.update("Announcement", p.announcement_id, v) : S.insert("Announcement", Object.assign(v, { posted_date: S.TODAY, posted_by: S.session.user.user_id, is_published: true }))); U.toast(p ? "Post updated" : "Published to the homepage feed"); A.refresh(); } });
  };
  A.ACT["post-toggle"] = el => { const p = S.get("Announcement", el.dataset.id); S.tx(() => S.update("Announcement", p.announcement_id, { is_published: !p.is_published })); U.toast(p.is_published ? "Published" : "Hidden from the homepage"); A.refresh(); };

  const LEAD_TAG = { New: "y", Contacted: "b", Converted: "g" };
  A.route("/leads", "leads.manage", (_, q) => {
    const st = q.status || "open";
    const leads = S.all("Lead").slice().sort((a, b) => b.submitted_date.localeCompare(a.submitted_date)).filter(l => st === "all" || (st === "open" ? ["New", "Contacted"].includes(l.status) : l.status === st));
    const n = s => S.where("Lead", l => s === "open" ? ["New", "Contacted"].includes(l.status) : s === "all" || l.status === s).length;
    return {
      html: `${header("Leads", { kicker: "From the website's Get started form · a person reviews every lead" })}
      ${tabsHtml("/leads", [["open", "Open", n("open")], ["Converted", "Converted", n("Converted")], ["all", "All", n("all")]].map(([k, l, c]) => [k, l, c]), st).replace(/\?tab=/g, "?status=")}
      <section class="card fade">${U.table({ rows: leads, empty: "No leads here", cols: [
        { label: "Name", html: l => U.who(l.name, esc(l.contact)) },
        { label: "Interested in", html: l => esc(l.interest) },
        { label: "Message", html: l => l.message ? `<span class="muted">${esc(l.message)}</span>` : '<span class="muted">—</span>' },
        { label: "Received", html: l => U.rel(l.submitted_date) },
        { label: "Status", html: l => `<span class="tag ${LEAD_TAG[l.status]}">${l.status}</span>` },
        { label: "", cls: "num", html: l => l.status === "Converted" ? "" : `<div class="acts">${l.status === "New" ? `<button class="btn btn-ghost btn-xs" data-act="lead-status" data-id="${l.lead_id}" data-s="Contacted">Mark contacted</button>` : ""}${S.can("member.create") ? `<button class="btn btn-ink btn-xs" data-act="lead-convert" data-id="${l.lead_id}">Convert to member</button>` : ""}<button class="btn btn-ghost btn-xs" data-act="lead-decline" data-id="${l.lead_id}">Decline</button></div>` }] })}</section>`,
      after: A.wireSearch
    };
  });
  A.ACT["lead-status"] = el => { S.tx(() => S.update("Lead", +el.dataset.id, { status: el.dataset.s })); U.toast(`Lead marked ${el.dataset.s.toLowerCase()}`); A.refresh(); };
  A.ACT["lead-decline"] = el => {
    const l = S.get("Lead", el.dataset.id);
    U.confirm({ title: `Decline ${l.name}'s enquiry?`, sub: "Their details are deleted for good. If they're interested later, they can send the Get started form again.", submit: "Decline and delete", danger: true,
      onConfirm: () => { S.tx(() => S.remove("Lead", l.lead_id)); U.toast("Enquiry declined and deleted"); A.refresh(); } });
  };
  A.ACT["lead-convert"] = el => A.addMemberFlow({ lead: S.get("Lead", el.dataset.id) });

  A.route("/reports", "reports.view", () => {
    const allRev = S.revenueIn("2000-01-01", S.TODAY);
    const months = Array.from({ length: 6 }, (_, i) => { const from = S.monthStart(i - 5), to = S.addDays(S.monthStart(i - 4), -1); return { label: S.parse(from).toLocaleDateString("en-GB", { month: "short" }), value: S.revenueIn(from, to) }; });
    const active = S.all("Member").map(m => S.currentMembership(m.member_id)).filter(Boolean);
    const byPlan = S.all("MembershipPlan").map(p => ({ label: p.plan_type, value: active.filter(ms => ms.plan_id === p.plan_id).length }));
    const since90 = S.addDays(S.TODAY, -90);
    const methods = A.METHODS.map(([m]) => ({ label: m, value: S.where("Payment", p => p.status === "valid" && p.method === m && p.payment_date >= since90).reduce((s, p) => s + p.amount, 0) })).sort((a, b) => b.value - a.value);
    const since28 = S.addDays(S.TODAY, -28);
    const classAtt = [...new Set(S.all("ClassSchedule").map(c => c.class_name))].map(n => ({ label: n, value: S.where("ClassAttendance", a => { const o = S.get("GroupClass", a.occurrence_id); return a.status === "Attended" && o.occurrence_date >= since28 && S.get("ClassSchedule", o.class_id).class_name === n; }).length })).sort((a, b) => b.value - a.value);
    const since30 = S.addDays(S.TODAY, -30);
    const trainers = S.all("Trainer").map(t => ({ label: t.name, value: S.where("Session", s => S.sessionTrainer(s) === t.trainer_id && s.status === "Completed" && s.session_date >= since30).length })).sort((a, b) => b.value - a.value);
    const due = S.all("Equipment").filter(e => e.next_service_due <= S.addDays(S.TODAY, 14)).sort((a, b) => a.next_service_due.localeCompare(b.next_service_due));
    const visits = S.where("CheckIn", c => c.check_in_time >= since30).length;
    return {
      html: `${header("Reports", { kicker: `Moksha Fitness · generated ${fdate(S.TODAY)}`, actions: `<button class="btn btn-yellow" data-act="print">${ico("printer")}Download PDF</button>` })}
      <section class="kpis k6">
        ${kpi({ label: "Total revenue collected", value: rsK(allRev), delta: "all valid payments", cls: "dark", icon: "money" })}
        ${kpi({ label: "Still owed (all members)", value: rsK(S.owedTotal()), delta: `${S.all("Member").filter(m => S.memberOwed(m.member_id) > 0).length} members`, cls: "alert", icon: "inbox" })}
        ${kpi({ label: "This month", value: rsK(S.revenueIn(S.monthStart(0), S.TODAY)), delta: "collected so far", icon: "chart" })}
        ${kpi({ label: "Active members", value: active.length, delta: `of ${S.all("Member").length} on record`, icon: "users" })}
        ${kpi({ label: "Gym visits (30 days)", value: visits, delta: `${(visits / 30).toFixed(1)} per day`, icon: "door" })}
        ${kpi({ label: "Active PT clients", value: S.where("PersonalTrainingEnrollment", e => !e.end_date || e.end_date >= S.TODAY).length, delta: `${S.all("Trainer").length} trainers`, icon: "dumbbell" })}
      </section>
      <div class="grid g-2-1">
        <section class="card fade"><div class="card-head"><div><h2>Revenue trend</h2><div class="sub">Valid payments per month (Rs.)</div></div></div>${U.bars(months, { fmt: v => (v / 1000).toFixed(0) + "k", labels: true })}<div class="chart-foot"><div><b>${rs(months.reduce((s, m) => s + m.value, 0))}</b>6-month total</div><div><b>${rs(months.reduce((s, m) => s + m.value, 0) / 6)}</b>monthly average</div></div></section>
        <section class="card fade"><div class="card-head"><div><h2>Members by plan</h2><div class="sub">Current memberships</div></div></div>${U.donut(byPlan, { center: active.length, centerLabel: "active" })}</section>
      </div>
      <div class="grid g-1-1">
        <section class="card fade"><div class="card-head"><div><h2>Payment methods</h2><div class="sub">Amount collected, last 90 days</div></div></div>${U.hbars(methods, { fmt: v => rs(v) })}</section>
        <section class="card fade"><div class="card-head"><div><h2>Class attendance</h2><div class="sub">Check-ins per class, last 4 weeks</div></div></div>${U.hbars(classAtt)}</section>
      </div>
      <div class="grid g-1-1">
        <section class="card fade"><div class="card-head"><div><h2>Top trainers</h2><div class="sub">Completed PT sessions, last 30 days</div></div></div>${U.hbars(trainers)}</section>
        <section class="card fade"><div class="card-head"><div><h2>Equipment due for service</h2><div class="sub">Overdue or within 14 days</div></div></div>${U.table({ rows: due, empty: "Nothing due", cols: [{ label: "Equipment", html: e => esc(e.name) }, { label: "Due", html: e => fdate(e.next_service_due) }, { label: "", html: e => `<span class="tag ${eqStatus(e)[1]}">${eqStatus(e)[0]}</span>` }] })}</section>
      </div>
      <p class="muted no-print" style="font-size:14px">In the real app, "Download PDF" runs the existing report.py (reportlab + matplotlib) on the server. Here it opens your browser's Save as PDF.</p>`,
      after: A.wireSearch
    };
  });

  A.route("/audit", "audit.view", (_, q) => {
    const t = q.table || "";
    const rows = S.all("AuditLog").filter(a => !t || a.table_name === t).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const tables = [...new Set(S.all("AuditLog").map(a => a.table_name))];
    const fmtV = v => v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
    const diff = a => {
      if (a.action === "create") return `<span class="muted">${esc(Object.entries(a.new_values || {}).filter(([k]) => !/_id$/.test(k) || k === "member_id").slice(0, 3).map(([k, v]) => `${k}: ${fmtV(v)}`).join(" · "))}</span>`;
      return `<div class="diff">${Object.keys(a.new_values || {}).map(k => `<div><span class="muted">${esc(k)}</span><s>${esc(fmtV((a.old_values || {})[k]))}</s><ins>${esc(fmtV(a.new_values[k]))}</ins></div>`).join("")}</div>`;
    };
    const href = a => a.table_name === "Payment" ? `/members/${(S.get("Payment", a.record_id) || {}).member_id}?tab=payments` : a.table_name === "Member" ? `/members/${a.record_id}` : null;
    return {
      html: `${header("Audit log", { kicker: "Append-only: nobody can edit or delete these rows, not even the owner" })}
      <section class="card fade"><div class="filters" style="padding-top:18px"><div class="sel"><select id="audT" aria-label="Table"><option value="">All records</option>${tables.map(x => `<option${x === t ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></div><span class="muted" style="font-size:14px">${plural(rows.length, "entry")}</span></div>
      ${U.table({ rows: rows.slice(0, 150), href: a => href(a) || "/audit", empty: "No changes recorded yet", cols: [
        { label: "When", html: a => `<span class="nowrap">${U.rel(a.created_at)}</span><br><small class="muted">${esc(a.created_at)}</small>` },
        { label: "Who", html: a => { const u = S.get("User", a.user_id); return `<b>${esc(u ? u.display_name : "—")}</b><br><small class="muted">${u ? esc(S.ROLE_LABEL[u.role]) : ""}</small>`; } },
        { label: "Action", html: a => `<span class="tag ${a.action === "create" ? "g" : "a"}">${esc(a.action)}</span>` },
        { label: "Record", html: a => `${esc(a.table_name)} #${a.record_id}` },
        { label: "Change", html: diff },
        { label: "Reason", html: a => a.reason ? esc(a.reason) : '<span class="muted">—</span>' }] })}</section>`,
      after: () => { A.wireSearch(); document.getElementById("audT").onchange = e => location.hash = "#/audit" + (e.target.value ? "?table=" + encodeURIComponent(e.target.value) : ""); }
    };
  });

  A.route("/settings", "staff.manage", () => ({
    html: `${header("Staff & pricing", { kicker: "Owner only", actions: `<button class="btn btn-yellow" data-act="user-form">${ico("plus")}Add account</button>` })}
    <section class="card fade"><div class="card-head"><div><h2>Accounts & roles</h2><div class="sub">Each person gets their own login. A new account gets a one-time temporary password, and the person must choose their own at first login. Passwords are stored only as hashes: nobody, including the owner, can see them.</div></div></div>
      ${U.table({ rows: S.all("User").slice().sort((a, b) => ["owner", "accountant", "front_desk", "trainer", "member"].indexOf(a.role) - ["owner", "accountant", "front_desk", "trainer", "member"].indexOf(b.role)), cols: [
        { label: "Person", html: u => U.who(u.display_name, "@" + esc(u.username)) },
        { label: "Role", html: u => `<span class="tag ${u.role === "owner" ? "k" : u.role === "accountant" ? "b" : u.role === "front_desk" ? "y" : ""}">${esc(S.ROLE_LABEL[u.role])}</span>` },
        { label: "Linked to", html: u => u.member_id ? `Member: ${esc(memberName(u.member_id))}` : u.trainer_id ? `Trainer: ${esc(trainerName(u.trainer_id))}` : '<span class="muted">—</span>' },
        { label: "Last login", html: u => u.last_login ? U.rel(u.last_login) : '<span class="muted">never</span>' },
        { label: "Status", html: u => u.is_active ? '<span class="tag g">Active</span>' : '<span class="tag r">Disabled</span>' },
        { label: "", cls: "num", html: u => u.user_id === S.session.user.user_id ? '<span class="muted">you</span>' : `<div class="acts">${["owner", "accountant", "front_desk"].includes(u.role) ? `<button class="btn btn-ghost btn-xs" data-act="user-role" data-id="${u.user_id}">Role</button>` : ""}${S.mode === "api" ? `<button class="btn btn-ghost btn-xs" data-act="user-reset-pw" data-id="${u.user_id}">Reset password</button>` : ""}<button class="btn btn-ghost btn-xs" data-act="user-toggle" data-id="${u.user_id}">${u.is_active ? "Disable" : "Enable"}</button></div>` }] })}</section>
    <section class="card fade"><div class="card-head"><div><h2>Membership plans & prices</h2><div class="sub">Changing a price only affects new memberships. Existing members keep the price they agreed to.</div></div><button class="btn btn-ghost btn-sm" data-act="plan-price">${ico("plus")}Add plan</button></div>
      ${U.table({ rows: S.all("MembershipPlan"), cols: [
        { label: "Plan", html: p => `<b>${esc(p.plan_type)}</b>` }, { label: "Length", html: p => plural(p.duration_months, "month") }, { label: "Price", cls: "num", html: p => rs(p.price) },
        { label: "Active members", cls: "num", html: p => S.all("Member").filter(m => { const c = S.currentMembership(m.member_id); return c && c.plan_id === p.plan_id; }).length },
        { label: "", cls: "num", html: p => `<button class="btn btn-ghost btn-xs" data-act="plan-price" data-id="${p.plan_id}">Edit</button>` }] })}</section>
    ${S.mode === "api" ? "" : `<section class="card fade"><div class="card-head"><div><h2>Prototype</h2><div class="sub">This design prototype keeps its data in your browser.</div></div><button class="btn btn-danger btn-sm" data-act="reset-demo">Reset demo data</button></div></section>`}`,
    after: A.wireSearch
  }));
  A.ACT["user-form"] = () => {
    U.form({ title: "Add account", sub: "You'll get a one-time temporary password to give them in person. They choose their own at first login.", fields: [
      { name: "display_name", label: "Full name", required: true, maxlength: 100 },
      { name: "username", label: "Username", required: true, maxlength: 40, placeholder: "e.g. reception2" },
      { name: "role", label: "Role", type: "select", options: Object.entries(S.ROLE_LABEL), value: "front_desk" },
      { name: "link", label: "Link to (trainer/member accounts)", type: "select", options: [["", "—"], ...S.all("Trainer").map(t => ["t" + t.trainer_id, "Trainer: " + t.name]), ...S.all("Member").map(m => ["m" + m.member_id, "Member: " + m.name])] }],
      submit: "Create account",
      onSubmit: v => {
        if (!/^[a-z0-9._-]{3,40}$/i.test(v.username)) throw new Error("Username: 3–40 letters, numbers, dots, dashes or underscores.");
        const tid = v.link.startsWith("t") ? +v.link.slice(1) : null, mid = v.link.startsWith("m") ? +v.link.slice(1) : null;
        if (v.role === "trainer" && !tid) throw new Error("A trainer account must be linked to a trainer.");
        if (v.role === "member" && !mid) throw new Error("A member account must be linked to a member.");
        if (["owner", "accountant", "front_desk"].includes(v.role) && (tid || mid)) throw new Error("Staff accounts aren't linked to a member or trainer.");
        S.tx(() => S.insert("User", { username: v.username.toLowerCase(), display_name: v.display_name, role: v.role, member_id: mid, trainer_id: tid, is_active: true, last_login: null }));
        A.refresh();
        const tp = S.lastNotices.find(n => n.type === "temp_password");
        if (S.mode === "api" && tp) setTimeout(() => showTempPassword(v.display_name, tp.username, tp.password), 50);
        else U.toast(`Account created for ${v.display_name}.`);
      } });
  };
  function showTempPassword(name, username, password) {
    U.modal({ title: "Temporary password", sub: `Give this to ${name} in person. It's shown only once and works until they set their own.`, cancel: "Done",
      body: () => `<dl class="kv"><dt>Username</dt><dd><b>${esc(username)}</b></dd><dt>Temporary password</dt><dd><code style="font-size:20px;letter-spacing:.06em">${esc(password)}</code></dd></dl>` });
  }
  A.ACT["user-reset-pw"] = el => {
    const u = S.get("User", el.dataset.id);
    U.confirm({ title: `Reset ${u.display_name}'s password?`, sub: "Their current password stops working and they're logged out everywhere. You'll get a new temporary password to give them.", submit: "Reset password", danger: true,
      onConfirm: () => { const r = S.post(`api/users/${u.user_id}/reset-password`); setTimeout(() => showTempPassword(u.display_name, r.username, r.password), 50); } });
  };
  A.ACT["user-role"] = el => {
    const u = S.get("User", el.dataset.id);
    U.form({ title: `Change role · ${u.display_name}`, sub: "Takes effect at their next request: the server checks the role every time.", fields: [{ name: "role", label: "Role", type: "select", options: [["owner", "Owner"], ["accountant", "Accountant"], ["front_desk", "Front desk"]], value: u.role, full: true }, { name: "reason", label: "Reason", type: "textarea", required: true }],
      onSubmit: v => { S.tx(() => S.update("User", u.user_id, { role: v.role }, v.reason)); U.toast("Role changed and logged"); A.refresh(); } });
  };
  A.ACT["user-toggle"] = el => { const u = S.get("User", el.dataset.id); S.tx(() => S.update("User", u.user_id, { is_active: !u.is_active }, u.is_active ? "Account disabled" : "Account re-enabled")); U.toast(u.is_active ? "Account enabled" : "Account disabled. They can't log in."); A.refresh(); };
  A.ACT["plan-price"] = el => {
    const p = el.dataset.id ? S.get("MembershipPlan", el.dataset.id) : null;
    U.form({ title: p ? `Edit ${p.plan_type}` : "Add membership plan", fields: [
      { name: "plan_type", label: "Plan name", required: true, value: p ? p.plan_type : "", maxlength: 30 },
      { name: "duration_months", label: "Length (months)", type: "number", min: 1, max: 24, step: 1, value: p ? p.duration_months : 1, required: true },
      { name: "price", label: "Price (Rs.)", type: "number", min: 0, step: 100, value: p ? p.price : "", required: true, full: true }],
      onSubmit: v => { const row = { plan_type: v.plan_type, duration_months: U.num(v.duration_months, "Length", { min: 1 }), price: U.num(v.price, "Price") }; S.tx(() => p ? S.update("MembershipPlan", p.plan_id, row) : S.insert("MembershipPlan", row)); U.toast("Saved. New memberships use this price."); A.refresh(); } });
  };
})();
