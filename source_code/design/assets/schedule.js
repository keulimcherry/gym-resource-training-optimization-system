(function () {
  "use strict";
  const S = window.Store, U = window.UI, A = window.App;
  const { esc, fdate, fshort, ftime, ico, plural } = U;
  const { memberName, trainerName } = A;
  const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const SLOT_VALUES = A.SLOTS.map(s => s[0]);
  const enr = id => S.get("PersonalTrainingEnrollment", id);
  const daysLabel = csv => csv.split(",").sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)).join(", ");
  const when = (d, t) => `${S.dowOf(d).slice(0, 3)} ${fshort(d)}, ${ftime(t)}`;
  const me = () => S.session.user;
  const slotOptions = extra => (extra && !SLOT_VALUES.includes(extra) ? [[extra, ftime(extra)], ...A.SLOTS] : A.SLOTS);
  const enrollmentOptions = () => S.all("PersonalTrainingEnrollment").filter(e => A.visibleEnrollment(e.pt_enrollment_id) && (!e.end_date || e.end_date >= S.TODAY))
    .map(e => [e.pt_enrollment_id, `${memberName(e.member_id)} · ${trainerName(e.trainer_id)}`]);
  const tellMember = (eid, title, body) => S.notify(S.userOfMember(enr(eid).member_id), title, body, "#/me/sessions");
  const tellTrainer = (tid, title, body) => { if (S.myTrainerId() !== +tid) S.notify(S.userOfTrainer(tid), title, body, "#/pt?tab=requests"); };

  function clashBox(clashes, tid, free, field) {
    return `<div class="clash" role="alert"><b>${ico("x")} ${esc(trainerName(tid))} already has something then</b>
      <ul>${clashes.map(c => `<li>${ftime(c.time)} · ${esc(c.what)}</li>`).join("")}</ul>
      ${free && free.length ? `<div class="lbl">Free that day: tap to use</div>${chips(free, field)}` : free ? `<div class="lbl">No free times that day. Try another date.</div>` : ""}</div>`;
  }
  const okBox = text => `<div class="okbox">${ico("check")} ${text}</div>`;
  const chips = (slots, field) => `<div class="slot-chips">${slots.map(t => `<button type="button" class="chip-f" data-pick="${t}" data-for="${field}">${ftime(t)}</button>`).join("")}</div>`;
  function wirePicks(dlg, update) {
    dlg.addEventListener("click", e => {
      const b = e.target.closest("[data-pick]"); if (!b) return;
      const f = dlg.querySelector(`[name="${b.dataset.for}"]`);
      if (![...f.options].some(o => o.value === b.dataset.pick)) f.insertAdjacentHTML("beforeend", `<option value="${b.dataset.pick}">${ftime(b.dataset.pick)}</option>`);
      f.value = b.dataset.pick; update();
    });
  }
  const daysField = (csv = "") => ({ name: "_days", type: "html", html: `<span class="lbl">Days of the week</span><div class="days" role="group" aria-label="Days of the week">${DAY_ORDER.map(d =>
    `<label class="day-chip"><input type="checkbox" name="day_${d}"${csv.split(",").includes(d) ? " checked" : ""}><span>${d}</span></label>`).join("")}</div>` });
  const pickedDays = dlg => DAY_ORDER.filter(d => dlg.querySelector(`[name="day_${d}"]`).checked).join(",");

  function sessionForm({ session, enrollmentId } = {}) {
    const editing = !!session;
    const opts = enrollmentOptions();
    if (!editing && !opts.length) { U.toast("No active PT enrollments to schedule.", true); return; }
    const s = session;
    const dlg = U.form({
      title: editing ? `Session · ${memberName(enr(s.pt_enrollment_id).member_id)}` : "Book one PT session",
      sub: editing ? `${s.series_id ? "Part of a recurring schedule. Changing it moves only this one session." : "One-off session."} The member is notified of any change.` : "For a regular weekly slot use Recurring schedule instead.",
      fields: [
        ...(editing ? [] : [{ name: "pt_enrollment_id", label: "Client", type: "select", options: opts, value: enrollmentId || opts[0][0], full: true }]),
        { name: "session_date", label: "Date", type: "date", value: editing ? s.session_date : S.addDays(S.TODAY, 1), min: editing ? "" : S.TODAY, required: true },
        { name: "time_slot", label: "Time", type: "select", options: slotOptions(editing ? s.time_slot : null), value: editing ? s.time_slot : "07:00" },
        ...(editing ? [{ name: "status", label: "Status", type: "select", options: ["Scheduled", "Completed", "No-show", "Cancelled"].map(x => [x, x]), value: s.status === "Requested" ? "Scheduled" : s.status, full: true },
          { name: "note", label: "Note to the member", type: "textarea", placeholder: "e.g. Sorry, I have a workshop that morning. See you at 8 instead." }] : []),
        { name: "_check", type: "html", html: `<div data-check></div>` }],
      submit: editing ? "Save" : "Book session",
      onSubmit: v => {
        const r = check(); if (r.clashes.length) throw new Error(`${trainerName(r.tid)} is busy at ${ftime(v.time_slot)} that day. Pick one of the free times shown.`);
        const actor = me().display_name;
        if (!editing) {
          const e = enr(v.pt_enrollment_id), ver = S.currentVersion(e.pt_enrollment_id);
          S.tx(() => {
            S.insert("Session", { pt_enrollment_id: e.pt_enrollment_id, trainer_id: e.trainer_id, series_id: null, is_exception: false, plan_version_id: ver.plan_version_id, session_date: v.session_date, time_slot: v.time_slot, status: "Scheduled" });
            tellMember(e.pt_enrollment_id, "New PT session booked", `${when(v.session_date, v.time_slot)} with ${trainerName(e.trainer_id)}.`);
            tellTrainer(e.trainer_id, "Session booked for you", `${memberName(e.member_id)} · ${when(v.session_date, v.time_slot)} (booked by ${actor}).`);
          });
          U.toast("Session booked. The member has been notified."); A.refresh(); return;
        }
        const moved = v.session_date !== s.session_date || v.time_slot !== s.time_slot;
        S.tx(() => {
          S.update("Session", s.session_id, { session_date: v.session_date, time_slot: v.time_slot, status: v.status, is_exception: !!s.series_id && (s.is_exception || moved) });
          const tail = v.note ? ` Note from ${actor}: "${v.note}"` : "";
          if (moved) tellMember(s.pt_enrollment_id, `${actor} moved your session`, `${when(s.session_date, s.time_slot)} → ${when(v.session_date, v.time_slot)}.${tail}`);
          else if (v.status === "Cancelled" && s.status !== "Cancelled") tellMember(s.pt_enrollment_id, "Session cancelled", `${when(s.session_date, s.time_slot)} was cancelled by ${actor}.${tail}`);
          else if (s.status === "Requested" && v.status === "Scheduled") tellMember(s.pt_enrollment_id, "Session confirmed", `${when(v.session_date, v.time_slot)} is confirmed.${tail}`);
          else if (v.note) tellMember(s.pt_enrollment_id, "A note about your session", `${when(s.session_date, s.time_slot)}.${tail}`);
          S.where("SessionChangeRequest", r => r.session_id === s.session_id && r.status === "Pending").forEach(r => S.update("SessionChangeRequest", r.request_id, { status: "Answered", decided_by: me().user_id, decided_at: S.stamp(S.now()) }));
        });
        U.toast(moved ? "Session moved. The member has been notified." : "Session updated"); A.refresh();
      }
    });
    const $ = n => dlg.querySelector(`[name="${n}"]`), box = dlg.querySelector("[data-check]");
    function check() {
      const tid = editing ? S.sessionTrainer(s) : enr($("pt_enrollment_id").value).trainer_id;
      const status = editing ? $("status").value : "Scheduled";
      const date = $("session_date").value, time = $("time_slot").value;
      if (!date || !["Scheduled", "Requested"].includes(status)) return { tid, clashes: [] };
      const ignore = x => editing && x.session_id === s.session_id;
      return { tid, date, clashes: S.trainerClashes(tid, date, time, ignore), free: S.freeSlots(tid, date, SLOT_VALUES, ignore) };
    }
    function update() {
      const r = check();
      box.innerHTML = !r.date ? "" : r.clashes.length ? clashBox(r.clashes, r.tid, r.free, "time_slot") : okBox(`${esc(trainerName(r.tid))} is free at ${ftime($("time_slot").value)} on ${fdate(r.date)}.`);
    }
    dlg.addEventListener("change", update); dlg.addEventListener("input", update); wirePicks(dlg, update); update();
  }

  function seriesForm({ enrollmentId, series } = {}) {
    const editing = !!series;
    const opts = enrollmentOptions();
    if (!editing && !opts.length) { U.toast("No active PT enrollments to schedule.", true); return; }
    const tomorrow = S.addDays(S.TODAY, 1);
    const dlg = U.form({
      title: editing ? `Change schedule · ${memberName(enr(series.pt_enrollment_id).member_id)}` : "New recurring schedule",
      sub: editing ? "Sessions from the chosen date onward are rebuilt with the new days and time. Sessions you moved one at a time stay as they are. The member is notified."
        : "Pick the days and time the member and trainer agreed on. Every session between the start and end date is created automatically.",
      size: "wide",
      fields: [
        ...(editing ? [] : [{ name: "pt_enrollment_id", label: "Client", type: "select", options: opts, value: enrollmentId || opts[0][0], full: true }]),
        daysField(editing ? series.days_of_week : "Mon,Wed,Fri"),
        { name: "time_slot", label: "Time", type: "select", options: slotOptions(editing ? series.time_slot : null), value: editing ? series.time_slot : "07:00" },
        { name: "start_date", label: editing ? "Apply changes from" : "Starts on", type: "date", value: editing ? (series.start_date > tomorrow ? series.start_date : tomorrow) : tomorrow, min: tomorrow, required: true },
        { name: "end_date", label: "Ends on", type: "date", value: editing ? series.end_date : S.addDays(tomorrow, 55), required: true, hint: "Up to 6 months. You can extend it later." },
        ...(editing ? [{ name: "note", label: "Note to the member", type: "textarea", placeholder: "e.g. Moving us to evenings from next week." }] : []),
        { name: "_check", type: "html", html: `<div data-check></div>` }],
      submit: editing ? "Save schedule" : "Create schedule",
      onSubmit: v => {
        const r = plan();
        if (r.error) throw new Error(r.error);
        const actor = me().display_name;
        let made = 0;
        S.tx(() => {
          let ser = series;
          if (editing) {
            r.toReplace.forEach(x => S.remove("Session", x.session_id));
            S.update("SessionSeries", series.series_id, { days_of_week: r.days, time_slot: r.time, end_date: r.end, status: "Active" });
          } else {
            ser = S.insert("SessionSeries", { pt_enrollment_id: r.e.pt_enrollment_id, trainer_id: r.e.trainer_id, days_of_week: r.days, time_slot: r.time, start_date: r.start, end_date: r.end, status: "Active", created_by: me().user_id, created_at: S.stamp(S.now()) });
          }
          const ver = S.currentVersion(r.e.pt_enrollment_id);
          r.ok.forEach(d => { S.insert("Session", { pt_enrollment_id: r.e.pt_enrollment_id, trainer_id: r.e.trainer_id, series_id: ser.series_id, is_exception: false, plan_version_id: ver.plan_version_id, session_date: d, time_slot: r.time, status: "Scheduled" }); made++; });
          const skipped = r.clashDates.length ? ` ${plural(r.clashDates.length, "date")} skipped because of clashes: ${r.clashDates.map(c => fshort(c.date)).join(", ")}.` : "";
          if (editing) tellMember(r.e.pt_enrollment_id, `${actor} changed your training schedule`, `From ${fdate(r.start)}: ${daysLabel(r.days)} at ${ftime(r.time)} until ${fdate(r.end)}.${skipped}${v.note ? ` Note: "${v.note}"` : ""}`);
          else tellMember(r.e.pt_enrollment_id, "Your training schedule is set", `${daysLabel(r.days)} at ${ftime(r.time)} with ${trainerName(r.e.trainer_id)}, ${fdate(r.start)} – ${fdate(r.end)} (${plural(made, "session")}).${skipped}`);
          tellTrainer(r.e.trainer_id, editing ? "A client's schedule changed" : "New recurring client", `${memberName(r.e.member_id)} · ${daysLabel(r.days)} at ${ftime(r.time)} until ${fdate(r.end)} (by ${actor}).`);
        });
        U.toast(`${editing ? "Schedule updated" : "Schedule created"}: ${plural(made, "session")}${r.clashDates.length ? `, ${r.clashDates.length} clashing date${r.clashDates.length === 1 ? "" : "s"} skipped` : ""}. The member has been notified.`);
        A.refresh();
      }
    });
    const $ = n => dlg.querySelector(`[name="${n}"]`), box = dlg.querySelector("[data-check]"), btn = dlg.querySelector("button[type=submit]");
    function plan() {
      const e = editing ? enr(series.pt_enrollment_id) : enr($("pt_enrollment_id").value);
      const days = pickedDays(dlg), time = $("time_slot").value, start = $("start_date").value, end = $("end_date").value;
      if (!days) return { error: "Pick at least one day of the week.", e };
      if (!start || !end) return { error: "Pick a start and end date.", e };
      if (start <= S.TODAY) return { error: "Start from tomorrow or later. Change today's session on its own instead.", e };
      if (end < start) return { error: "The end date is before the start date.", e };
      if (S.daysBetween(start, end) > 183) return { error: "Keep a schedule to 6 months or less. You can extend it later.", e };
      const toReplace = editing ? S.where("Session", x => x.series_id === series.series_id && x.session_date >= start && x.status === "Scheduled" && !x.is_exception) : [];
      const replaceIds = new Set(toReplace.map(x => x.session_id));
      const kept = editing ? new Set(S.where("Session", x => x.series_id === series.series_id && x.is_exception).map(x => x.session_date)) : new Set();
      const ignore = x => replaceIds.has(x.session_id);
      const dates = S.seriesDates(days, start, end).filter(d => !kept.has(d));
      const clashDates = [], ok = [];
      dates.forEach(d => { const c = S.trainerClashes(e.trainer_id, d, time, ignore); c.length ? clashDates.push({ date: d, c }) : ok.push(d); });
      const freeAll = SLOT_VALUES.filter(t => dates.every(d => !S.trainerClashes(e.trainer_id, d, t, ignore).length));
      return { e, days, time, start, end, dates, ok, clashDates, freeAll, toReplace };
    }
    function update() {
      const r = plan();
      if (r.error) { box.innerHTML = `<div class="clash"><b>${esc(r.error)}</b></div>`; btn.textContent = editing ? "Save schedule" : "Create schedule"; return; }
      const head = `${plural(r.dates.length, "session")} · ${daysLabel(r.days)} at ${ftime(r.time)} · ${fdate(r.start)} – ${fdate(r.end)}`;
      box.innerHTML = r.clashDates.length
        ? `<div class="clash" role="alert"><b>${ico("x")} ${plural(r.clashDates.length, "date")} clash with ${esc(trainerName(r.e.trainer_id))}'s other bookings</b>
            <ul>${r.clashDates.slice(0, 8).map(x => `<li><b>${S.dowOf(x.date).slice(0, 3)} ${fshort(x.date)}</b>: ${x.c.map(c => `${ftime(c.time)} ${esc(c.what)}`).join("; ")}</li>`).join("")}${r.clashDates.length > 8 ? `<li>…and ${r.clashDates.length - 8} more</li>` : ""}</ul>
            ${r.freeAll.length ? `<div class="lbl">Free on every one of these days: tap to switch</div>${chips(r.freeAll, "time_slot")}` : `<div class="lbl">No single time is free on all these days. Saving skips the clashing dates; you can book those separately.</div>`}</div>
          <div class="okbox">${head}</div>`
        : okBox(`${head}. No clashes.`);
      btn.textContent = r.clashDates.length ? `${editing ? "Save" : "Create"} ${plural(r.ok.length, "session")}, skip ${r.clashDates.length}` : `${editing ? "Save" : "Create"} ${plural(r.ok.length, "session")}`;
    }
    dlg.addEventListener("change", update); dlg.addEventListener("input", update); wirePicks(dlg, update); update();
  }
  function endSeries(series) {
    const e = enr(series.pt_enrollment_id);
    U.form({
      title: `End schedule · ${memberName(e.member_id)}`, sub: `${daysLabel(series.days_of_week)} at ${ftime(series.time_slot)}. Scheduled sessions after the last day are removed; completed ones stay in the history.`, size: "narrow",
      fields: [{ name: "last", label: "Last day of the schedule", type: "date", value: S.TODAY, min: S.TODAY, required: true }, { name: "note", label: "Note to the member", type: "textarea" }],
      submit: "End schedule", danger: true,
      onSubmit: v => {
        let n = 0;
        S.tx(() => {
          S.where("Session", x => x.series_id === series.series_id && x.session_date > v.last && x.status === "Scheduled").forEach(x => { S.remove("Session", x.session_id); n++; });
          S.update("SessionSeries", series.series_id, { end_date: v.last < series.start_date ? series.start_date : v.last, status: "Ended" });
          tellMember(e.pt_enrollment_id, "Your recurring schedule ends", `${daysLabel(series.days_of_week)} at ${ftime(series.time_slot)} ends after ${fdate(v.last)}.${v.note ? ` Note: "${v.note}"` : ""}`);
        });
        U.toast(`Schedule ended. ${plural(n, "upcoming session")} removed; member notified.`); A.refresh();
      }
    });
  }

  const pendingReq = sid => S.where("SessionChangeRequest", r => r.session_id === +sid && r.status === "Pending")[0] || null;
  function memberChangeRequest(s) {
    if (pendingReq(s.session_id)) { U.toast("You already asked to change this session. Your coach will reply soon.", true); return; }
    const tid = S.sessionTrainer(s);
    const dlg = U.form({
      title: "Change this session", sub: `${when(s.session_date, s.time_slot)} with ${esc(trainerName(tid))}. Your coach confirms or suggests another time.`,
      fields: [
        { name: "kind", label: "What do you need?", type: "select", options: [["move", "Move it to another day or time"], ["cancel", "Cancel this session"]], full: true },
        { name: "new_date", label: "New day", type: "date", value: s.session_date, min: S.TODAY },
        { name: "new_time", label: "New time", type: "select", options: slotOptions(s.time_slot), value: s.time_slot },
        { name: "note", label: "Message to your coach", type: "textarea", maxlength: 300, placeholder: "e.g. Exams that morning, could we do the evening?" },
        { name: "_check", type: "html", html: `<div data-check></div>` }],
      submit: "Send request",
      onSubmit: v => {
        if (v.kind === "move") {
          if (v.new_date === s.session_date && v.new_time === s.time_slot) throw new Error("That's the same day and time. Pick a new one.");
          const c = S.trainerClashes(tid, v.new_date, v.new_time, x => x.session_id === s.session_id);
          if (c.length) throw new Error(`${trainerName(tid)} is busy at ${ftime(v.new_time)} that day. Pick one of the free times shown.`);
        }
        S.tx(() => {
          S.insert("SessionChangeRequest", { session_id: s.session_id, requested_by: me().user_id, kind: v.kind, new_date: v.kind === "move" ? v.new_date : null, new_time: v.kind === "move" ? v.new_time : null,
            note: v.note || null, status: "Pending", created_at: S.stamp(S.now()), decided_by: null, decided_at: null, staff_note: null });
          S.notify(S.userOfTrainer(tid), `${memberName(enr(s.pt_enrollment_id).member_id)} asked to ${v.kind === "move" ? "move" : "cancel"} a session`,
            v.kind === "move" ? `${when(s.session_date, s.time_slot)} → ${when(v.new_date, v.new_time)}.${v.note ? ` "${v.note}"` : ""}` : `${when(s.session_date, s.time_slot)}.${v.note ? ` "${v.note}"` : ""}`, "#/pt?tab=requests");
        });
        U.toast("Request sent to your coach."); A.refresh();
      }
    });
    const $ = n => dlg.querySelector(`[name="${n}"]`), box = dlg.querySelector("[data-check]");
    function update() {
      const move = $("kind").value === "move";
      [$("new_date"), $("new_time")].forEach(f => f.closest(".field").style.display = move ? "" : "none");
      if (!move || !$("new_date").value) { box.innerHTML = ""; return; }
      const ignore = x => x.session_id === s.session_id;
      const c = S.trainerClashes(tid, $("new_date").value, $("new_time").value, ignore);
      box.innerHTML = c.length ? clashBox(c.map(x => ({ time: x.time, what: x.kind === "class" ? "teaching a class" : "another session" })), tid, S.freeSlots(tid, $("new_date").value, SLOT_VALUES, ignore), "new_time")
        : okBox(`Your coach is free at ${ftime($("new_time").value)} on ${fdate($("new_date").value)}.`);
    }
    dlg.addEventListener("change", update); dlg.addEventListener("input", update); wirePicks(dlg, update); update();
  }
  function memberNewSession() {
    const pt = S.activePT(S.myMemberId());
    if (!pt) { U.toast("Personal training isn't part of your plan yet.", true); return; }
    const tid = pt.trainer_id;
    const dlg = U.form({
      title: `Request an extra session with ${trainerName(tid)}`, sub: "Only times your coach is free can be requested. They confirm it.",
      fields: [{ name: "session_date", label: "Day", type: "date", min: S.addDays(S.TODAY, 1), value: S.addDays(S.TODAY, 1), required: true },
        { name: "time_slot", label: "Time", type: "select", options: A.SLOTS, value: "07:00" }, { name: "_check", type: "html", html: `<div data-check></div>` }],
      submit: "Send request",
      onSubmit: v => {
        if (v.session_date <= S.TODAY) throw new Error("Pick a day from tomorrow onwards.");
        if (S.trainerClashes(tid, v.session_date, v.time_slot).length) throw new Error(`${trainerName(tid)} is busy at ${ftime(v.time_slot)} that day. Pick one of the free times shown.`);
        const ver = S.currentVersion(pt.pt_enrollment_id);
        S.tx(() => {
          S.insert("Session", { pt_enrollment_id: pt.pt_enrollment_id, trainer_id: tid, series_id: null, is_exception: false, plan_version_id: ver.plan_version_id, session_date: v.session_date, time_slot: v.time_slot, status: "Requested" });
          S.notify(S.userOfTrainer(tid), `${memberName(pt.member_id)} requested a session`, when(v.session_date, v.time_slot), "#/pt?tab=requests");
        });
        U.toast("Request sent. You'll see it here once it's confirmed."); A.refresh();
      }
    });
    const $ = n => dlg.querySelector(`[name="${n}"]`), box = dlg.querySelector("[data-check]");
    const update = () => {
      const d = $("session_date").value; if (!d) { box.innerHTML = ""; return; }
      const c = S.trainerClashes(tid, d, $("time_slot").value);
      box.innerHTML = c.length ? clashBox(c.map(x => ({ time: x.time, what: x.kind === "class" ? "teaching a class" : "another session" })), tid, S.freeSlots(tid, d, SLOT_VALUES), "time_slot") : okBox(`Your coach is free at ${ftime($("time_slot").value)} on ${fdate(d)}.`);
    };
    dlg.addEventListener("change", update); dlg.addEventListener("input", update); wirePicks(dlg, update); update();
  }

  function acceptChange(r) {
    const s = S.get("Session", r.session_id), tid = S.sessionTrainer(s), actor = me().display_name;
    if (r.kind === "move" && S.trainerClashes(tid, r.new_date, r.new_time, x => x.session_id === s.session_id).length) {
      U.toast("That time has been taken since they asked. Pick another time; they'll be notified.", true);
      sessionForm({ session: Object.assign({}, s, { session_date: r.new_date, time_slot: s.time_slot }) });
      return;
    }
    S.tx(() => {
      if (r.kind === "move") S.update("Session", s.session_id, { session_date: r.new_date, time_slot: r.new_time, is_exception: !!s.series_id });
      else S.update("Session", s.session_id, { status: "Cancelled" });
      S.update("SessionChangeRequest", r.request_id, { status: "Accepted", decided_by: me().user_id, decided_at: S.stamp(S.now()) });
      tellMember(s.pt_enrollment_id, r.kind === "move" ? "Session moved ✓" : "Session cancelled ✓",
        r.kind === "move" ? `${actor} confirmed: ${when(s.session_date, s.time_slot)} → ${when(r.new_date, r.new_time)}.` : `${actor} cancelled ${when(s.session_date, s.time_slot)} as you asked.`);
    });
    U.toast("Done. The member has been notified."); A.refresh();
  }
  function declineChange(r) {
    const s = S.get("Session", r.session_id);
    U.form({ title: "Decline request", sub: "Tell the member why, or suggest something else. They see this message.", size: "narrow",
      fields: [{ name: "note", label: "Message", type: "textarea", required: true, placeholder: "e.g. I'm fully booked that evening. Could Thursday 6 PM work?" }],
      submit: "Decline", danger: true,
      onSubmit: v => {
        S.tx(() => {
          S.update("SessionChangeRequest", r.request_id, { status: "Declined", decided_by: me().user_id, decided_at: S.stamp(S.now()), staff_note: v.note });
          tellMember(s.pt_enrollment_id, "Change request declined", `${when(s.session_date, s.time_slot)} stays as it is. "${v.note}"`);
        });
        U.toast("Declined. The member sees your message."); A.refresh();
      } });
  }
  function acceptNewSession(s) {
    const tid = S.sessionTrainer(s);
    if (S.trainerClashes(tid, s.session_date, s.time_slot, x => x.session_id === s.session_id).length) {
      U.toast("That slot clashes with another booking now. Suggest another time instead.", true);
      sessionForm({ session: s }); return;
    }
    S.tx(() => { S.update("Session", s.session_id, { status: "Scheduled" }); tellMember(s.pt_enrollment_id, "Session confirmed ✓", `${when(s.session_date, s.time_slot)} with ${trainerName(tid)}.`); });
    U.toast("Confirmed. The member has been notified."); A.refresh();
  }

  function seriesTable(rows, { manage } = {}) {
    return U.table({ rows, empty: "No recurring schedules yet", cols: [
      { label: "Client", html: x => U.who(memberName(enr(x.pt_enrollment_id).member_id), esc(trainerName(x.trainer_id))) },
      { label: "Days", html: x => `<b>${esc(daysLabel(x.days_of_week))}</b>` },
      { label: "Time", html: x => ftime(x.time_slot) },
      { label: "Period", html: x => `${fshort(x.start_date)} – ${fdate(x.end_date)}` },
      { label: "Upcoming", cls: "num", html: x => S.where("Session", s => s.series_id === x.series_id && s.session_date >= S.TODAY && s.status === "Scheduled").length },
      { label: "Status", html: x => x.status === "Ended" || x.end_date < S.TODAY ? '<span class="tag">Ended</span>' : S.daysBetween(S.TODAY, x.end_date) <= 7 ? '<span class="tag a">Ends soon</span>' : '<span class="tag g">Active</span>' },
      ...(manage ? [{ label: "", cls: "num", html: x => x.status === "Ended" ? "" : `<div class="acts"><button class="btn btn-ghost btn-xs" data-act="series-edit" data-id="${x.series_id}">Change</button><button class="btn btn-ghost btn-xs" data-act="series-end" data-id="${x.series_id}">End</button></div>` }] : [])] });
  }
  const canManage = eid => S.can("session.manage") && A.visibleEnrollment(eid);
  function seriesTab(visIds) {
    const rows = S.where("SessionSeries", x => visIds.includes(x.pt_enrollment_id)).sort((a, b) => (a.status === "Ended") - (b.status === "Ended") || a.end_date.localeCompare(b.end_date));
    return `<section class="card fade"><div class="card-head"><div><h2>Recurring schedules</h2><div class="sub">Agreed weekly slots. Sessions are created automatically and every new time is checked for clashes.</div></div>${S.can("session.manage") ? `<button class="btn btn-yellow btn-sm" data-act="series-new">${ico("plus")}New recurring schedule</button>` : ""}</div>${seriesTable(rows, { manage: S.can("session.manage") })}</section>`;
  }
  function seriesCards(e) {
    const rows = S.where("SessionSeries", x => x.pt_enrollment_id === e.pt_enrollment_id && x.status !== "Ended" && x.end_date >= S.TODAY);
    const manage = canManage(e.pt_enrollment_id);
    return `<section class="card fade"><div class="card-head"><div><h2>Regular schedule</h2><div class="sub">${rows.length ? "Sessions repeat automatically until the end date." : "No recurring schedule yet."}</div></div>${manage ? `<button class="btn btn-yellow btn-sm" data-act="series-new" data-id="${e.pt_enrollment_id}">${ico("plus")}Recurring schedule</button>` : ""}</div>
      ${rows.length ? seriesTable(rows, { manage }) : ""}</section>`;
  }
  function changeRequests(visIds) {
    const rows = S.where("SessionChangeRequest", r => r.status === "Pending" && visIds.includes(S.get("Session", r.session_id).pt_enrollment_id));
    return `<section class="card fade"><div class="card-head"><div><h2>Change requests</h2><div class="sub">Members asking to move or cancel a booked session.</div></div></div>
      ${rows.length ? rows.map(r => { const s = S.get("Session", r.session_id), e = enr(s.pt_enrollment_id);
        return `<div class="row" style="align-items:flex-start"><div class="pic">${U.esc(U.initials(memberName(e.member_id)))}</div><div class="who"><b><a href="#/members/${e.member_id}?tab=sessions">${esc(memberName(e.member_id))}</a></b>
          <span>${r.kind === "move" ? `Move ${when(s.session_date, s.time_slot)} → <strong style="color:var(--fg)">${when(r.new_date, r.new_time)}</strong>` : `Cancel ${when(s.session_date, s.time_slot)}`} · ${U.rel(r.created_at)}</span>${r.note ? `<p style="margin-top:6px;font-size:15px">"${esc(r.note)}"</p>` : ""}</div>
          ${S.can("session.manage") ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-ink btn-xs" data-act="scr-accept" data-id="${r.request_id}">Accept</button><button class="btn btn-ghost btn-xs" data-act="sess-edit" data-id="${s.session_id}">Other time</button><button class="btn btn-ghost btn-xs" data-act="scr-decline" data-id="${r.request_id}">Decline</button></div>` : ""}</div>`; }).join("")
        : `<div class="empty"><b>No change requests</b></div>`}</section>`;
  }
  function memberAction(s) {
    if (s.status !== "Scheduled") return "";
    const p = pendingReq(s.session_id);
    return p ? `<span class="tag y">Change requested</span>` : `<button class="btn btn-ghost btn-xs" data-act="scr-new" data-id="${s.session_id}">Request change</button>`;
  }
  function memberSeriesCard(pt) {
    const rows = S.where("SessionSeries", x => x.pt_enrollment_id === pt.pt_enrollment_id && x.status !== "Ended" && x.end_date >= S.TODAY);
    return rows.length ? `<section class="card fade"><div class="card-head"><div><h2>Your regular schedule</h2><div class="sub">Agreed with ${esc(trainerName(pt.trainer_id))}. Need to change one day? Use "Request change" next to that session below.</div></div></div>
      <div class="tl">${rows.map(x => `<div class="tl-item"><time>${ftime(x.time_slot)}</time><div><b>${esc(daysLabel(x.days_of_week))}</b><span>${fdate(x.start_date > S.TODAY ? x.start_date : S.TODAY)} – ${fdate(x.end_date)}</span></div></div>`).join("")}</div></section>` : "";
  }

  function bellHtml() {
    const unread = S.myNotifications().filter(n => !n.read_at).length;
    return `<div class="bell-wrap"><button class="bell" data-act="notif" aria-label="Notifications${unread ? `, ${unread} unread` : ""}" aria-expanded="false" aria-controls="notifPanel">${ico("bell")}${unread ? `<span class="bell-n">${unread}</span>` : ""}</button></div>`;
  }
  function notifPanel() {
    let p = document.getElementById("notifPanel");
    if (!p) { p = document.createElement("div"); p.id = "notifPanel"; p.className = "notif-panel"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Notifications"); document.body.appendChild(p); }
    return p;
  }
  function placePanel(btn, p) {
    const r = btn.getBoundingClientRect(), gap = 16, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const w = Math.min(400, vw - gap * 2);
    p.style.width = w + "px";
    p.style.left = Math.max(gap, Math.min(r.left, vw - w - gap)) + "px";
    p.style.top = (r.bottom + 10) + "px";
    p.style.maxHeight = Math.max(220, vh - r.bottom - 10 - gap) + "px";
  }
  function closeBell() {
    const p = document.getElementById("notifPanel");
    if (p && !p.hidden) { p.hidden = true; document.querySelectorAll(".bell").forEach(b => b.setAttribute("aria-expanded", "false")); }
  }
  function openBell(btn) {
    const panel = notifPanel();
    if (!panel.hidden) { closeBell(); return; }
    const list = S.myNotifications().slice(0, 12);
    const fresh = list.filter(n => !n.read_at).length;
    panel.innerHTML = `<div class="np-head"><b>Notifications</b>${fresh ? `<span class="np-new">${fresh} new</span>` : ""}<button class="np-close" type="button" aria-label="Close notifications">×</button></div>
      <div class="np-list">${list.length ? list.map(n => `<a class="np-item${n.read_at ? "" : " unread"}" href="${esc(n.link || "#/")}"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${U.rel(n.created_at)}</small></a>`).join("") : `<div class="np-empty">${ico("bell")}<b>All caught up</b><span>Nothing new right now. Updates about your sessions, payments and requests will show up here.</span></div>`}</div>`;
    placePanel(btn, panel);
    panel.hidden = false; btn.setAttribute("aria-expanded", "true");
    S.markAllRead();
    const badge = btn.querySelector(".bell-n"); if (badge) badge.remove();
  }
  document.addEventListener("click", e => {
    const p = document.getElementById("notifPanel");
    if (!p || p.hidden) return;
    if (e.target.closest(".np-close") || e.target.closest(".np-item") || (!e.target.closest("#notifPanel") && !e.target.closest(".bell-wrap"))) closeBell();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeBell(); });
  window.addEventListener("resize", closeBell);
  window.addEventListener("hashchange", closeBell);
  document.addEventListener("scroll", e => { if (!e.target.closest || !e.target.closest("#notifPanel")) closeBell(); }, true);

  Object.assign(A.ACT, {
    "sess-new": el => sessionForm({ enrollmentId: el.dataset.id }),
    "sess-edit": el => sessionForm({ session: S.get("Session", el.dataset.id) }),
    "series-new": el => seriesForm({ enrollmentId: el.dataset.id }),
    "series-edit": el => seriesForm({ series: S.get("SessionSeries", el.dataset.id) }),
    "series-end": el => endSeries(S.get("SessionSeries", el.dataset.id)),
    "scr-new": el => memberChangeRequest(S.get("Session", el.dataset.id)),
    "scr-accept": el => acceptChange(S.get("SessionChangeRequest", el.dataset.id)),
    "scr-decline": el => declineChange(S.get("SessionChangeRequest", el.dataset.id)),
    "req-session": memberNewSession,
    "req-accept": el => acceptNewSession(S.get("Session", el.dataset.id)),
    "req-decline": el => { const s = S.get("Session", el.dataset.id); S.tx(() => { S.update("Session", s.session_id, { status: "Cancelled" }); tellMember(s.pt_enrollment_id, "Session request declined", `${when(s.session_date, s.time_slot)} isn't possible. Try another time.`); }); U.toast("Declined. The member has been notified."); A.refresh(); },
    "notif": el => openBell(el)
  });

  window.Sched = { seriesTab, seriesCards, changeRequests, memberAction, memberSeriesCard, pendingReq, bellHtml, daysLabel };
})();
