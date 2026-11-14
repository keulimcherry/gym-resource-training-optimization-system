(function () {
  "use strict";
  const S = window.Store;

  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rs = n => "Rs. " + Math.round(n).toLocaleString("en-IN");
  const rsK = n => "<small>Rs.</small>" + Math.round(n).toLocaleString("en-IN");
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fdate = s => { if (!s) return "—"; const d = S.parse(s.slice(0, 10)); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  const fshort = s => { const d = S.parse(s.slice(0, 10)); return `${d.getDate()} ${MON[d.getMonth()]}`; };
  const ftime = t => { if (!t) return ""; const [h, m] = t.slice(0, 5).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  function rel(s) {
    const d = new Date(s.replace(" ", "T")), mins = Math.round((S.now() - d) / 6e4);
    if (mins < 1) return "just now"; if (mins < 60) return `${mins} min ago`;
    const h = Math.round(mins / 60); if (h < 24) return `${h} hr ago`;
    const days = Math.round(h / 24); return days === 1 ? "yesterday" : days < 7 ? `${days} days ago` : fdate(s);
  }
  function dayLabel(s) {
    const n = S.daysBetween(S.TODAY, s);
    if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday";
    if (n > 1 && n < 7) return S.dowOf(s).slice(0, 3);
    return fshort(s);
  }
  const initials = n => String(n).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const ICONS = {
    grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
    users: '<circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6"/>',
    money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    dumbbell: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    mega: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    clip: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 12h6M9 16h4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    door: '<path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M14 12h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  const ico = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  function toast(msg, err) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.toggle("err", !!err); t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }

  function fieldHtml(f, prefix) {
    const id = `${prefix}-${f.name}`;
    const req = f.required ? " required" : "";
    const common = `id="${id}" name="${esc(f.name)}"${req}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${f.maxlength ? ` maxlength="${f.maxlength}"` : ""}`;
    const label = `<label for="${id}">${esc(f.label)}${f.required ? "" : ' <span class="muted" style="font-weight:500;letter-spacing:0;text-transform:none">(optional)</span>'}</label>`;
    const hint = f.hint ? `<div class="hint" id="${id}-hint">${f.hint}</div>` : "";
    const cls = `field${f.full || f.type === "textarea" ? " full" : ""}`;
    if (f.type === "html") return `<div class="${f.full === false ? "field" : "field full"}">${f.html}</div>`;
    if (f.type === "checkbox") return `<div class="${cls}"><label class="check"><input type="checkbox" ${common}${f.value ? " checked" : ""}> ${esc(f.label)}</label>${hint}</div>`;
    if (f.type === "select") return `<div class="${cls}">${label}<div class="sel"><select ${common}>${(f.options || []).map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(f.value ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>${hint}</div>`;
    if (f.type === "textarea") return `<div class="${cls}">${label}<textarea ${common}>${esc(f.value ?? "")}</textarea>${hint}</div>`;
    const attrs = ["min", "max", "step"].filter(k => f[k] != null).map(k => ` ${k}="${f[k]}"`).join("");
    const type = f.type === "readonly" ? "text" : f.type || "text";
    return `<div class="${cls}">${label}<input type="${type}" ${common}${attrs} value="${esc(f.value ?? "")}"${f.type === "readonly" ? " readonly" : ""}${type === "number" ? ' inputmode="decimal"' : ""}>${hint}</div>`;
  }
  const NO_MED = "No known medical conditions";
  const medField = value => ({ name: "medical_history", label: "Medical history / injuries", type: "textarea", required: true, value: value || "",
    placeholder: "e.g. Old knee injury, avoid deep squats. Asthma, carries an inhaler. Allergies or medicines.",
    hint: `Please be honest: it helps your coach keep you safe, and only staff with permission can see it. Fit and healthy? Write that, or tap <button type="button" class="link-btn" data-fill="${NO_MED}">${NO_MED}</button>.` });
  const fieldsHtml = (fields, prefix) => `<div class="f-grid">${fields.map(f => fieldHtml(f, prefix)).join("")}</div>`;

  let modalSeq = 0;
  function modal({ title, sub, body, submit = "Save", danger, size, onSubmit, onOpen, foot = "", cancel = "Cancel" }) {
    const prefix = "m" + (++modalSeq);
    const dlg = document.createElement("dialog");
    dlg.className = "modal" + (size ? " " + size : "");
    dlg.setAttribute("aria-labelledby", prefix + "-t");
    dlg.innerHTML = `<form method="dialog" novalidate style="display:contents">
      <div class="m-head"><div><h2 id="${prefix}-t">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ""}</div><button type="button" class="m-close" aria-label="Close">×</button></div>
      <div class="m-body"><div class="m-err" role="alert"></div>${typeof body === "function" ? body(prefix) : body}</div>
      <div class="m-foot"><div>${foot}</div><div class="btns">${cancel ? `<button type="button" class="btn btn-ghost" data-close>${esc(cancel)}</button>` : ""}${onSubmit ? `<button type="submit" class="btn ${danger ? "btn-danger" : "btn-ink"}">${esc(submit)}</button>` : ""}</div></div>
    </form>`;
    document.body.appendChild(dlg);
    const close = () => { dlg.close(); };
    dlg.addEventListener("close", () => dlg.remove());
    dlg.querySelector(".m-close").onclick = close;
    dlg.querySelectorAll("[data-close]").forEach(b => b.onclick = close);
    dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
    dlg.addEventListener("click", e => {
      const b = e.target.closest("[data-fill]"); if (!b) return;
      const t = b.closest(".field").querySelector("textarea, input"); t.value = b.dataset.fill; t.closest(".field").classList.remove("bad"); t.focus();
    });
    const err = dlg.querySelector(".m-err");
    dlg.showErr = msg => { err.textContent = msg; err.classList.add("show"); err.scrollIntoView({ block: "nearest" }); };
    dlg.values = () => {
      const out = {};
      dlg.querySelectorAll("input[name], select[name], textarea[name]").forEach(el => {
        out[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
      });
      return out;
    };
    dlg.pfx = prefix;
    dlg.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      err.classList.remove("show");
      dlg.querySelectorAll(".field.bad").forEach(f => f.classList.remove("bad"));
      const missing = [...dlg.querySelectorAll("[required]")].filter(el => !el.closest(".off") && !el.closest("[hidden]") && !el.value.trim());
      if (missing.length) { missing.forEach(el => el.closest(".field").classList.add("bad")); dlg.showErr("Please fill in the highlighted fields."); missing[0].focus(); return; }
      try { if (onSubmit(dlg.values(), dlg) !== false) close(); }
      catch (ex) { dlg.showErr(ex.message); }
    });
    dlg.showModal();
    if (onOpen) onOpen(dlg);
    const first = dlg.querySelector(".m-body input:not([readonly]), .m-body select, .m-body textarea");
    if (first) first.focus();
    return dlg;
  }
  function form({ title, sub, fields, submit, onSubmit, size, onOpen, danger, foot }) {
    return modal({ title, sub, size, submit, danger, foot, body: p => fieldsHtml(fields, p), onSubmit, onOpen });
  }
  function confirm({ title, sub, submit = "Confirm", danger, reasonLabel, onConfirm }) {
    return form({ title, sub, submit, danger, size: "narrow",
      fields: reasonLabel ? [{ name: "reason", label: reasonLabel, type: "textarea", required: true, placeholder: "This is saved in the audit log" }] : [{ name: "_", type: "html", html: "" }],
      onSubmit: v => onConfirm(v.reason) });
  }
  const num = (v, label, { min = 0, allowEmpty } = {}) => {
    if (v === "" || v == null) { if (allowEmpty) return null; throw new Error(`${label} is required.`); }
    const n = Number(String(v).replace(/,/g, ""));
    if (!isFinite(n)) throw new Error(`${label} must be a number.`);
    if (n < min) throw new Error(`${label} can't be less than ${min}.`);
    return n;
  };

  function table({ cols, rows, href, empty = "Nothing here yet.", rowCls }) {
    if (!rows.length) return `<div class="empty"><b>${esc(empty)}</b></div>`;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.cls || ""}">${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${
      rows.map(r => `<tr class="${href ? "click" : ""} ${rowCls ? rowCls(r) : ""}"${href ? ` data-href="${esc(href(r))}" tabindex="0"` : ""}>${cols.map(c => `<td class="${c.cls || ""}">${c.html(r)}</td>`).join("")}</tr>`).join("")
    }</tbody></table></div>`;
  }
  const who = (name, small) => `<div class="cell-who"><div class="pic">${esc(initials(name))}</div><div><b>${esc(name)}</b>${small ? `<small>${small}</small>` : ""}</div></div>`;

  function bars(data, { fmt = v => v, hiLast = true, labels } = {}) {
    const max = Math.max(1, ...data.map(d => d.value));
    return `<div class="bars${labels ? " labels" : ""}">${data.map((d, i) =>
      `<div class="bar${(hiLast && i === data.length - 1) || d.hi ? " hi" : ""}"><i data-v="${esc(fmt(d.value))}" data-h="${(d.value / max * 86).toFixed(1)}" style="height:0" title="${esc(d.label)}: ${esc(fmt(d.value))}"></i><span>${esc(d.label)}</span></div>`).join("")}</div>`;
  }
  function hbars(data, { fmt = v => v } = {}) {
    const max = Math.max(1, ...data.map(d => d.value));
    return `<div class="hbars">${data.map(d => `<div class="hbar"><span>${esc(d.label)}</span><div class="track"><i data-w="${(d.value / max * 100).toFixed(1)}" style="width:0"></i></div><b>${esc(fmt(d.value))}</b></div>`).join("")}</div>`;
  }
  const PALETTE = ["var(--inv)", "#f5e11d", "#2d5bd7", "#9ba1bb", "#138a4b"];
  function donut(data, { center = "", centerLabel = "" } = {}) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let acc = 0;
    const stops = data.map((d, i) => { const a = acc; acc += d.value / total * 100; return `${PALETTE[i % 5]} ${a}% ${acc}%`; }).join(",");
    return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})" role="img" aria-label="${esc(data.map(d => d.label + " " + d.value).join(", "))}"><span><div><b>${esc(center)}</b>${esc(centerLabel)}</div></span></div>
      <div class="legend">${data.map((d, i) => `<div><i style="background:${PALETTE[i % 5]};${i === 0 ? "" : ""}${PALETTE[i % 5] === "#f5e11d" ? "box-shadow:inset 0 0 0 1.5px var(--fg)" : ""}"></i>${esc(d.label)}<b>${esc(d.value)}</b></div>`).join("")}</div></div>`;
  }
  function lineChart(points, { markers = [], unit = "", height = 240 } = {}) {
    if (points.length < 2) return `<div class="empty"><b>Not enough data yet</b>A chart appears after two entries with a weight.</div>`;
    const W = 680, H = height, P = { l: 44, r: 18, t: 26, b: 34 };
    const t0 = S.parse(points[0].date).getTime(), t1 = S.parse(points[points.length - 1].date).getTime();
    const vals = points.map(p => p.value), min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1);
    const x = d => P.l + ((S.parse(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
    const y = v => P.t + (max - v) / Math.max(1, max - min) * (H - P.t - P.b);
    const trainerPts = points.filter(p => p.kind === "trainer");
    const linePts = (trainerPts.length >= 2 ? trainerPts : points).map(p => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const grid = [min, (min + max) / 2, max].map(v => `<line class="lc-grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="lc-text" x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12">${v.toFixed(0)}</text>`).join("");
    const mk = markers.filter(m => S.parse(m.date).getTime() >= t0 && S.parse(m.date).getTime() <= t1).map(m =>
      `<line x1="${x(m.date)}" x2="${x(m.date)}" y1="${P.t - 8}" y2="${H - P.b}" stroke="#2d5bd7" stroke-dasharray="4 4" stroke-width="1.5"/><rect x="${x(m.date) - 16}" y="${P.t - 22}" width="32" height="18" rx="5" fill="#2d5bd7"/><text x="${x(m.date)}" y="${P.t - 9}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${esc(m.label)}</text>`).join("");
    const nLabels = Math.min(6, points.length), step = (points.length - 1) / (nLabels - 1);
    const labels = Array.from({ length: nLabels }, (_, i) => points[Math.round(i * step)]).map(p => `<text class="lc-text" x="${x(p.date)}" y="${H - 10}" text-anchor="middle" font-size="12">${fshort(p.date)}</text>`).join("");
    const dots = points.map(p => p.kind === "member"
      ? `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="5.5" class="lc-mdot" stroke-width="2"><title>${esc(fdate(p.date))} · ${p.value}${unit} (member journal)</title></circle>`
      : `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="5" class="lc-dot"><title>${esc(fdate(p.date))} · ${p.value}${unit} (trainer log)</title></circle>`).join("");
    const firstX = x((trainerPts.length >= 2 ? trainerPts : points)[0].date), lastX = x((trainerPts.length >= 2 ? trainerPts : points).slice(-1)[0].date);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight from ${vals[0]}${unit} to ${vals[vals.length - 1]}${unit}">
      ${grid}${mk}<polygon points="${firstX},${H - P.b} ${linePts} ${lastX},${H - P.b}" class="lc-area"/>
      <polyline class="lc-line" points="${linePts}" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}</svg>`;
  }
  function animateCharts(root) {
    requestAnimationFrame(() => setTimeout(() => {
      root.querySelectorAll(".bar i[data-h]").forEach(el => el.style.height = el.dataset.h + "%");
      root.querySelectorAll(".hbar i[data-w]").forEach(el => el.style.width = el.dataset.w + "%");
    }, 40));
  }

  window.UI = { medField, NO_MED, esc, rs, rsK, fdate, fshort, ftime, rel, dayLabel, initials, plural, ico, toast, modal, form, confirm, fieldsHtml, fieldHtml, num, table, who, bars, hbars, donut, lineChart, animateCharts };
})();
