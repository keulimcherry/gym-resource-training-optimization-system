(function () {
  "use strict";

  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => new Date(s.length > 10 ? s : s + "T00:00:00");
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonthsEnd = (s, n) => { const d = parse(s); d.setMonth(d.getMonth() + n); d.setDate(d.getDate() - 1); return iso(d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const now = () => new Date();
  const TODAY = iso(now());
  const DAY3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowOf = s => DOW[parse(s).getDay()];
  const stamp = d => `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const PK = {
    MembershipPlan: "plan_id", Member: "member_id", Trainer: "trainer_id", Membership: "membership_id",
    PersonalTrainingEnrollment: "pt_enrollment_id", TrainingPlan: "plan_version_id", Session: "session_id",
    ProgressRecord: "record_id", ClassSchedule: "class_id", GroupClass: "occurrence_id",
    ClassAttendance: "attendance_id", Payment: "payment_id", Equipment: "equipment_id", CheckIn: "checkin_id",
    Announcement: "announcement_id", Lead: "lead_id", User: "user_id", AuditLog: "audit_id", TrainerChange: "change_id",
    SessionSeries: "series_id", SessionChangeRequest: "request_id", Notification: "notification_id"
  };
  const emptyDb = () => { const db = { _seq: {}, _seededFor: TODAY }; Object.keys(PK).forEach(t => { db[t] = []; db._seq[t] = 0; }); return db; };
  let MODE = "prototype", tmpSeq = 0;
  function rawInsert(db, table, row) {
    const id = MODE === "api" ? --tmpSeq : ++db._seq[table];
    const r = Object.assign({ [PK[table]]: id }, row);
    db[table].push(r);
    return r;
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seed() {
    const R = rng(21);
    const pick = a => a[Math.floor(R() * a.length)];
    const int = (a, b) => a + Math.floor(R() * (b - a + 1));
    const db = emptyDb();
    const ins = (t, r) => rawInsert(db, t, r);
    const METHODS = ["Cash", "Cash", "Mobile Banking", "Mobile Banking", "Card", "Bank Transfer"];

    [["Monthly Basic", 1, 3000], ["Quarterly Standard", 3, 8000], ["Annual Premium", 12, 28000]]
      .forEach(([plan_type, duration_months, price]) => ins("MembershipPlan", { plan_type, duration_months, price }));

    [["Rohan Tamang", "Strength & conditioning"], ["Mira Gurung", "Yoga & mobility"], ["Suman Thapa", "HIIT & fat loss"],
     ["Asha Rai", "Functional training"], ["Bijay Lama", "Bodybuilding"]]
      .forEach(([name, specialization]) => ins("Trainer", { name, specialization, contact_number: "98" + int(41000000, 69999999) }));

    const NAMES = ["Aarav Shrestha", "Prakriti Karki", "Bikash Rai", "Rojina Magar", "Sujan Thapa", "Anjali Gurung", "Nabin Lama",
      "Kiran Joshi", "Srijana Adhikari", "Manish KC", "Sabina Tamang", "Dipesh Shah", "Pooja Bhandari", "Ritesh Gautam",
      "Sarita Poudel", "Hemant Basnet", "Nisha Maharjan", "Rajan Bista", "Shristi Pandey", "Ujjwal Khadka", "Asmita Ghimire",
      "Pradeep Rana", "Laxmi Dahal", "Sandeep Bhattarai", "Kabita Shahi", "Roshan Neupane"];
    const MED = ["No known medical conditions", "No known medical conditions", "No known medical conditions", "None reported", "Mild asthma (carries inhaler)", "Old left-knee injury, avoid deep lunges",
      "High blood pressure, on medication", "Lower back pain, history of disc bulge", "Type 2 diabetes, monitor sugar before HIIT"];
    NAMES.forEach((name, i) => ins("Member", {
      name, contact_number: "98" + int(41000000, 69999999),
      email: name.toLowerCase().replace(/\s+/g, ".") + "@example.com",
      medical_history: i === 0 ? "Mild asthma (carries inhaler)" : pick(MED),
      joined_date: null
    }));

    const pay = (member_id, link, amount, payment_date) => ins("Payment", Object.assign({
      member_id, membership_id: null, pt_enrollment_id: null, amount, payment_date,
      method: pick(METHODS), status: "valid", void_reason: null, recorded_by: 3
    }, link));
    db.Member.forEach((m, i) => {
      const plan = i === 0 ? db.MembershipPlan[1] : db.MembershipPlan[[0, 1, 1, 2, 0, 1][int(0, 5)]];
      let start = i === 0 ? addDays(TODAY, -70) : addDays(TODAY, -int(0, plan.duration_months * 30 + 45));
      m.joined_date = start;
      let guard = 0;
      while (guard++ < 4) {
        const end = addMonthsEnd(start, plan.duration_months);
        const agreed = plan.price - (R() < .15 ? 500 : 0);
        const ms = ins("Membership", { member_id: m.member_id, plan_id: plan.plan_id, start_date: start, end_date: end, agreed_price: agreed });
        const r = R(), expired = end < TODAY;
        if (i === 0) pay(m.member_id, { membership_id: ms.membership_id }, 5000, start);
        else if (r < .62 || expired) pay(m.member_id, { membership_id: ms.membership_id }, agreed, start);
        else if (r < .87) {
          const first = Math.round(agreed / 2 / 500) * 500;
          pay(m.member_id, { membership_id: ms.membership_id }, first, start);
          if (R() < .3) pay(m.member_id, { membership_id: ms.membership_id }, 500, addDays(start, int(5, 20)) > TODAY ? TODAY : addDays(start, int(5, 20)));
        }
        if (!(expired && R() < .55)) break;
        start = addDays(end, 1);
        if (start > TODAY) break;
      }
    });

    const PT = [
      [0, 1, "loss"], [5, 3, "loss"], [7, 1, "strength"], [2, 1, "gain"], [8, 2, "mobility"],
      [6, 5, "gain"], [12, 4, "loss"], [15, 5, "strength"], [14, 3, "loss"]
    ];
    const GOALS = { loss: "Lose 8 kg and build a strength base", gain: "Gain 5 kg of lean muscle", strength: "Squat bodyweight, deadlift 1.5× bodyweight", mobility: "Fix lower-back pain and move freely" };
    const PLANS = {
      loss: ["Full-body 3×/week · 30-min incline walk after lifting · ~400 kcal daily deficit", "Upper/lower split 4×/week · add 2 interval sessions · protein 1.6 g/kg", "Push/pull/legs · HIIT finisher twice a week · keep the deficit, add a refeed day"],
      gain: ["Full-body 3×/week · +300 kcal surplus · learn the main lifts", "Upper/lower 4×/week · progressive overload, add 2.5 kg per week", "Push/pull/legs 5×/week · +400 kcal surplus · creatine 5 g/day"],
      strength: ["Technique block: squat, bench, deadlift 3×5 at RPE 7", "Linear progression 5×5 · rows and pull-ups as accessories", "Heavy triples plus back-off sets · deload every 4th week"],
      mobility: ["Daily 20-min mobility flow · core bracing basics · no loaded flexion", "Hip-hinge patterning · yoga twice a week · glute bridges 3×12", "Loaded carries · single-leg strength · return to light deadlifts"]
    };
    const START_W = { loss: 84, gain: 61, strength: 74, mobility: 69 };
    const STEP_W = { loss: -0.9, gain: 0.55, strength: 0.15, mobility: -0.25 };
    const LIFT = { loss: ["Squat", 40, 5], gain: ["Bench press", 35, 2.5], strength: ["Deadlift", 80, 7.5], mobility: ["Plank", 40, 10] };
    const T_NOTES = ["Good session, form on squats much cleaner.", "Pushed the last set hard, keep the same weight next week.", "Low energy today, kept it light.",
      "Hit a new best, very happy with progress.", "Watch the knees on lunges; cue 'knees out'.", "Diet consistency improving, keep logging meals.",
      "Breathing better through intervals.", "Ready to move up a version soon."];
    const M_NOTES = ["Felt strong today, legs finally recovering faster.", "Skipped Wednesday, was sick. Back on track.", "Walked 10k steps every day this week!",
      "Slept badly, low energy at the gym.", "Clothes fitting looser 🎉", "Knee felt totally fine during lunges.", "Ate out a lot this week, need to be careful.",
      "Did the mobility flow at home twice.", "Best workout in weeks.", "Shoulder a bit sore after push day."];
    const SLOTS = ["06:30", "07:00", "08:00", "17:00", "18:00", "18:30", "07:30", "17:30", "19:00"];
    const PATTERNS = [[1, 3, 5], [2, 4, 6], [1, 3, 5], [0, 2, 4], [1, 4, 6], [2, 5, 0], [1, 3, 5], [2, 4, 6], [3, 5, 0]];

    PT.forEach(([mi, trainer_id, g], k) => {
      const m = db.Member[mi];
      const start = k === 0 ? addDays(TODAY, -98) : addDays(TODAY, -int(40, 130));
      const fee = k === 0 ? 12000 : pick([9000, 12000, 18000]);
      const e = ins("PersonalTrainingEnrollment", { member_id: m.member_id, trainer_id, goal: GOALS[g], start_date: start, end_date: null, fee });
      const r = R();
      if (k === 0) pay(m.member_id, { pt_enrollment_id: e.pt_enrollment_id }, 9000, start);
      else if (r < .6) pay(m.member_id, { pt_enrollment_id: e.pt_enrollment_id }, fee, start);
      else if (r < .9) pay(m.member_id, { pt_enrollment_id: e.pt_enrollment_id }, fee / 2, start);
      const versions = [];
      let vd = start, v = 1;
      while (vd <= TODAY && v <= 3) {
        versions.push(ins("TrainingPlan", { pt_enrollment_id: e.pt_enrollment_id, version_number: v, is_current: false, created_date: vd, details: PLANS[g][v - 1] }));
        vd = addDays(vd, int(30, 40)); v++;
      }
      versions[versions.length - 1].is_current = true;
      const versionAt = d => versions.filter(x => x.created_date <= d).pop() || versions[0];
      const slot = SLOTS[k % SLOTS.length], days = PATTERNS[k % PATTERNS.length];
      const serEnd = addDays(TODAY, int(21, 56));
      const ser = ins("SessionSeries", { pt_enrollment_id: e.pt_enrollment_id, trainer_id, days_of_week: days.slice().sort().map(d => DAY3[d]).join(","),
        time_slot: slot, start_date: start, end_date: serEnd, status: "Active", created_by: 3, created_at: start + " 10:00" });
      for (let d = start; d <= serEnd; d = addDays(d, 1)) {
        if (!days.includes(parse(d).getDay())) continue;
        const status = d < TODAY ? (R() < .86 ? "Completed" : R() < .6 ? "No-show" : "Cancelled") : "Scheduled";
        ins("Session", { pt_enrollment_id: e.pt_enrollment_id, trainer_id, series_id: ser.series_id, is_exception: false, plan_version_id: versionAt(d).plan_version_id, session_date: d, time_slot: slot, status });
      }
      let w = START_W[g] + int(-3, 3), lift = LIFT[g][1];
      for (let d = start, n = 0; d < TODAY; d = addDays(d, 14), n++) {
        if (n) { w = +(w + STEP_W[g] + (R() - .5) * .6).toFixed(1); lift += LIFT[g][2]; }
        ins("ProgressRecord", { member_id: m.member_id, trainer_id, source: "trainer", plan_version_id: versionAt(d).plan_version_id,
          record_date: d, weight: w, strength_metric: `${LIFT[g][0]} ${lift}${g === "mobility" ? " s" : " kg"}`, notes: n ? pick(T_NOTES) : "Baseline assessment. Measurements taken, goals agreed." });
        const jd = addDays(d, int(4, 9));
        if (jd < TODAY && R() < .85) {
          ins("ProgressRecord", { member_id: m.member_id, trainer_id: null, source: "member", plan_version_id: versionAt(jd).plan_version_id,
            record_date: jd, weight: R() < .6 ? +(w + STEP_W[g] / 2 + (R() - .5) * .4).toFixed(1) : null, strength_metric: null, notes: pick(M_NOTES) });
        }
      }
    });
    [[0, 3, "17:00"], [7, 2, "10:00"]].forEach(([k, inDays, time_slot]) => {
      const e = db.PersonalTrainingEnrollment[k];
      const cur = db.TrainingPlan.find(v => v.pt_enrollment_id === e.pt_enrollment_id && v.is_current);
      ins("Session", { pt_enrollment_id: e.pt_enrollment_id, trainer_id: e.trainer_id, series_id: null, is_exception: false, plan_version_id: cur.plan_version_id, session_date: addDays(TODAY, inDays), time_slot, status: "Requested" });
    });
    db.Member.forEach((m, i) => {
      if (PT.some(p => p[0] === i) || i % 3) return;
      let w = int(58, 88);
      for (let n = 0; n < 3; n++) {
        const d = addDays(TODAY, -int(5, 25) - n * 25);
        if (d < m.joined_date) continue;
        ins("ProgressRecord", { member_id: m.member_id, trainer_id: null, source: "member", plan_version_id: null, record_date: d, weight: w - n * .5, strength_metric: null, notes: pick(M_NOTES) });
      }
    });

    [["Morning HIIT", 3, "Monday", 45, "06:30"], ["Morning HIIT", 3, "Wednesday", 45, "06:30"], ["Morning HIIT", 3, "Friday", 45, "06:30"],
     ["Yoga Flow", 2, "Tuesday", 60, "17:00"], ["Yoga Flow", 2, "Thursday", 60, "17:00"], ["Evening Yoga", 2, "Friday", 60, "17:30"],
     ["Saturday Strength Club", 1, "Saturday", 75, "08:00"], ["Functional Circuit", 4, "Sunday", 50, "07:00"]]
      .forEach(([class_name, trainer_id, day_of_week, duration_minutes, usual_start_time]) =>
        ins("ClassSchedule", { trainer_id, class_name, day_of_week, duration_minutes, usual_start_time }));
    const regulars = {};
    db.ClassSchedule.forEach(c => {
      if (!regulars[c.class_name]) {
        const set = new Set(); while (set.size < 8) set.add(int(1, db.Member.length));
        regulars[c.class_name] = [...set];
      }
    });
    for (let d = addDays(TODAY, -21); d <= addDays(TODAY, 7); d = addDays(d, 1)) {
      db.ClassSchedule.filter(c => c.day_of_week === dowOf(d)).forEach(c => {
        const o = ins("GroupClass", { class_id: c.class_id, occurrence_date: d, start_time: c.usual_start_time });
        if (d >= TODAY) return;
        regulars[c.class_name].forEach(member_id => {
          if (R() < .72) ins("ClassAttendance", { occurrence_id: o.occurrence_id, member_id, status: R() < .9 ? "Attended" : R() < .5 ? "No-show" : "Cancelled" });
        });
      });
    }

    for (let back = 30; back >= 1; back--) {
      const d = addDays(TODAY, -back), n = int(9, 16);
      for (let k = 0; k < n; k++) {
        const t = parse(d); t.setHours(int(6, 19), int(0, 59));
        const out = new Date(t.getTime() + int(50, 120) * 6e4);
        ins("CheckIn", { member_id: int(1, db.Member.length), check_in_time: stamp(t), check_out_time: stamp(out) });
      }
    }
    const nowT = now(), inside = new Set();
    while (inside.size < 20) inside.add(int(1, db.Member.length));
    inside.add(1);
    [...inside].slice(0, 20).forEach(member_id => {
      const t = new Date(nowT.getTime() - int(5, 140) * 6e4);
      ins("CheckIn", { member_id, check_in_time: stamp(t), check_out_time: null });
    });

    [["Treadmill", "Cardio", 6, -95], ["Spin bike", "Cardio", 8, -40], ["Rowing machine", "Cardio", 3, -70], ["Power rack", "Strength", 4, -30],
     ["Smith machine", "Strength", 1, -100], ["Cable crossover", "Strength", 2, -12], ["Leg press", "Strength", 2, -84], ["Lat pulldown", "Strength", 2, -55],
     ["Dumbbell set (2.5–50 kg)", "Free Weights", 20, -60], ["Olympic barbell", "Free Weights", 10, -20], ["Kettlebells", "Free Weights", 16, -45], ["Battle ropes", "Accessories", 4, -110]]
      .forEach(([name, category, quantity, ago]) => {
        const last = addDays(TODAY, ago);
        ins("Equipment", { name, category, quantity, last_service_date: last, next_service_due: addDays(last, 90) });
      });

    const minsAgo = m => stamp(new Date(nowT.getTime() - m * 6e4));
    [["Sabin Koirala", "9841XXXX21", "Personal training", "Want to lose weight before my wedding in March.", 12, "New"],
     ["Reena Thapa", "9803XXXX55", "Gym membership", "", 65, "New"],
     ["Amit Karki", "9860XXXX10", "A free tour", "Can I come on Saturday morning?", 60 * 26, "Contacted"],
     ["Puja Rai", "9818XXXX77", "Group classes", "Interested in yoga only.", 60 * 50, "New"],
     ["Suresh Malla", "9849XXXX02", "Gym membership", "Price for 6 months?", 60 * 24 * 6, "Contacted"]]
      .forEach(([name, contact, interest, message, ago, status]) => ins("Lead", { name, contact, interest, message, submitted_date: minsAgo(ago), status }));

    [["owner", "Nirmal KC", "owner", null, null], ["accounts", "Sunita Pandey", "accountant", null, null], ["frontdesk", "Sita Karki", "front_desk", null, null]]
      .forEach(([username, display_name, role, member_id, trainer_id]) => ins("User", { username, display_name, role, member_id, trainer_id, is_active: true, last_login: null }));
    db.Trainer.forEach(t => ins("User", { username: "coach." + t.name.split(" ")[0].toLowerCase(), display_name: t.name, role: "trainer", member_id: null, trainer_id: t.trainer_id, is_active: true, last_login: null }));
    db.Member.slice(0, 10).forEach(m => ins("User", { username: m.name.toLowerCase().replace(/\s+/g, "."), display_name: m.name, role: "member", member_id: m.member_id, trainer_id: null, is_active: true, last_login: null }));

    [["New machines just landed on the floor", "Fresh cable stations and a second squat rack are now open. Come try them this week.", "Announcement", "https://images.unsplash.com/photo-1728486145245-d4cb0c9c3470?w=900&q=70&auto=format&fit=crop", -1],
     ["Saturday Strength Club", "Barbell basics in a small group. Free for Quarterly & Annual members.", "Class", "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=900&q=70&auto=format&fit=crop", -4],
     ["Festival offer: 2 weeks free", "Join any Quarterly plan this month and get two extra weeks on us.", "Offer", "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=900&q=70&auto=format&fit=crop", -8]]
      .forEach(([title, body, tag, image_path, ago]) => ins("Announcement", { title, body, tag, image_path, posted_date: addDays(TODAY, ago), posted_by: 3, is_published: true }));

    const p = db.Payment.find(x => x.amount >= 3000 && x.payment_date < addDays(TODAY, -10));
    if (p) ins("AuditLog", { user_id: 2, action: "update", table_name: "Payment", record_id: p.payment_id, old_values: { amount: p.amount + 500 }, new_values: { amount: p.amount }, reason: "Typo at the desk: the paper receipt shows the lower amount.", created_at: minsAgo(60 * 24 * 5) });
    const ser0 = db.SessionSeries[0];
    ins("Notification", { user_id: db.User.find(u => u.member_id === 1).user_id, title: "Your training schedule is set",
      body: `${ser0.days_of_week.replace(/,/g, ", ")} at ${+ser0.time_slot.slice(0, 2) % 12 || 12}:${ser0.time_slot.slice(3)} ${+ser0.time_slot.slice(0, 2) < 12 ? "AM" : "PM"} with Rohan Tamang until ${parse(ser0.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`, link: "#/me/sessions", created_at: minsAgo(60 * 24 * 3), read_at: null });
    const anj = db.PersonalTrainingEnrollment[1];
    ins("TrainerChange", { pt_enrollment_id: anj.pt_enrollment_id, member_id: anj.member_id, from_trainer_id: anj.trainer_id, to_trainer_id: 2,
      reason_type: "Schedule doesn't fit", reason: "I can only come after 5 PM now because of my new job. Coach Mira has evening slots.",
      status: "Pending", requested_by: db.User.find(u => u.member_id === anj.member_id).user_id, requested_at: minsAgo(60 * 20), decided_by: null, decided_at: null, staff_note: null });
    ins("AuditLog", { user_id: 3, action: "create", table_name: "Member", record_id: db.Member.length, old_values: null, new_values: { name: db.Member[db.Member.length - 1].name }, reason: null, created_at: minsAgo(60 * 24 * 2) });
    return db;
  }

  const KEY = "moksha.prototype.v6";
  let db, CSRF = "", apiUser = null, journal = null, created = [], txDepth = 0, lastNotices = [];
  function api(method, url, body) {
    const x = new XMLHttpRequest();
    x.open(method, url, false);
    x.setRequestHeader("Accept", "application/json");
    if (body !== undefined) x.setRequestHeader("Content-Type", "application/json");
    if (CSRF) x.setRequestHeader("X-CSRF-Token", CSRF);
    try { x.send(body === undefined ? null : JSON.stringify(body)); } catch (e) { return { status: 0, data: null }; }
    let data = null;
    try { data = JSON.parse(x.responseText); } catch (e) {}
    return { status: x.status, data };
  }
  function loadSnapshot(data) {
    const next = emptyDb();
    Object.keys(PK).forEach(t => { next[t] = (data.tables && data.tables[t]) || []; });
    db = next;
    if (data.csrf) CSRF = data.csrf;
    if (data.user) apiUser = data.user;
  }
  const probe = location.protocol.startsWith("http") ? api("GET", "api/session") : null;
  if (probe && probe.data && typeof probe.data.ok === "boolean" && (probe.status === 200 || probe.status === 401)) {
    MODE = "api";
    db = emptyDb();
    if (probe.status === 200) loadSnapshot(probe.data);
  } else {
    try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { db = null; }
    if (!db || db._seededFor !== TODAY || !db.User) db = seed();
  }
  const save = () => { if (MODE === "api") return; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  save();
  const failMessage = r => (r.data && r.data.error) || (r.status === 0 ? "Can't reach the server. Check the connection and try again." : "The server couldn't save this. Try again.");
  function commit(ops) {
    const r = api("POST", "api/tx", { ops });
    if (r.status === 401) { location.href = "home.html#login"; throw new Error("Your session ended. Please log in again."); }
    if (!(r.status === 200 && r.data && r.data.ok)) throw new Error(failMessage(r));
    const idmap = r.data.idmap || {};
    const pkTable = {};
    Object.entries(PK).forEach(([t, k]) => { pkTable[k] = t; });
    const real = (t, v) => (idmap[t] && idmap[t][String(v)]) || v;
    created.forEach(([t, row]) => {
      Object.keys(row).forEach(k => { if (typeof row[k] === "number" && row[k] < 0 && pkTable[k]) row[k] = real(pkTable[k], row[k]); });
    });
    lastNotices = r.data.notices || [];
    loadSnapshot(r.data);
  }
  function record(op) {
    if (MODE !== "api") return;
    if (journal) { journal.push(op); return; }
    const before = JSON.stringify(db);
    created = [];
    try { commit([op]); } catch (e) { db = JSON.parse(before); throw e; }
  }

  const ROLE_LABEL = { owner: "Owner", accountant: "Accountant", front_desk: "Front desk", trainer: "Trainer", member: "Member" };
  const ALL = ["member.view", "member.create", "member.edit", "member.medical", "membership.create", "pt.create", "pt.assign",
    "payment.view", "payment.create", "payment.edit", "payment.void", "dues.view", "revenue.view",
    "attendance.mark", "checkin", "trainer.view", "trainer.manage", "class.view", "class.manage",
    "plan.view", "plan.manage", "session.view", "session.manage", "progress.view", "progress.create",
    "equipment.view", "equipment.manage", "updates.manage", "leads.manage", "reports.view", "audit.view", "staff.manage", "pricing.manage"];
  const PERMS = {
    owner: ALL,
    accountant: ["member.view", "payment.view", "payment.create", "payment.edit", "payment.void", "dues.view", "revenue.view", "reports.view", "audit.view", "trainer.view", "class.view"],
    front_desk: ["member.view", "member.create", "member.edit", "member.medical", "membership.create", "pt.create", "pt.assign", "payment.view", "payment.create", "dues.view",
      "attendance.mark", "checkin", "trainer.view", "class.view", "class.manage", "plan.view", "session.view", "session.manage", "progress.view",
      "equipment.view", "equipment.manage", "updates.manage", "leads.manage"],
    trainer: ["member.view", "member.medical", "attendance.mark", "class.view", "plan.view", "plan.manage", "session.view", "session.manage", "progress.view", "progress.create"],
    member: ["progress.create"]
  };
  const session = { role: "front_desk", user: null };
  function login(role, username) {
    if (MODE === "api") {
      if (!apiUser) return;
      session.role = apiUser.role;
      session.user = Object.assign({}, db.User.find(u => u.user_id === apiUser.user_id) || {}, apiUser);
      return;
    }
    const named = username && db.User.find(u => u.username === username && u.is_active);
    if (named) role = named.role;
    if (!PERMS[role]) role = "front_desk";
    session.role = role;
    session.user = named || db.User.find(u => u.role === role && (role !== "trainer" || u.trainer_id === 1) && (role !== "member" || u.member_id === 1));
    session.user.last_login = stamp(now());
    save();
  }
  const can = p => PERMS[session.role].includes(p);
  const myTrainerId = () => session.user && session.user.trainer_id;
  const myMemberId = () => session.user && session.user.member_id;

  const all = t => db[t];
  const get = (t, id) => db[t].find(r => r[PK[t]] === +id);
  const where = (t, fn) => db[t].filter(fn);
  const clone = o => JSON.parse(JSON.stringify(o));

  function audit(action, table, id, oldV, newV, reason) {
    if (MODE === "api") return;
    rawInsert(db, "AuditLog", { user_id: session.user.user_id, action, table_name: table, record_id: id, old_values: oldV, new_values: newV, reason: reason || null, created_at: stamp(now()) });
  }
  const AUDITED = ["Payment", "Membership", "PersonalTrainingEnrollment", "Member", "User", "MembershipPlan", "TrainerChange"];

  function tx(fn) {
    if (txDepth > 0) return fn();
    const snapshot = JSON.stringify(db);
    txDepth++;
    if (MODE === "api") { journal = []; created = []; }
    try {
      const out = fn();
      if (MODE === "api") { const ops = journal; journal = null; if (ops.length) commit(ops); }
      save();
      return out;
    } catch (e) { db = JSON.parse(snapshot); throw e; }
    finally { txDepth--; journal = null; }
  }
  function check(table, row) {
    if (table === "Payment") {
      if (row.membership_id && row.pt_enrollment_id) throw new Error("A payment can be linked to a membership or a PT enrollment, not both.");
      if (!(row.amount > 0)) throw new Error("Payment amount must be more than zero.");
    }
    if (table === "Membership" && row.end_date < row.start_date) throw new Error("End date can't be before the start date.");
    if (table === "ProgressRecord" && db.ProgressRecord.some(r => r.member_id === row.member_id && r.record_date === row.record_date && r.source === row.source && r.record_id !== row.record_id))
      throw new Error(`There's already a ${row.source} entry for this member on that date. Edit that one instead.`);
    if (table === "GroupClass" && db.GroupClass.some(r => r.class_id === row.class_id && r.occurrence_date === row.occurrence_date && r.occurrence_id !== row.occurrence_id))
      throw new Error("That class already has an occurrence on this date.");
    if (table === "Session" && db.Session.some(r => r.pt_enrollment_id === row.pt_enrollment_id && r.session_date === row.session_date && r.time_slot === row.time_slot && r.session_id !== row.session_id && r.status !== "Cancelled"))
      throw new Error("This client already has a session at that date and time.");
    if (table === "User" && db.User.some(u => u.username === row.username && u.user_id !== row.user_id)) throw new Error("That username is taken.");
    if (table === "Member" && db.Member.some(m => m.email.toLowerCase() === String(row.email).toLowerCase() && m.member_id !== row.member_id)) throw new Error("A member with this email already exists.");
  }
  function insert(table, row) {
    check(table, row);
    const r = rawInsert(db, table, row);
    if (MODE === "api") { created.push([table, r]); record({ op: "insert", table, row: clone(r) }); }
    if (AUDITED.includes(table)) audit("create", table, r[PK[table]], null, clone(row));
    return r;
  }
  function update(table, id, patch, reason) {
    const r = get(table, id);
    const next = Object.assign({}, r, patch);
    check(table, next);
    const oldV = {}, newV = {};
    Object.keys(patch).forEach(k => { if (r[k] !== patch[k]) { oldV[k] = r[k]; newV[k] = patch[k]; } });
    Object.assign(r, patch);
    if (MODE === "api" && Object.keys(newV).length) record({ op: "update", table, id: r[PK[table]], row: clone(newV), reason: reason || null });
    if (AUDITED.includes(table) && Object.keys(newV).length) audit("update", table, id, oldV, newV, reason);
    return r;
  }

  const planOf = ms => get("MembershipPlan", ms.plan_id);
  const validPayments = fn => db.Payment.filter(p => p.status === "valid" && fn(p));
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const membershipOwed = id => { const ms = get("Membership", id); return Math.max(0, ms.agreed_price - sum(validPayments(p => p.membership_id === ms.membership_id), p => p.amount)); };
  const ptOwed = id => { const e = get("PersonalTrainingEnrollment", id); return Math.max(0, e.fee - sum(validPayments(p => p.pt_enrollment_id === e.pt_enrollment_id), p => p.amount)); };
  const membershipsOf = mid => where("Membership", x => x.member_id === +mid).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const enrollmentsOf = mid => where("PersonalTrainingEnrollment", x => x.member_id === +mid).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const memberOwed = mid => sum(membershipsOf(mid), x => membershipOwed(x.membership_id)) + sum(enrollmentsOf(mid), x => ptOwed(x.pt_enrollment_id));
  const currentMembership = mid => membershipsOf(mid).find(x => x.start_date <= TODAY && x.end_date >= TODAY) || null;
  const latestMembership = mid => membershipsOf(mid)[0] || null;
  const activePT = mid => enrollmentsOf(mid).find(e => !e.end_date || e.end_date >= TODAY) || null;
  function memberStatus(mid) {
    const cur = currentMembership(mid);
    if (cur) { const left = daysBetween(TODAY, cur.end_date); return left <= 7 ? { key: "ending", label: `Ends in ${left}d`, cls: "a" } : { key: "active", label: "Active", cls: "g" }; }
    return latestMembership(mid) ? { key: "expired", label: "Expired", cls: "r" } : { key: "none", label: "No plan", cls: "" };
  }
  const versionsOf = eid => where("TrainingPlan", v => v.pt_enrollment_id === +eid).sort((a, b) => a.version_number - b.version_number);
  const currentVersion = eid => versionsOf(eid).find(v => v.is_current) || versionsOf(eid).pop() || null;
  const sessionsOf = eid => where("Session", s => s.pt_enrollment_id === +eid).sort((a, b) => (a.session_date + a.time_slot).localeCompare(b.session_date + b.time_slot));
  const progressOf = mid => where("ProgressRecord", r => r.member_id === +mid).sort((a, b) => b.record_date.localeCompare(a.record_date) || (a.source === "trainer" ? -1 : 1));
  const insideNow = () => where("CheckIn", c => !c.check_out_time && (now() - parse(c.check_in_time.replace(" ", "T"))) < 3 * 36e5);
  const clientIdsOf = tid => [...new Set(where("PersonalTrainingEnrollment", e => e.trainer_id === +tid && (!e.end_date || e.end_date >= TODAY)).map(e => e.member_id))];
  const occurrencesOn = d => where("GroupClass", o => o.occurrence_date === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const attendanceOf = oid => where("ClassAttendance", a => a.occurrence_id === +oid);
  function regularsOf(classId) {
    const c = get("ClassSchedule", classId);
    const sameName = db.ClassSchedule.filter(x => x.class_name === c.class_name).map(x => x.class_id);
    const occ = db.GroupClass.filter(o => sameName.includes(o.class_id) && o.occurrence_date < TODAY && o.occurrence_date >= addDays(TODAY, -28)).map(o => o.occurrence_id);
    return [...new Set(db.ClassAttendance.filter(a => occ.includes(a.occurrence_id) && a.status === "Attended").map(a => a.member_id))];
  }
  const sessionTrainer = s => s.trainer_id || (get("PersonalTrainingEnrollment", s.pt_enrollment_id) || {}).trainer_id;
  const pendingChange = eid => db.TrainerChange.find(c => c.pt_enrollment_id === +eid && c.status === "Pending") || null;
  const PT_MINUTES = 60;
  const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  function trainerClashes(tid, date, time, ignore = () => false) {
    const t = toMin(time), out = [];
    db.Session.forEach(s => {
      if (s.session_date !== date || s.status === "Cancelled" || ignore(s) || sessionTrainer(s) !== +tid) return;
      if (Math.abs(toMin(s.time_slot) - t) < PT_MINUTES) {
        const e = get("PersonalTrainingEnrollment", s.pt_enrollment_id);
        out.push({ kind: "pt", time: s.time_slot, what: `PT with ${get("Member", e.member_id).name}${s.status === "Requested" ? " (requested)" : ""}`, session_id: s.session_id });
      }
    });
    db.GroupClass.forEach(o => {
      if (o.occurrence_date !== date) return;
      const c = get("ClassSchedule", o.class_id);
      if (c.trainer_id !== +tid) return;
      const a = toMin(o.start_time);
      if (t < a + c.duration_minutes && a < t + PT_MINUTES) out.push({ kind: "class", time: o.start_time, what: `${c.class_name} class (${c.duration_minutes} min)` });
    });
    return out;
  }
  const freeSlots = (tid, date, slots, ignore) => slots.filter(t => !trainerClashes(tid, date, t, ignore).length);
  function seriesDates(daysCsv, start, end) {
    const days = daysCsv.split(","), out = [];
    for (let d = start; d <= end; d = addDays(d, 1)) if (days.includes(DAY3[parse(d).getDay()])) out.push(d);
    return out;
  }

  const userOfMember = mid => db.User.find(u => u.member_id === +mid && u.is_active) || null;
  const userOfTrainer = tid => db.User.find(u => u.trainer_id === +tid && u.is_active) || null;
  function notify(user, title, body, link) {
    if (!user) return;
    const n = rawInsert(db, "Notification", { user_id: user.user_id, title, body, link: link || null, created_at: stamp(now()), read_at: null });
    if (MODE === "api") { created.push(["Notification", n]); record({ op: "insert", table: "Notification", row: clone(n) }); }
  }
  const myNotifications = () => session.user ? db.Notification.filter(n => n.user_id === session.user.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.notification_id - a.notification_id) : [];
  function markAllRead() {
    const t = stamp(now()), unread = myNotifications().filter(n => !n.read_at);
    if (!unread.length) return;
    if (MODE === "api") { try { tx(() => unread.forEach(n => update("Notification", n.notification_id, { read_at: t }))); } catch (e) {} return; }
    unread.forEach(n => { n.read_at = t; }); save();
  }
  function remove(table, id) {
    db[table] = db[table].filter(r => r[PK[table]] !== +id);
    record({ op: "delete", table, id: +id });
  }
  function post(url, body) {
    const r = api("POST", url, body || {});
    if (!(r.status === 200 && r.data && r.data.ok)) throw new Error(failMessage(r));
    return r.data;
  }
  function reload() {
    const r = api("GET", "api/session");
    if (r.status === 200 && r.data && r.data.ok) { loadSnapshot(r.data); login(); return true; }
    return false;
  }
  function logout() { if (MODE === "api") api("POST", "api/logout", {}); }

  const sessionsOn = d => where("Session", s => s.session_date === d && s.status !== "Requested" && s.status !== "Cancelled").sort((a, b) => a.time_slot.localeCompare(b.time_slot));
  function canSeeMember(mid) {
    if (session.role === "member") return +mid === myMemberId();
    if (session.role === "trainer") return clientIdsOf(myTrainerId()).includes(+mid);
    return can("member.view");
  }
  const revenueIn = (from, to) => sum(validPayments(p => p.payment_date >= from && p.payment_date <= to), p => p.amount);
  const owedTotal = () => sum(db.Member, m => memberOwed(m.member_id));
  const monthStart = (offset = 0) => { const d = now(); d.setDate(1); d.setMonth(d.getMonth() + offset); return iso(d); };

  window.Store = {
    TODAY, iso, parse, addDays, addMonthsEnd, daysBetween, dowOf, DOW, stamp, now,
    all, get, where, insert, update, tx, audit, save, sum, reset() { if (MODE === "api") throw new Error("Not available on the live system."); try { localStorage.removeItem(KEY); } catch (e) {} db = seed(); save(); },
    get mode() { return MODE; }, get loggedIn() { return MODE !== "api" || !!apiUser; }, get mustChangePassword() { return !!(apiUser && apiUser.must_change_password); },
    get lastNotices() { return lastNotices; }, post, reload, logout,
    session, login, can, myTrainerId, myMemberId, ROLE_LABEL, PERMS, canSeeMember,
    planOf, membershipOwed, ptOwed, memberOwed, membershipsOf, enrollmentsOf, currentMembership, latestMembership, activePT, memberStatus,
    versionsOf, currentVersion, sessionsOf, progressOf, insideNow, clientIdsOf, occurrencesOn, attendanceOf, regularsOf, sessionsOn,
    revenueIn, owedTotal, monthStart, sessionTrainer, pendingChange,
    DAY3, PT_MINUTES, toMin, trainerClashes, freeSlots, seriesDates, userOfMember, userOfTrainer, notify, myNotifications, markAllRead, remove
  };
})();
