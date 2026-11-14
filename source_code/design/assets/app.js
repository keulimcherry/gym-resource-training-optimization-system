(function () {
  "use strict";
  const S = window.Store, U = window.UI;
  const { esc, rs, fdate, fshort, ftime, dayLabel, initials, ico, toast } = U;

  const NAV = {
    owner: [["Daily"], ["Dashboard", "grid", "/"], ["Members", "users", "/members"], ["Check-in & attendance", "check", "/attendance"], ["PT & sessions", "dumbbell", "/pt", "changes"], ["Progress", "trend", "/progress"], ["Classes", "cal", "/classes"],
      ["Business"], ["Payments", "money", "/payments"], ["Reports", "chart", "/reports"], ["Leads", "inbox", "/leads", "leads"], ["Updates", "mega", "/updates"],
      ["Admin"], ["Trainers", "user", "/trainers"], ["Equipment", "wrench", "/equipment"], ["Audit log", "shield", "/audit"], ["Staff & pricing", "settings", "/settings"]],
    accountant: [["Finance"], ["Dashboard", "grid", "/"], ["Payments", "money", "/payments"], ["Dues", "inbox", "/payments?tab=dues"], ["Reports", "chart", "/reports"], ["Audit log", "shield", "/audit"],
      ["Lookup"], ["Members", "users", "/members"]],
    front_desk: [["Daily"], ["Dashboard", "grid", "/"], ["Members", "users", "/members"], ["Check-in & attendance", "check", "/attendance"], ["Payments", "money", "/payments"], ["PT & sessions", "dumbbell", "/pt", "changes"], ["Classes", "cal", "/classes"],
      ["Front of house"], ["Leads", "inbox", "/leads", "leads"], ["Updates", "mega", "/updates"], ["Trainers", "user", "/trainers"], ["Equipment", "wrench", "/equipment"], ["Progress", "trend", "/progress"]],
    trainer: [["Coaching"], ["Today", "grid", "/"], ["My clients", "users", "/clients"], ["Sessions", "cal", "/pt", "requests"], ["Progress logs", "trend", "/progress"], ["My classes", "check", "/classes"]],
    member: [["My Moksha"], ["Overview", "grid", "/"], ["My progress", "trend", "/me/progress"], ["Sessions", "cal", "/me/sessions"], ["Classes", "users", "/me/classes"], ["Payments", "money", "/me/payments"], ["Profile", "user", "/me/profile"]]
  };
  const AREA = { owner: "Owner", accountant: "Accounts", front_desk: "Front desk", trainer: "Trainer", member: "Member" };
  const counters = {
    leads: () => S.where("Lead", l => l.status === "New").length,
    requests: () => S.where("Session", s => s.status === "Requested" && visibleEnrollment(s.pt_enrollment_id)).length
      + S.where("SessionChangeRequest", r => r.status === "Pending" && visibleEnrollment(S.get("Session", r.session_id).pt_enrollment_id)).length,
    changes: () => (S.can("pt.assign") ? S.where("TrainerChange", c => c.status === "Pending").length : 0) + counters.requests()
  };
  const visibleEnrollment = eid => { const e = S.get("PersonalTrainingEnrollment", eid); return e && (S.session.role !== "trainer" || e.trainer_id === S.myTrainerId()) && (S.session.role !== "member" || e.member_id === S.myMemberId()); };

  function renderSide(path) {
    const u = S.session.user;
    document.getElementById("areaLabel").textContent = AREA[S.session.role];
    document.getElementById("meName").textContent = u.display_name;
    document.getElementById("meRole").textContent = S.ROLE_LABEL[S.session.role] + " · @" + u.username;
    document.getElementById("meAv").textContent = initials(u.display_name);
    const base = path.split("?")[0];
    document.getElementById("navList").innerHTML = NAV[S.session.role].map(([label, icon, href, counter]) => {
      if (!icon) return `<div class="side-label">${esc(label)}</div>`;
      const hBase = href.split("?")[0];
      const active = href === path || (hBase === base && !href.includes("?") && !NAV[S.session.role].some(n => n[2] === path)) || (hBase !== "/" && base.startsWith(hBase + "/"));
      const n = counter ? counters[counter]() : 0;
      return `<a class="nav-item${active ? " active" : ""}" href="#${href}"${active ? ' aria-current="page"' : ""}>${ico(icon)}${esc(label)}${n ? `<span class="count">${n}</span>` : ""}</a>`;
    }).join("");
    document.querySelectorAll(".proto button").forEach(b => b.classList.toggle("on", b.dataset.r === S.session.role));
  }

  const routes = [];
  const route = (pattern, perm, fn) => routes.push({ re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), perm, fn });
  function current() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    return { raw, path, q: Object.fromEntries(new URLSearchParams(qs || "")) };
  }
  function denied() {
    return `${header("Not available", { kicker: "Access" })}<div class="card denied fade">${ico("lock")}<b>Your role can't open this page</b><p class="muted">${esc(S.ROLE_LABEL[S.session.role])} accounts don't have access here. In the real system the server refuses the request too, not just the menu.</p></div>`;
  }
  function render() {
    const { raw, path, q } = current();
    const main = document.getElementById("main");
    let html = null, after = null;
    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;
      const allowed = typeof r.perm === "function" ? r.perm(m.groups || {}) : (!r.perm || S.can(r.perm));
      if (!allowed) { html = denied(); break; }
      const out = r.fn(m.groups || {}, q);
      if (typeof out === "string") { location.replace("#" + out); return; }
      html = out.html; after = out.after; break;
    }
    if (html == null) html = denied();
    main.innerHTML = html;
    main.querySelectorAll(".fade").forEach((el, i) => el.style.animationDelay = Math.min(i, 8) * 50 + "ms");
    renderSide(raw);
    U.animateCharts(main);
    if (after) after(main);
    document.getElementById("app").classList.remove("nav-open");
  }
  let keepScroll = false;
  const refresh = () => { keepScroll = true; const y = scrollY; render(); scrollTo(0, y); keepScroll = false; };
  window.addEventListener("hashchange", () => { render(); if (!keepScroll) scrollTo(0, 0); });

  function header(title, { kicker, crumbs, actions = "", search = true } = {}) {
    const k = kicker ?? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const showSearch = search && S.session.role !== "member";
    return `<header class="top fade">
      <div class="top-left"><button class="menu-btn" data-act="menu" aria-label="Open menu">${ico("menu")}</button>
        <div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : `<div class="kicker">${esc(k)}</div>`}<h1>${esc(title)}</h1></div></div>
      <div class="top-actions">${window.Sched ? window.Sched.bellHtml() : ""}${showSearch ? `<div class="search" style="position:relative"><label>${ico("search")}<span class="sr">Search</span><input id="gsearch" autocomplete="off" placeholder="Search members, trainers, classes…"></label><div class="search-results" id="gresults" role="listbox"></div></div>` : ""}${actions}</div>
    </header>`;
  }
  function wireSearch() {
    const inp = document.getElementById("gsearch"), box = document.getElementById("gresults");
    if (!inp) return;
    inp.addEventListener("input", () => {
      const t = inp.value.trim().toLowerCase();
      if (t.length < 2) { box.classList.remove("show"); return; }
      const res = [];
      S.all("Member").filter(m => S.canSeeMember(m.member_id) && (m.name.toLowerCase().includes(t) || m.contact_number.includes(t) || m.email.includes(t))).slice(0, 6)
        .forEach(m => res.push([`#/members/${m.member_id}`, m.name, "Member · " + S.memberStatus(m.member_id).label]));
      if (S.can("trainer.view")) S.all("Trainer").filter(x => x.name.toLowerCase().includes(t)).forEach(x => res.push(["#/trainers", x.name, "Trainer"]));
      if (S.can("class.view")) [...new Set(S.all("ClassSchedule").filter(c => c.class_name.toLowerCase().includes(t)).map(c => c.class_name))].forEach(n => res.push(["#/classes", n, "Class"]));
      box.innerHTML = res.length ? res.slice(0, 8).map(([h, n, s]) => `<a href="${h}">${esc(n)}<small>${esc(s)}</small></a>`).join("") : `<a href="javascript:void 0">No matches<small></small></a>`;
      box.classList.add("show");
    });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { const a = box.querySelector("a[href^='#']"); if (a) location.hash = a.getAttribute("href"); } if (e.key === "Escape") box.classList.remove("show"); });
    document.addEventListener("click", e => { if (!e.target.closest(".search")) box.classList.remove("show"); });
  }

  function kpi({ label, value, delta = "", cls = "", icon = "grid", live, href }) {
    const tag = href ? "a" : "div";
    return `<${tag} class="card kpi ${cls} fade"${href ? ` href="#${href}"` : ""}>${ico(icon, "bg-ico")}<div class="label">${live ? '<span class="dot"></span>' : ""}${esc(label)}</div><div class="value">${value}</div><div class="delta">${delta}</div></${tag}>`;
  }
  const memberName = id => (S.get("Member", id) || {}).name || "—";
  const trainerName = id => (S.get("Trainer", id) || {}).name || "—";
  const userName = id => (S.get("User", id) || {}).display_name || "—";
  function statusTag(mid) { const s = S.memberStatus(mid); return `<span class="tag ${s.cls}">${esc(s.label)}</span>`; }
  const SESSION_TAG = { Completed: "g", Scheduled: "b", "No-show": "r", Cancelled: "", Requested: "y" };
  const ATT_TAG = { Attended: "g", "No-show": "r", Cancelled: "" };
  function paymentFor(p) {
    if (p.membership_id) { const ms = S.get("Membership", p.membership_id); return ms ? S.planOf(ms).plan_type : "Membership"; }
    if (p.pt_enrollment_id) { const e = S.get("PersonalTrainingEnrollment", p.pt_enrollment_id); return e ? "PT · " + trainerName(e.trainer_id) : "PT"; }
    return "Not linked";
  }
  const memberOptions = (filter = () => true) => S.all("Member").filter(m => S.canSeeMember(m.member_id) && filter(m)).sort((a, b) => a.name.localeCompare(b.name)).map(m => [m.member_id, m.name]);
  const trainerOptions = () => S.all("Trainer").map(t => [t.trainer_id, `${t.name} · ${t.specialization}`]);
  const METHODS = ["Cash", "Mobile Banking", "Card", "Bank Transfer"].map(m => [m, m]);
  const SLOTS = ["06:00", "06:30", "07:00", "07:30", "08:00", "09:00", "10:00", "12:00", "16:00", "17:00", "17:30", "18:00", "18:30", "19:00", "20:00"].map(t => [t, ftime(t)]);

  function addMemberFlow({ member, lead, ptOnly } = {}) {
    const plans = S.all("MembershipPlan");
    const existing = !!member;
    const leadEmail = !!lead && /@/.test(lead.contact), wantsPT = !!lead && lead.interest === "Personal training";
    const leadNote = lead ? `<div class="lead-note"><b>From their enquiry · ${U.rel(lead.submitted_date)}</b>Interested in ${esc(lead.interest)}${lead.message ? `: “${esc(lead.message)}”` : "."} Copy anything about injuries or health into medical history.</div>` : "";
    const body = p => `${leadNote}
      ${existing ? "" : `<section class="m-section"><h3>1 · Member details</h3>${U.fieldsHtml([
        { name: "name", label: "Full name", required: true, maxlength: 100, value: lead ? lead.name : "" },
        { name: "contact_number", label: "Phone", type: "tel", required: true, maxlength: 20, value: lead && !leadEmail ? lead.contact : "", placeholder: "98XXXXXXXX" },
        { name: "email", label: "Email", type: "email", required: true, maxlength: 120, full: true, value: leadEmail ? lead.contact : "" },
        U.medField("")
      ], p)}</section>`}
      <section class="m-section${ptOnly ? " off" : ""}" id="${p}-ms"><h3>${existing ? "Membership" : "2 · Membership"}</h3>${U.fieldsHtml([
        { name: "plan_id", label: "Membership plan", type: "select", value: ptOnly ? "" : plans[1].plan_id, options: [...plans.map(pl => [pl.plan_id, `${pl.plan_type} · ${pl.duration_months} mo · ${rs(pl.price)}`]), ["", "No membership now"]] },
        { name: "start_date", label: "Starts on", type: "date", value: S.TODAY, required: true },
        { name: "end_date", label: "Ends on (auto)", type: "readonly", value: "" },
        { name: "agreed_price", label: "Agreed price (Rs.)", type: "number", min: 0, step: 50, hint: "Defaults to the plan price. Change only for an approved discount." }
      ], p)}</section>
      <section class="m-section${ptOnly ? "" : " off"}" id="${p}-pt"><h3><span>${existing ? "Personal training" : "3 · Personal training"}</span><label class="check" style="font:600 14px var(--body);text-transform:none;letter-spacing:0"><input type="checkbox" id="${p}-pton"${ptOnly || wantsPT ? " checked" : ""}> Add PT</label></h3>${U.fieldsHtml([
        { name: "trainer_id", label: "Trainer", type: "select", options: trainerOptions(), required: true },
        { name: "pt_start", label: "PT starts on", type: "date", value: S.TODAY, required: true },
        { name: "goal", label: "Goal", required: true, maxlength: 255, full: true, placeholder: "e.g. Lose 8 kg and build a strength base" },
        { name: "fee", label: "PT fee (Rs.)", type: "number", min: 0, step: 500, value: 12000, required: true }
      ], p)}</section>
      ${S.can("payment.create") ? `<section class="m-section"><h3>${existing ? "Payment now" : "4 · Payment now"}</h3>${U.fieldsHtml([
        { name: "pay_ms", label: "Paying for membership (Rs.)", type: "number", min: 0, step: 50, value: "", placeholder: "0" },
        { name: "pay_pt", label: "Paying for PT (Rs.)", type: "number", min: 0, step: 50, value: "", placeholder: "0" },
        { name: "pay_date", label: "Payment date", type: "date", value: S.TODAY },
        { name: "method", label: "Method", type: "select", options: METHODS }
      ], p)}<div class="hint" style="font-size:13px;color:var(--muted)">Each amount becomes its own Payment row, linked to the membership or the PT enrollment.</div></section>` : ""}
      <div class="summary" id="${p}-sum"></div>`;
    const dlg = U.modal({
      title: existing ? `Add plan or PT for ${member.name}` : lead ? `Convert lead: ${lead.name}` : "Add new member",
      sub: existing ? "Creates the membership / PT enrollment and its first payment in one step." : "Member, membership, personal training and the first payment are saved together. If anything fails, nothing is saved.",
      size: "wide", submit: existing ? "Save" : "Save member", body,
      onSubmit: v => {
        const ptOn = dlg.querySelector(`#${dlg.pfx}-pton`).checked;
        const plan = v.plan_id ? S.get("MembershipPlan", v.plan_id) : null;
        if (!plan && !ptOn && existing) throw new Error("Pick a membership plan or add personal training.");
        const payMs = U.num(v.pay_ms || 0, "Membership payment"), payPt = ptOn ? U.num(v.pay_pt || 0, "PT payment") : 0;
        const agreed = plan ? U.num(v.agreed_price || plan.price, "Agreed price") : 0;
        if (payMs && !plan) throw new Error("There's no membership to pay for. Pick a plan or clear the membership amount.");
        if (payMs > agreed) throw new Error("Membership payment is more than the agreed price.");
        const fee = ptOn ? U.num(v.fee, "PT fee") : 0;
        if (payPt > fee) throw new Error("PT payment is more than the PT fee.");
        if (!existing && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) throw new Error("That email doesn't look right.");
        const res = S.tx(() => {
          const m = existing ? member : S.insert("Member", { name: v.name, contact_number: v.contact_number, email: v.email, medical_history: v.medical_history, joined_date: S.TODAY });
          let ms = null, pt = null;
          if (plan) ms = S.insert("Membership", { member_id: m.member_id, plan_id: plan.plan_id, start_date: v.start_date, end_date: S.addMonthsEnd(v.start_date, plan.duration_months), agreed_price: agreed });
          if (ptOn) {
            pt = S.insert("PersonalTrainingEnrollment", { member_id: m.member_id, trainer_id: +v.trainer_id, goal: v.goal, start_date: v.pt_start, end_date: null, fee });
            S.insert("TrainingPlan", { pt_enrollment_id: pt.pt_enrollment_id, version_number: 1, is_current: true, created_date: v.pt_start, details: "v1 to be written by the trainer after the first assessment." });
          }
          const base = { member_id: m.member_id, payment_date: v.pay_date || S.TODAY, method: v.method || "Cash", status: "valid", void_reason: null, recorded_by: S.session.user.user_id };
          if (payMs) S.insert("Payment", Object.assign({}, base, { membership_id: ms.membership_id, pt_enrollment_id: null, amount: payMs }));
          if (payPt) S.insert("Payment", Object.assign({}, base, { membership_id: null, pt_enrollment_id: pt.pt_enrollment_id, amount: payPt }));
          if (lead) S.update("Lead", lead.lead_id, { status: "Converted" });
          return m;
        });
        const due = (plan ? S.membershipOwed(S.membershipsOf(res.member_id)[0].membership_id) : 0) + (ptOn ? S.ptOwed(S.enrollmentsOf(res.member_id)[0].pt_enrollment_id) : 0);
        toast(`${existing ? "Saved" : res.name + " added"}. Due: ${rs(due)}`);
        location.hash = `#/members/${res.member_id}`;
        refresh();
      }
    });
    const $ = n => dlg.querySelector(`[name="${n}"]`);
    const ptBox = dlg.querySelector(`#${dlg.pfx}-pt`), msBox = dlg.querySelector(`#${dlg.pfx}-ms`);
    const update = () => {
      const plan = $("plan_id").value ? S.get("MembershipPlan", $("plan_id").value) : null;
      msBox.querySelectorAll(".field").forEach((f, i) => { if (i) f.style.display = plan ? "" : "none"; });
      if (plan) {
        $("end_date").value = $("start_date").value ? fdate(S.addMonthsEnd($("start_date").value, plan.duration_months)) : "";
        if (!$("agreed_price").dataset.touched) $("agreed_price").value = plan.price;
      }
      const ptOn = dlg.querySelector(`#${dlg.pfx}-pton`).checked;
      ptBox.classList.toggle("off", !ptOn);
      if ($("pay_pt")) $("pay_pt").closest(".field").style.display = ptOn ? "" : "none";
      if ($("pay_ms")) $("pay_ms").closest(".field").style.display = plan ? "" : "none";
      const price = plan ? +$("agreed_price").value || 0 : 0, fee = ptOn ? +$("fee").value || 0 : 0;
      const paid = ($("pay_ms") && plan ? +$("pay_ms").value || 0 : 0) + ($("pay_pt") && ptOn ? +$("pay_pt").value || 0 : 0);
      const due = Math.max(0, price + fee - paid);
      dlg.querySelector(`#${dlg.pfx}-sum`).innerHTML = `${plan ? `<div><span>${esc(plan.plan_type)}</span><b>${rs(price)}</b></div>` : ""}${ptOn ? `<div><span>Personal training</span><b>${rs(fee)}</b></div>` : ""}
        <div><span>Paying now</span><b>− ${rs(paid)}</b></div><div class="total"><span>Due after saving</span><b class="${due ? "" : "zero"}">${rs(due)}</b></div>`;
    };
    dlg.addEventListener("input", e => { if (e.target.name === "agreed_price") e.target.dataset.touched = 1; update(); });
    dlg.addEventListener("change", update);
    update();
  }

  function linkOptions(mid) {
    const opts = [];
    S.membershipsOf(mid).forEach(ms => opts.push([`ms:${ms.membership_id}`, `${S.planOf(ms).plan_type} (${fshort(ms.start_date)}–${fshort(ms.end_date)}) · owes ${rs(S.membershipOwed(ms.membership_id))}`]));
    S.enrollmentsOf(mid).forEach(e => opts.push([`pt:${e.pt_enrollment_id}`, `PT with ${trainerName(e.trainer_id)} · owes ${rs(S.ptOwed(e.pt_enrollment_id))}`]));
    opts.push(["none", "Not linked (walk-in, merchandise, other)"]);
    return opts;
  }
  const owedFor = link => link.startsWith("ms:") ? S.membershipOwed(+link.slice(3)) : link.startsWith("pt:") ? S.ptOwed(+link.slice(3)) : 0;
  const linkToCols = link => ({ membership_id: link.startsWith("ms:") ? +link.slice(3) : null, pt_enrollment_id: link.startsWith("pt:") ? +link.slice(3) : null });
  function recordPayment(memberId) {
    const mid = memberId || memberOptions()[0][0];
    const firstOwing = l => l.find(([v]) => owedFor(v) > 0) || l[0];
    const links = linkOptions(mid), sel = firstOwing(links)[0];
    const dlg = U.form({
      title: "Record payment", sub: "Money received at the desk. Front desk can add payments but can't change them afterwards.",
      fields: [
        { name: "member_id", label: "Member", type: "select", options: memberOptions(), value: mid, required: true, full: true },
        { name: "link", label: "Apply to", type: "select", options: links, value: sel, full: true },
        { name: "amount", label: "Amount (Rs.)", type: "number", min: 1, step: 50, required: true, value: owedFor(sel) || "" },
        { name: "payment_date", label: "Date", type: "date", value: S.TODAY, required: true },
        { name: "method", label: "Method", type: "select", options: METHODS, full: true }
      ],
      submit: "Record payment",
      onSubmit: v => {
        const amount = U.num(v.amount, "Amount", { min: 1 });
        const owed = owedFor(v.link);
        if (v.link !== "none" && amount > owed) throw new Error(`That's more than what's owed (${rs(owed)}). Record the extra as a separate unlinked payment if it's for something else.`);
        S.tx(() => S.insert("Payment", Object.assign({ member_id: +v.member_id, amount, payment_date: v.payment_date, method: v.method, status: "valid", void_reason: null, recorded_by: S.session.user.user_id }, linkToCols(v.link))));
        toast(`${rs(amount)} recorded for ${memberName(+v.member_id)}. Still owed: ${rs(S.memberOwed(+v.member_id))}`);
        refresh();
      }
    });
    const m = dlg.querySelector("[name=member_id]"), l = dlg.querySelector("[name=link]"), a = dlg.querySelector("[name=amount]");
    m.addEventListener("change", () => {
      const opts = linkOptions(+m.value), s = firstOwing(opts)[0];
      l.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}"${v === s ? " selected" : ""}>${esc(t)}</option>`).join("");
      a.value = owedFor(s) || "";
    });
    l.addEventListener("change", () => { a.value = owedFor(l.value) || ""; });
  }
  function editPayment(id) {
    const p = S.get("Payment", id);
    const link = p.membership_id ? `ms:${p.membership_id}` : p.pt_enrollment_id ? `pt:${p.pt_enrollment_id}` : "none";
    U.form({
      title: `Edit payment #${p.payment_id}`, sub: `${esc(memberName(p.member_id))} · edits are updated in place and written to the audit log with your reason.`,
      fields: [
        { name: "link", label: "Apply to", type: "select", options: linkOptions(p.member_id), value: link, full: true },
        { name: "amount", label: "Amount (Rs.)", type: "number", min: 1, step: 50, value: p.amount, required: true },
        { name: "payment_date", label: "Date", type: "date", value: p.payment_date, required: true },
        { name: "method", label: "Method", type: "select", options: METHODS, value: p.method, full: true },
        { name: "reason", label: "Reason for the change", type: "textarea", required: true, placeholder: "e.g. Receipt shows Rs. 2,500, typed 3,000 by mistake" }
      ],
      submit: "Save changes",
      onSubmit: v => {
        const amount = U.num(v.amount, "Amount", { min: 1 });
        S.tx(() => S.update("Payment", p.payment_id, Object.assign({ amount, payment_date: v.payment_date, method: v.method }, linkToCols(v.link)), v.reason));
        toast("Payment updated. Change saved to the audit log."); refresh();
      }
    });
  }
  function voidPayment(id) {
    const p = S.get("Payment", id);
    U.confirm({
      title: `Void payment #${p.payment_id}?`, sub: `${rs(p.amount)} from ${esc(memberName(p.member_id))} on ${fdate(p.payment_date)}. Voided payments stay on record (crossed out) and stop counting towards what's paid. Nothing is deleted.`,
      submit: "Void payment", danger: true, reasonLabel: "Why is it being voided?",
      onConfirm: reason => { S.tx(() => S.update("Payment", p.payment_id, { status: "void", void_reason: reason, voided_by: S.session.user.user_id }, reason)); toast("Payment voided and logged."); refresh(); }
    });
  }
  function paymentActions(p) {
    if (p.status === "void") return `<span class="tag" title="${esc(p.void_reason)}">Void</span>`;
    return (S.can("payment.edit") ? `<button class="btn btn-ghost btn-xs" data-act="pay-edit" data-id="${p.payment_id}">Edit</button>` : "") +
      (S.can("payment.void") ? `<button class="btn btn-ghost btn-xs" data-act="pay-void" data-id="${p.payment_id}">Void</button>` : "");
  }

  function checkIn(mid) {
    if (S.insideNow().some(c => c.member_id === +mid)) { toast("Already checked in.", true); return; }
    S.tx(() => S.insert("CheckIn", { member_id: +mid, check_in_time: S.stamp(S.now()), check_out_time: null }));
    const st = S.memberStatus(mid), owed = S.memberOwed(mid);
    const warn = st.key === "expired" || st.key === "none" ? ` · ⚠ ${st.label.toLowerCase()} membership` : owed && S.can("dues.view") ? ` · owes ${rs(owed)}` : "";
    toast(`${memberName(mid)} checked in${warn}`, !!warn && st.key !== "active");
    refresh();
  }
  function checkOut(mid) {
    const c = S.insideNow().find(x => x.member_id === +mid);
    if (!c) return;
    S.tx(() => S.update("CheckIn", c.checkin_id, { check_out_time: S.stamp(S.now()) }));
    toast(`${memberName(mid)} checked out`); refresh();
  }

  const ATT = { date: S.TODAY, tab: null, marks: {} };
  function attTabs() {
    const occs = S.occurrencesOn(ATT.date).filter(o => S.session.role !== "trainer" || S.get("ClassSchedule", o.class_id).trainer_id === S.myTrainerId());
    const tabs = occs.map(o => { const c = S.get("ClassSchedule", o.class_id); return { key: "o" + o.occurrence_id, label: `${c.class_name} · ${ftime(o.start_time)}`, occ: o }; });
    const sess = S.sessionsOn(ATT.date).filter(s => visibleEnrollment(s.pt_enrollment_id));
    if (sess.length) tabs.push({ key: "pt", label: "PT sessions", n: sess.length });
    return tabs;
  }
  function attRows(tab) {
    if (tab.key === "pt") return S.sessionsOn(ATT.date).filter(s => visibleEnrollment(s.pt_enrollment_id)).map(s => {
      const e = S.get("PersonalTrainingEnrollment", s.pt_enrollment_id);
      return { id: s.session_id, member_id: e.member_id, sub: `${ftime(s.time_slot)} · with ${trainerName(S.sessionTrainer(s))}`, current: s.status === "Completed" ? "good" : s.status === "No-show" ? "bad" : null };
    });
    const marked = S.attendanceOf(tab.occ.occurrence_id);
    const ids = [...new Set([...marked.map(a => a.member_id), ...S.regularsOf(tab.occ.class_id)])];
    return ids.map(mid => { const a = marked.find(x => x.member_id === mid); return { id: mid, member_id: mid, sub: a ? `Saved: ${a.status}` : "Regular in this class", current: a ? (a.status === "Attended" ? "good" : "bad") : null }; })
      .sort((x, y) => memberName(x.member_id).localeCompare(memberName(y.member_id)));
  }
  function attendanceCard({ compact } = {}) {
    return `<section class="card fade" id="attCard" aria-labelledby="attH"></section>`;
  }
  function renderAtt() {
    const card = document.getElementById("attCard"); if (!card) return;
    const tabs = attTabs();
    if (!tabs.find(t => t.key === ATT.tab)) ATT.tab = tabs[0] ? tabs[0].key : null;
    const tab = tabs.find(t => t.key === ATT.tab);
    const marks = ATT.marks[ATT.date + ATT.tab] = ATT.marks[ATT.date + ATT.tab] || {};
    const rows = tab ? attRows(tab) : [];
    rows.forEach(r => { if (!(r.id in marks)) marks[r.id] = r.current; });
    const marked = rows.filter(r => marks[r.id]).length, present = rows.filter(r => marks[r.id] === "good").length;
    const isPT = tab && tab.key === "pt";
    const notInRoster = tab && !isPT ? memberOptions(m => !rows.some(r => r.member_id === m.member_id)) : [];
    card.innerHTML = `<div class="card-head"><div><h2 id="attH">Attendance · ${esc(dayLabel(ATT.date))}</h2><div class="sub">Tap once per person, then save everything in one go. Anyone marked present is checked in automatically.</div></div>
        <div class="field" style="min-width:170px"><label class="sr" for="attDate">Date</label><input type="date" id="attDate" value="${ATT.date}" max="${S.TODAY}"></div></div>
      ${tabs.length ? `<div style="padding:0 22px 14px"><div class="tabs" role="tablist">${tabs.map(t => `<button role="tab" aria-selected="${t.key === ATT.tab}" data-act="att-tab" data-k="${t.key}">${esc(t.label)}${t.n ? ` <span class="n">${t.n}</span>` : ""}</button>`).join("")}</div></div>` : ""}
      <div class="progress-mini"><i style="width:${rows.length ? marked / rows.length * 100 : 0}%"></i></div>
      ${!tab ? `<div class="empty"><b>Nothing scheduled</b>No classes or PT sessions on this day.</div>` : rows.map(r => {
        const v = marks[r.id], owed = S.can("dues.view") ? S.memberOwed(r.member_id) : 0, st = S.memberStatus(r.member_id);
        return `<div class="row ${v === "good" ? "present" : v === "bad" ? "absent" : ""}"><div class="pic">${esc(initials(memberName(r.member_id)))}</div>
          <div class="who"><b>${esc(memberName(r.member_id))}</b><span>${esc(r.sub)}${st.key === "expired" ? ' · <span class="down">membership expired</span>' : ""}${owed ? ` · <span class="down">owes ${rs(owed)}</span>` : ""}</span></div>
          <div class="toggle" role="group" aria-label="Attendance for ${esc(memberName(r.member_id))}">
            <button data-act="att-mark" data-id="${r.id}" data-v="good" class="${v === "good" ? "on-good" : ""}" aria-pressed="${v === "good"}">✓ ${isPT ? "Completed" : "Present"}</button>
            <button data-act="att-mark" data-id="${r.id}" data-v="bad" class="${v === "bad" ? "on-bad" : ""}" aria-pressed="${v === "bad"}">✕ ${isPT ? "No-show" : "Absent"}</button>
          </div></div>`;
      }).join("")}
      ${tab ? `<div class="foot">
        <div class="count"><b>${marked}</b> of ${rows.length} marked · <b>${present}</b> ${isPT ? "completed" : "present"}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${!isPT && notInRoster.length ? `<div class="sel" style="min-width:200px"><select id="walkin" class="sel-native" style="min-height:38px;border-radius:10px;border:2px solid var(--line);padding:0 46px 0 12px;background:var(--field);color:var(--fg);width:100%"><option value="">+ Add walk-in…</option>${notInRoster.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>` : ""}
          <button class="btn btn-line btn-sm" data-act="att-all">Mark all ${isPT ? "completed" : "present"}</button>
          <button class="btn btn-ink btn-sm" data-act="att-save">Save attendance</button></div></div>` : ""}`;
    const d = document.getElementById("attDate");
    d.onchange = () => { ATT.date = d.value || S.TODAY; ATT.tab = null; renderAtt(); };
    const w = document.getElementById("walkin");
    if (w) w.onchange = () => { if (!w.value) return; const t = attTabs().find(x => x.key === ATT.tab); S.tx(() => S.insert("ClassAttendance", { occurrence_id: t.occ.occurrence_id, member_id: +w.value, status: "Attended" })); marks[+w.value] = "good"; toast(`${memberName(+w.value)} added to the class`); renderAtt(); };
  }
  function saveAttendance() {
    const tab = attTabs().find(t => t.key === ATT.tab); if (!tab) return;
    const marks = ATT.marks[ATT.date + ATT.tab];
    const entries = Object.entries(marks).filter(([, v]) => v);
    if (!entries.length) { toast("Mark at least one person first.", true); return; }
    S.tx(() => entries.forEach(([id, v]) => {
      if (tab.key === "pt") S.update("Session", +id, { status: v === "good" ? "Completed" : "No-show" });
      else {
        const ex = S.attendanceOf(tab.occ.occurrence_id).find(a => a.member_id === +id);
        const status = v === "good" ? "Attended" : "No-show";
        ex ? S.update("ClassAttendance", ex.attendance_id, { status }) : S.insert("ClassAttendance", { occurrence_id: tab.occ.occurrence_id, member_id: +id, status });
      }
    }));
    toast(`Saved ${entries.length} attendance record${entries.length === 1 ? "" : "s"} in one go · present members are checked in`);
    delete ATT.marks[ATT.date + ATT.tab];
    refresh();
  }

  function journalEvents(mid) {
    const ev = [];
    const recs = S.progressOf(mid);
    const withW = recs.filter(r => r.weight != null).sort((a, b) => a.record_date.localeCompare(b.record_date));
    recs.forEach(r => {
      const prev = withW.filter(x => x.record_date < r.record_date).pop();
      ev.push({ kind: r.source === "trainer" ? "trainer" : "member", date: r.record_date, rec: r, delta: r.weight != null && prev ? +(r.weight - prev.weight).toFixed(1) : null });
    });
    S.enrollmentsOf(mid).forEach(e => {
      ev.push({ kind: "mile", date: e.start_date, title: `Started personal training with ${trainerName(e.trainer_id)}`, text: `Goal: ${e.goal}` });
      S.versionsOf(e.pt_enrollment_id).forEach(v => ev.push({ kind: "plan", date: v.created_date, v, e }));
    });
    S.where("TrainerChange", c => c.member_id === +mid && c.status === "Approved").forEach(c =>
      ev.push({ kind: "mile", date: c.decided_at.slice(0, 10), title: `Switched trainer: ${trainerName(c.from_trainer_id)} → ${trainerName(c.to_trainer_id)}`, text: "Earlier sessions and logs stay with the coach who ran them." }));
    S.membershipsOf(mid).forEach((ms, i, arr) => ev.push({ kind: "mile", date: ms.start_date, title: `${i === arr.length - 1 ? "Joined" : "Renewed"}: ${S.planOf(ms).plan_type}`, text: `${fdate(ms.start_date)} – ${fdate(ms.end_date)}` }));
    const order = { trainer: 0, member: 1, plan: 2, mile: 3 };
    return ev.sort((a, b) => b.date.localeCompare(a.date) || order[a.kind] - order[b.kind]);
  }
  const canEditRecord = r => S.session.role === "owner" || (r.source === "member" && S.session.role === "member" && r.member_id === S.myMemberId()) || (r.source === "trainer" && S.session.role === "trainer" && r.trainer_id === S.myTrainerId());
  function journalHtml(mid, filter = "all", { showMember, limit } = {}) {
    let ev = journalEvents(mid).filter(e => filter === "all" || e.kind === filter);
    if (limit) ev = ev.slice(0, limit);
    if (!ev.length) return `<div class="empty"><b>No entries yet</b>Progress logs and journal entries will show up here.</div>`;
    return `<div class="journal">${ev.map(e => {
      if (e.kind === "trainer" || e.kind === "member") {
        const r = e.rec, v = r.plan_version_id ? S.get("TrainingPlan", r.plan_version_id) : null;
        const title = e.kind === "trainer" ? `Trainer log · ${trainerName(r.trainer_id)}` : `Journal · ${showMember ? memberName(r.member_id) : "by member"}`;
        return `<div class="j-item j-${e.kind}"><div class="j-ico">${ico(e.kind === "trainer" ? "clip" : "pen")}</div><div class="j-body">
          <div class="j-top"><b>${esc(showMember && e.kind === "trainer" ? memberName(r.member_id) + " · " + title : title)}</b><time>${fdate(r.record_date)}</time></div>
          ${r.weight != null || r.strength_metric || v ? `<div class="j-stats">${r.weight != null ? `<span class="j-stat"><em>Weight</em>${r.weight} kg${e.delta ? `<span class="muted" style="margin-left:6px">${e.delta > 0 ? "▲" : "▼"} ${Math.abs(e.delta)}</span>` : ""}</span>` : ""}${r.strength_metric ? `<span class="j-stat"><em>Strength</em>${esc(r.strength_metric)}</span>` : ""}${v ? `<span class="j-stat"><em>Plan</em>v${v.version_number}</span>` : ""}</div>` : ""}
          ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
          ${canEditRecord(r) ? `<div style="margin-top:8px"><button class="link-btn" style="font-size:13px" data-act="prog-edit" data-id="${r.record_id}">Edit entry</button></div>` : ""}
        </div></div>`;
      }
      if (e.kind === "plan") return `<div class="j-item j-plan"><div class="j-ico">${ico("flag")}</div><div class="j-body"><div class="j-top"><b>${showMember ? esc(memberName(e.e.member_id)) + " · " : ""}Training plan v${e.v.version_number}${e.v.is_current ? ' <span class="tag k" style="margin-left:6px">Current</span>' : ""}</b><time>${fdate(e.v.created_date)}</time></div><div class="plan-text">${esc(e.v.details)}</div><p style="font-size:13px;margin-top:6px" class="muted">Written by ${esc(trainerName(e.e.trainer_id))}</p></div></div>`;
      return `<div class="j-item j-mile"><div class="j-ico">${ico("star")}</div><div class="j-body"><div class="j-top"><b>${esc(e.title)}</b><time>${fdate(e.date)}</time></div><p class="muted">${esc(e.text)}</p></div></div>`;
    }).join("")}</div>`;
  }
  function progressChart(mid) {
    const pts = S.progressOf(mid).filter(r => r.weight != null).sort((a, b) => a.record_date.localeCompare(b.record_date)).map(r => ({ date: r.record_date, value: r.weight, kind: r.source }));
    const markers = S.enrollmentsOf(mid).flatMap(e => S.versionsOf(e.pt_enrollment_id).map(v => ({ date: v.created_date, label: "v" + v.version_number })));
    return U.lineChart(pts, { markers, unit: " kg" });
  }
  function logProgress({ memberId, record } = {}) {
    const editing = !!record;
    const asMember = S.session.role === "member";
    const opts = asMember ? [] : memberOptions(m => S.session.role !== "trainer" || S.clientIdsOf(S.myTrainerId()).includes(m.member_id));
    const mid = editing ? record.member_id : memberId || (asMember ? S.myMemberId() : opts[0] && opts[0][0]);
    U.form({
      title: editing ? "Edit entry" : asMember ? "Add journal entry" : "Log progress",
      sub: asMember ? "Your coach sees your journal. Add your weight if you weighed in." : "Saved to the member's history and linked to their current training plan version.",
      fields: [
        ...(asMember || editing ? [] : [{ name: "member_id", label: "Member", type: "select", options: opts, value: mid, required: true, full: true }]),
        { name: "record_date", label: "Date", type: "date", value: editing ? record.record_date : S.TODAY, max: S.TODAY, required: true },
        { name: "weight", label: "Weight (kg)", type: "number", min: 20, max: 300, step: .1, value: editing ? record.weight ?? "" : "" },
        ...(asMember ? [] : [{ name: "strength_metric", label: "Strength metric", maxlength: 100, full: true, placeholder: "e.g. Squat 80 kg × 5", value: editing ? record.strength_metric || "" : "" }]),
        { name: "notes", label: asMember ? "How did it go?" : "Notes", type: "textarea", required: asMember, value: editing ? record.notes || "" : "", placeholder: asMember ? "Energy, sleep, food, how training felt…" : "Form, effort, what to change next time" }
      ],
      submit: editing ? "Save" : "Add entry",
      onSubmit: v => {
        const member_id = editing ? record.member_id : asMember ? S.myMemberId() : +v.member_id;
        if (v.record_date > S.TODAY) throw new Error("The date can't be in the future.");
        const weight = U.num(v.weight, "Weight", { min: 20, allowEmpty: true });
        if (!editing && weight == null && !v.notes && !v.strength_metric) throw new Error("Add at least a weight, a strength number or a note.");
        const pt = S.activePT(member_id), ver = pt ? S.currentVersion(pt.pt_enrollment_id) : null;
        S.tx(() => {
          if (editing) S.update("ProgressRecord", record.record_id, { record_date: v.record_date, weight, strength_metric: asMember ? record.strength_metric : v.strength_metric || null, notes: v.notes || null });
          else S.insert("ProgressRecord", { member_id, entered_by: S.session.user.user_id, trainer_id: asMember ? null : (S.myTrainerId() || (pt ? pt.trainer_id : null)), source: asMember ? "member" : "trainer", plan_version_id: ver ? ver.plan_version_id : null, record_date: v.record_date, weight, strength_metric: asMember ? null : v.strength_metric || null, notes: v.notes || null });
        });
        toast(editing ? "Entry updated" : "Saved to the progress history"); refresh();
      }
    });
  }
  function newVersion(eid) {
    const e = S.get("PersonalTrainingEnrollment", eid), cur = S.currentVersion(eid);
    U.form({
      title: `New training plan version for ${memberName(e.member_id)}`, sub: `Current: v${cur ? cur.version_number : 0}. The new version becomes current; older versions stay in the history.`,
      fields: [{ name: "details", label: `Plan v${(cur ? cur.version_number : 0) + 1}`, type: "textarea", required: true, value: "", placeholder: "Split, sets/reps, cardio, nutrition targets…" }],
      submit: "Publish version",
      onSubmit: v => {
        S.tx(() => {
          S.versionsOf(eid).forEach(x => x.is_current && S.update("TrainingPlan", x.plan_version_id, { is_current: false }));
          S.insert("TrainingPlan", { pt_enrollment_id: +eid, version_number: (cur ? cur.version_number : 0) + 1, is_current: true, created_date: S.TODAY, details: v.details });
        });
        toast("New plan version published"); refresh();
      }
    });
  }
  function applyTrainerChange(eid, toTid, { note } = {}) {
    const e = S.get("PersonalTrainingEnrollment", eid), from = e.trainer_id, to = +toTid;
    if (to === from) throw new Error("That's already their trainer.");
    const who = S.session.user.user_id, at = S.stamp(S.now()), pending = S.pendingChange(eid);
    let moved = 0;
    S.tx(() => {
      S.update("PersonalTrainingEnrollment", e.pt_enrollment_id, { trainer_id: to }, note || "Trainer changed");
      S.where("Session", s => s.pt_enrollment_id === e.pt_enrollment_id && s.session_date >= S.TODAY && (s.status === "Scheduled" || s.status === "Requested"))
        .forEach(s => { S.update("Session", s.session_id, { trainer_id: to }); moved++; });
      if (pending) S.update("TrainerChange", pending.change_id, { status: "Approved", to_trainer_id: to, decided_by: who, decided_at: at, staff_note: note || null });
      else S.insert("TrainerChange", { pt_enrollment_id: e.pt_enrollment_id, member_id: e.member_id, from_trainer_id: from, to_trainer_id: to, reason_type: "Changed by staff", reason: null,
        status: "Approved", requested_by: who, requested_at: at, decided_by: who, decided_at: at, staff_note: note || null });
      S.notify(S.userOfMember(e.member_id), `Your trainer is now ${trainerName(to)}`, `${moved} upcoming session${moved === 1 ? "" : "s"} moved to ${trainerName(to)}.${note ? ` "${note}"` : ""}`, "#/me/sessions");
      S.notify(S.userOfTrainer(to), "New PT client", `${memberName(e.member_id)} now trains with you (${moved} upcoming session${moved === 1 ? "" : "s"}).`, "#/clients");
    });
    return moved;
  }
  const trainerLoadOptions = exclude => S.all("Trainer").filter(t => t.trainer_id !== exclude)
    .map(t => [t.trainer_id, `${t.name} · ${t.specialization} · ${S.clientIdsOf(t.trainer_id).length} clients`]);

  const canWritePlan = e => S.can("plan.manage") && (S.session.role !== "trainer" || e.trainer_id === S.myTrainerId());

  const ACT = {
    menu: () => document.getElementById("app").classList.toggle("nav-open"),
    "add-member": () => addMemberFlow(),
    "add-plan": el => addMemberFlow({ member: S.get("Member", el.dataset.id) }),
    "add-pt": el => addMemberFlow({ member: S.get("Member", el.dataset.id), ptOnly: true }),
    "pay-new": el => recordPayment(el.dataset.id ? +el.dataset.id : null),
    "pay-edit": el => editPayment(+el.dataset.id),
    "pay-void": el => voidPayment(+el.dataset.id),
    "check-in": el => checkIn(+el.dataset.id),
    "check-out": el => checkOut(+el.dataset.id),
    "att-tab": el => { ATT.tab = el.dataset.k; renderAtt(); },
    "att-mark": el => { const m = ATT.marks[ATT.date + ATT.tab]; const id = isNaN(+el.dataset.id) ? el.dataset.id : +el.dataset.id; m[id] = m[id] === el.dataset.v ? null : el.dataset.v; renderAtt(); },
    "att-all": () => { const t = attTabs().find(x => x.key === ATT.tab); const m = ATT.marks[ATT.date + ATT.tab]; attRows(t).forEach(r => m[r.id] = "good"); renderAtt(); },
    "att-save": saveAttendance,
    "prog-new": el => logProgress({ memberId: el.dataset.id ? +el.dataset.id : null }),
    "prog-edit": el => logProgress({ record: S.get("ProgressRecord", el.dataset.id) }),
    "plan-new": el => newVersion(+el.dataset.id),
    "toast": el => toast(el.dataset.msg),
    "print": () => window.print(),
    "reset-demo": () => U.confirm({ title: "Reset the demo data?", sub: "Everything you added or changed in this prototype is replaced with fresh sample data.", submit: "Reset", danger: true, onConfirm: () => { S.reset(); S.login(S.session.role); location.hash = "#/"; refresh(); toast("Demo data reset"); } })
  };
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (el && ACT[el.dataset.act]) { e.preventDefault(); ACT[el.dataset.act](el, e); return; }
    const tr = e.target.closest("tr[data-href]");
    if (tr && !e.target.closest("button, a, select, input")) location.hash = tr.dataset.href;
    const app = document.getElementById("app");
    if (app.classList.contains("nav-open") && !e.target.closest("#side") && !e.target.closest("[data-act=menu]")) app.classList.remove("nav-open");
  });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("tr[data-href]")) location.hash = e.target.dataset.href; });

  window.App = {
    route, render, refresh, header, wireSearch, kpi, ACT, NAV,
    memberName, trainerName, userName, statusTag, SESSION_TAG, ATT_TAG, paymentFor, memberOptions, trainerOptions, METHODS, SLOTS, visibleEnrollment,
    addMemberFlow, recordPayment, paymentActions, checkIn, checkOut, attendanceCard, renderAtt, ATT,
    journalHtml, journalEvents, progressChart, logProgress, newVersion, canWritePlan, applyTrainerChange, trainerLoadOptions
  };
})();
