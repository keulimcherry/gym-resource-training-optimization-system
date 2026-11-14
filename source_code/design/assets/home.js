const dlg = document.getElementById("login");
const DEMO_PASSWORD = "moksha123";
const DEMO_ACCOUNTS = {
  "owner": "owner", "accounts": "accountant", "frontdesk": "front_desk",
  "coach.rohan": "trainer", "coach.mira": "trainer", "coach.suman": "trainer", "coach.asha": "trainer", "coach.bijay": "trainer",
  "aarav.shrestha": "member", "prakriti.karki": "member", "bikash.rai": "member", "rojina.magar": "member", "sujan.thapa": "member",
  "anjali.gurung": "member", "nabin.lama": "member", "kiran.joshi": "member", "srijana.adhikari": "member", "manish.kc": "member"
};
const roleCopy = {
  member:  { sub: "Members: see your plan, dues and progress.",          ph: "e.g. aarav.shrestha", foot: true,
             area: "Member area",  blurb: "Check your plan, track your progress and book sessions with your trainer, all in one place." },
  trainer: { sub: "Trainers: your clients, sessions and progress logs.", ph: "e.g. coach.rohan",    foot: false,
             area: "Trainer area", blurb: "Your clients, today's sessions and progress logs, scoped to the people you coach." },
  staff:   { sub: "Team: what you see depends on your role.",            ph: "e.g. frontdesk, accounts or owner", foot: false,
             area: "Staff area",   blurb: "Front desk, accounts and management. Each account only opens the tools its role is allowed to use." }
};
let role = "member", lastFocus = null;
function setRole(r) {
  role = r;
  dlg.querySelectorAll(".roles button").forEach(b => b.setAttribute("aria-checked", b.dataset.role === r));
  document.getElementById("loginSub").textContent = roleCopy[r].sub;
  document.getElementById("l-user").placeholder = roleCopy[r].ph;
  document.getElementById("loginFoot").style.display = roleCopy[r].foot ? "" : "none";
  document.getElementById("loginArea").textContent = roleCopy[r].area;
  document.getElementById("loginBlurb").textContent = roleCopy[r].blurb;
}
function openLogin(r) {
  lastFocus = document.activeElement;
  nav.classList.remove("open");
  setRole(r || role);
  document.getElementById("loginLive").textContent = live.active;
  dlg.showModal();
  document.getElementById("l-user").focus();
}
function closeLogin() { dlg.close(); }
dlg.addEventListener("close", () => { if (location.hash === "#login") history.replaceState(null, "", location.pathname); lastFocus && lastFocus.focus(); });
document.querySelectorAll("[data-login]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); openLogin(a.dataset.login || undefined); }));
document.getElementById("loginClose").addEventListener("click", closeLogin);
dlg.addEventListener("click", e => { if (e.target === dlg) closeLogin(); });
dlg.querySelectorAll(".roles button").forEach(b => b.addEventListener("click", () => setRole(b.dataset.role)));
dlg.querySelector(".roles").addEventListener("keydown", e => {
  const order = ["member", "trainer", "staff"], i = order.indexOf(role);
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const next = order[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3];
    setRole(next); dlg.querySelector(`[data-role="${next}"]`).focus();
  }
});
document.getElementById("toJoin").addEventListener("click", closeLogin);
document.getElementById("pwToggle").addEventListener("click", e => {
  const p = document.getElementById("l-pass"), show = p.type === "password";
  p.type = show ? "text" : "password";
  e.currentTarget.textContent = show ? "Hide" : "Show";
  e.currentTarget.setAttribute("aria-pressed", show);
  e.currentTarget.setAttribute("aria-label", show ? "Hide password" : "Show password");
});
document.getElementById("forgot").addEventListener("click", e => {
  e.preventDefault();
  showError("Password resets are done at the front desk for now. Ask staff to send you a reset link.");
});
function showError(msg) { const el = document.getElementById("loginError"); el.textContent = msg; el.classList.add("show"); }
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const u = document.getElementById("l-user"), p = document.getElementById("l-pass");
  document.getElementById("loginError").classList.remove("show");
  if (!u.value.trim()) { showError("Enter your username or email."); u.focus(); return; }
  if (!p.value) { showError("Enter your password."); p.focus(); return; }
  const btn = document.getElementById("loginBtn");
  const resetBtn = () => { btn.classList.remove("loading"); btn.querySelector(".lbl").textContent = "Log in"; };
  btn.classList.add("loading"); btn.querySelector(".lbl").textContent = "Logging in…";
  const creds = { username: u.value.trim(), password: p.value, area: role };
  p.value = "";
  fetch("api/login", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(creds), credentials: "same-origin" })
    .then(r => r.json().then(d => ({ status: r.status, d }), () => ({ status: r.status, d: null })))
    .then(({ status, d }) => {
      if (d && typeof d.ok === "boolean") {
        if (d.ok) { location.href = "dashboard.html#/"; return; }
        resetBtn(); showError(d.error || "Couldn't log you in."); u.focus(); return;
      }
      demoLogin(creds);
    })
    .catch(() => demoLogin(creds));
});
function demoLogin(creds) {
  const btn = document.getElementById("loginBtn"), u = document.getElementById("l-user");
  const resetBtn = () => { btn.classList.remove("loading"); btn.querySelector(".lbl").textContent = "Log in"; };
  const name = creds.username.toLowerCase();
  const acct = DEMO_ACCOUNTS[name];
  const ok = acct && creds.password === DEMO_PASSWORD;
  if (!ok) { resetBtn(); showError("Incorrect username or password."); u.focus(); return; }
  const tab = acct === "member" ? "member" : acct === "trainer" ? "trainer" : "staff";
  if (tab !== role) {
    resetBtn();
    showError(`That is a ${tab === "staff" ? "staff" : tab} account. Choose "${tab[0].toUpperCase() + tab.slice(1)}" above.`); return;
  }
  try { sessionStorage.setItem("moksha.role", acct); sessionStorage.setItem("moksha.user", name); } catch (err) {}
  setTimeout(() => { location.href = "dashboard.html#/"; }, 600);
}
if (location.hash === "#login") window.addEventListener("load", () => openLogin());

const nav = document.getElementById("nav"), menuBtn = document.getElementById("menuBtn");
menuBtn.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
});
nav.querySelectorAll(".nav-links a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: .12 });
document.querySelectorAll(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + "ms"; io.observe(el); });

const reviews = [
  ["Lost 9 kg in four months. The trainers actually check my progress every month, and I can see it on my phone.", "Aarav S.", "Quarterly member"],
  ["Best equipped gym in Lazimpat. Never waited for a squat rack, even in the evening.", "Prakriti K.", "Annual member"],
  ["My coach rewrote my plan when my knee acted up. That's when I knew this place was different.", "Bikash R.", "Personal training"],
  ["Saturday Strength Club is the highlight of my week. Great people, great energy.", "Rojina M.", "Quarterly member"],
  ["Clean, modern and the front desk knows everyone by name. Feels like a community.", "Sujan T.", "Monthly member"],
  ["I was nervous to start lifting. The coaches made it easy and safe.", "Anjali G.", "Annual member"]
];
const card = ([q, n, t]) => `<div class="review"><div class="stars">★★★★★</div><p>“${q}”</p><b>${n}</b><small>${t}</small></div>`;
const half = (a) => (a.map(card).join("")).repeat(2);
document.getElementById("colA").innerHTML = half(reviews.slice(0, 3));
document.getElementById("colB").innerHTML = half(reviews.slice(3));

const live = { active: 20, equip: 48, pt: 3 };
const CAPACITY = 60;
function setNum(id, v) {
  const el = document.getElementById(id);
  if (el.textContent != v) { el.textContent = v; el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 300); }
}
function renderLive() {
  setNum("sActive", live.active); setNum("sEquip", live.equip); setNum("sPT", live.pt);
  document.getElementById("heroLive").textContent = live.active;
  const pct = Math.min(live.active / CAPACITY, 1);
  document.getElementById("busyBar").style.width = Math.max(pct * 100, 6) + "%";
  document.getElementById("busyLabel").textContent = pct < .3 ? "Quiet" : pct < .65 ? "Moderate" : "Busy";
}
let secs = 0, realLive = false;
function pollLive() {
  fetch("api/public/live", { headers: { Accept: "application/json" } }).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.ok) return;
    realLive = true;
    live.active = d.active; live.equip = d.equip; live.pt = d.pt; secs = 0; renderLive();
  }).catch(() => {});
}
pollLive();
setInterval(() => {
  secs += 5;
  if (realLive && secs % 30 === 0) pollLive();
  if (!realLive && secs % 15 === 0) {
    live.active = Math.max(5, Math.min(55, live.active + Math.round(Math.random() * 4 - 2)));
    live.pt = Math.max(0, Math.min(6, live.pt + (Math.random() < .2 ? (Math.random() < .5 ? -1 : 1) : 0)));
    renderLive(); secs = 0;
  }
  document.getElementById("updated").textContent = secs === 0 ? "Updated just now" : `Updated ${secs}s ago`;
}, 5000);
renderLive();

document.getElementById("leadForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target;
  const name = document.getElementById("f-name"), phone = document.getElementById("f-phone");
  if (!name.value.trim() || !phone.value.trim()) {
    (name.value.trim() ? phone : name).focus(); return;
  }
  const done = () => {
  const ok = document.createElement("div");
  ok.className = "form-ok"; ok.style.display = "block";
  const b = document.createElement("b");
  b.textContent = "Thanks, " + name.value.trim().split(" ")[0] + "!";
  ok.append(b, "The Moksha team will call you within a day.");
  f.replaceChildren(ok);
  };
  const lead = { name: name.value.trim(), contact: phone.value.trim(), interest: document.getElementById("f-int").value, message: document.getElementById("f-msg").value.trim() };
  fetch("api/public/lead", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(lead) })
    .then(r => r.json()).then(d => { if (d && d.ok === false && d.error && !/already/.test(d.error)) { alert(d.error); return; } done(); })
    .catch(done);
});
