  // ===================================================================
  // Hourly week: the 7 days top to bottom, hours left to right, each shift a pill (overlaps stack); signs, holidays,
  // events and time off by the day's name; numbered notes. Printed and saved like every other printout (the border
  // too). Its own names live inside HW; its classes are hw- (shiftcraft.css).
  // ===================================================================
  const HW = (() => {
  let wk = 0;
  const O = { paper: 'letter', orient: 'landscape', format: 'pdf', dpi: 300, page: 'color', name: 'first', time: true, col: 'role', shape: 'pill', lanes: 'pack', grid: 1, shut: true, cov: false, off: true,
    past: false, now: false, signs: true, hol: true, ev: true, at: true, notes: 'auto', legend: true };
  try { Object.assign(O, JSON.parse(localStorage.getItem(KEY + '-hourly') || '{}')); } catch (e) { /* none */ }
  const saveO = () => { try { localStorage.setItem(KEY + '-hourly', JSON.stringify(O)); } catch (e) { /* blocked */ } };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (s) => { const d = parse(s), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (s) => { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const dshort = (s) => `${DAYS[(parse(s).getDay() + 6) % 7].slice(0, 3)} ${short(s)}`;
const clock = (m) => { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'a' : 'p', h12 = h % 12 || 12; return mm ? `${h12}:${pad(mm)}${ap}` : `${h12}${ap}`; };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls.split(' ').filter(Boolean).map((c) => 'hw-' + c).join(' '); if (txt != null) e.textContent = txt; return e; };
const SUP = (n) => { const s = el('sup', 'n', String(n)); return s; };
function hoursOn(d) {
  const sp = (plan.specialHours || []).filter((x) => x.from <= d && d <= x.to).slice(-1)[0];
  if (sp) return sp.closed ? { closed: true, name: sp.name, sp } : { open: sp.open, close: sp.close, name: sp.name, sp };
  const H = plan.hours || {}, i = (parse(d).getDay() + 6) % 7;
  if (Array.isArray(H.days) && H.days[i]) return H.days[i];
  return (i >= 5 ? H.we : H.wk) || null;
}
const shut = (d) => { const h = hoursOn(d); return !!(h && h.closed); };

// ---------- events, as ShiftCraft keeps them: a repeating one is one day each time ----------
const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const monthStep = (d, n, last) => { const [y, m, dd] = d.split('-').map(Number), dim = new Date(y, m + n, 0).getDate(); return iso(new Date(y, m - 1 + n, last ? dim : Math.min(dd, dim))); };
function repeatStarts(x, a, b) {
  const r = x.repeat, n = Math.max(1, r.every | 0), out = [];
  if (r.unit === 'week' && Array.isArray(r.days) && r.days.length) {
    const w0 = mondayOf(x.from), days = [...new Set(r.days)].sort();
    for (let k = Math.max(0, Math.floor(dayDiff(w0, a) / (7 * n)) - 1), i = 0; i < 3000; i++, k++) {
      const ws = addDays(w0, k * n * 7); if (ws > b || (r.until && ws > r.until)) break;
      for (const d of days) { const s = addDays(ws, d); if (s < x.from || s > b || s < a || (r.until && s > r.until)) continue; if (!(x.skip || []).includes(s)) out.push(s); }
    }
    return out;
  }
  const at = (k) => (r.unit === 'day' ? addDays(x.from, k * n) : r.unit === 'week' ? addDays(x.from, k * n * 7) : r.unit === 'year' ? monthStep(x.from, k * n * 12) : monthStep(x.from, k * n, r.unit === 'mlast'));
  const most = { day: 1, week: 7, year: 366 }[r.unit] || 31;
  for (let k = Math.max(0, Math.floor(dayDiff(x.from, a) / (most * n)) - 2), i = 0; i < 3000; i++, k++) {
    const s = at(k); if (s > b || (r.until && s > r.until)) break;
    if (s >= a && !(x.skip || []).includes(s)) out.push(s);
  }
  return out;
}
const MARKS = [
  ['period', 'End of period', /\bend of (the )?(pay ?)?(period|month)\b|\beop\b/i, ''],
  ['payday', 'Payday', /\bpay ?day\b|\bpayroll\b/i, '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9h.01M18 15h.01"/>'],
  ['produce', 'Produce', /\bproduce\b|\bveg(gie|etable)s?\b|\bfarmers?\b/i, '<path d="M12 8.2c4.2 0 7.5 2.6 7.5 6.3S16.2 21 12 21s-7.5-2.8-7.5-6.5S7.8 8.2 12 8.2z"/><path d="M12 8.2V4.5M12 8.2 8.6 6.4M12 8.2l3.4-1.8M12 8.2l-1.8 2.3M12 8.2l1.8 2.3"/>'],
  ['truck', 'Truck delivery', /\btruck\b|\bdelivery\b/i, '<path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8"/><circle cx="6" cy="17.5" r="1.9"/><circle cx="17" cy="17.5" r="1.9"/>'],
  ['inventory', 'Inventory', /\binventory\b/i, '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/>'],
  ['insurance', 'Insurance enrollment', /\binsurance\b|\benrol?lment\b|\bbenefits\b/i, '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 9v6M9 12h6"/>'],
  ['meeting', 'Meeting', /\bmeeting\b/i, '<circle cx="12" cy="4.6" r="2.1"/><path d="M8.6 11.5c0-2 1.5-3.6 3.4-3.6s3.4 1.6 3.4 3.6"/><path d="M5 11.5h14l-2 3H7z"/><path d="M9.5 14.5v6h5v-6M8 20.5h8"/>']];
const markOf = (x) => (x.mark === 'none' ? '' : x.mark && MARKS.some(([k]) => k === x.mark) ? x.mark : (MARKS.find(([, , re]) => re.test(x.title || '')) || [''])[0]);
const icon = (k, extra) => { const s = el('span', 'ic ' + k + (extra ? ' ' + extra : '')); const m = MARKS.find(([kk]) => kk === k); if (k === 'period') s.textContent = 'EOP'; else s.innerHTML = `<svg viewBox="0 0 24 24">${m ? m[3] : ''}</svg>`; return s; };
const nthDay = (y, m, dow, n) => { if (n > 0) { const d = new Date(y, m, 1); d.setDate(1 + ((dow - d.getDay() + 7) % 7) + (n - 1) * 7); return iso(d); } const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return iso(d); };
const easterOf = (y) => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3); const hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451); return iso(new Date(y, Math.floor((hh + l - 7 * m + 114) / 31) - 1, ((hh + l - 7 * m + 114) % 31) + 1)); };
const HOLIDAYS = [['New Year’s Day', (y) => `${y}-01-01`], ['Martin Luther King Jr. Day', (y) => nthDay(y, 0, 1, 3)], ['Presidents’ Day', (y) => nthDay(y, 1, 1, 3)], ['Easter Sunday', easterOf], ['Mother’s Day', (y) => nthDay(y, 4, 0, 2)], ['Memorial Day', (y) => nthDay(y, 4, 1, -1)], ['Father’s Day', (y) => nthDay(y, 5, 0, 3)],
  ['Valentine’s Day', (y) => `${y}-02-14`], ['St. Patrick’s Day', (y) => `${y}-03-17`], ['Juneteenth', (y) => `${y}-06-19`], ['Independence Day', (y) => `${y}-07-04`], ['Labor Day', (y) => nthDay(y, 8, 1, 1)], ['Columbus Day', (y) => nthDay(y, 9, 1, 2)], ['Halloween', (y) => `${y}-10-31`], ['Veterans Day', (y) => `${y}-11-11`],
  ['Thanksgiving', (y) => nthDay(y, 10, 4, 4)], ['Black Friday', (y) => addDays(nthDay(y, 10, 4, 4), 1)], ['Christmas Eve', (y) => `${y}-12-24`], ['Christmas Day', (y) => `${y}-12-25`], ['New Year’s Eve', (y) => `${y}-12-31`]];
const holKey = (s) => String(s || '').toLowerCase().replace(/[’']s?\b/g, '').replace(/\bday\b/g, '').replace(/[^a-z]/g, '');
const holLike = (a, b, loose) => { a = holKey(a); b = holKey(b); return !!a && !!b && (a === b || (!!loose && a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a)))); };
const builtinOn = (d) => HOLIDAYS.map(([name, fn]) => ({ name, date: fn(+d.slice(0, 4)), type: name === 'Black Friday' ? 'local' : 'national' })).filter((x) => x.date === d);
const holType = (x, d) => (x.holiday === true ? 'national' : x.holiday === 'national' || x.holiday === 'local' ? x.holiday : x.holiday === false ? '' : (builtinOn(d).find((b) => holLike(b.name, x.title)) || {}).type || '');
// the events on a day: a one-day sign on a closed day moves to the open day before (moved = the day it was)
function eventsOn(d) {
  const out = [];
  (plan.events || []).forEach((x) => {
    if (!x.repeat) { if (x.from <= d && d <= x.to) out.push({ x, d }); return; }
    const mv = markOf(x) !== 'period';
    repeatStarts(x, addDays(d, -7), addDays(d, 7)).forEach((s) => {
      let at = s, moved = '';
      if (mv && shut(s)) { at = addDays(s, -1); for (let i = 0; i < 7 && shut(at); i++) at = addDays(at, -1); moved = s; }
      if (at === d && !out.some((o) => o.x === x)) out.push({ x, d, moved });
    });
  });
  return out;
}
const ROLE_COL = { GM: ['#6b21a8', '#efe3fb'], AGM: ['#1d4ed8', '#e3ecff'], SM: ['#0f766e', '#d8f3ee'], TM: ['#7c5a10', '#fbf0d6'], NH: ['#9d174d', '#fde3ee'] };
const PERSON_COLS = [['#1e40af', '#dde7ff'], ['#047857', '#d6f5e8'], ['#b45309', '#fdebd3'], ['#7e22ce', '#efe1fd'], ['#be123c', '#fde1e7'], ['#0e7490', '#d7f3f9'], ['#4d7c0f', '#e8f5d3'], ['#a16207', '#fbf1cf'], ['#475569', '#e7ebf1']];
function nameOf(p, how, all) {
  const parts = (p.name || '?').trim().split(/\s+/), first = parts[0], last = parts.length > 1 ? parts[parts.length - 1] : '';
  if (how === 'full') return last ? `${first} ${last}` : first;
  if (how === 'firstl') return last ? `${first} ${last[0]}.` : first;
  if (how === 'lastfirst') return last ? `${last}, ${first}` : first;
  if (how === 'lastf') return last ? `${last} ${first[0]}.` : first;
  if (how === 'init') return (first[0] + (last ? last[0] : '')).toUpperCase();
  if (how === 'none') return '';
  // first name, with the last initial only when two people share a first name
  const same = all.filter((q) => q !== p && (q.name || '').split(/\s+/)[0] === first);
  return same.length && last ? `${first} ${last[0]}.` : first;
}
function weeksList() { const first = mondayOf(plan.startDate || iso(new Date())), n = Math.max(1, plan.weeks || 1); return Array.from({ length: n }, (_, i) => addDays(first, i * 7)); }
// ---------- the heading on every page ----------
const yr = (s) => parse(s).getFullYear();
function headEl(w0, what) {
  const e = addDays(w0, 6), now = new Date();
  const range = yr(w0) === yr(e) ? `${short(w0)} – ${short(e)}, ${yr(e)}` : `${short(w0)}, ${yr(w0)} – ${short(e)}, ${yr(e)}`;
  const version = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}.${pad(now.getMinutes())}`;
  const printed = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const hd = el('div', 'head'), l = el('div', 'l'), r = el('div', 'r');
  l.append(el('h1', null, [plan.company, plan.location].filter(Boolean).join(' – ') || 'Schedule'), el('div', 'what', what));
  const st = el('div', 'stamp'); st.append(`Printed ${printed} · Version ${version}`, el('span', 'pgno'));
  r.append(el('div', 'wk', range), st); hd.append(l, r); return hd;
}
// ---------- the week: one sheet (and its numbered notes) ----------
function buildWeek() {
  const w0 = weeksList()[wk], days = Array.from({ length: 7 }, (_, i) => addDays(w0, i)), today = iso(new Date());
  const staff = plan.staff || [], byId = Object.fromEntries(staff.map((p) => [p.id, p]));
  const notes = [], num = (key, when, text) => { let n = notes.find((x) => x.key === key); if (!n) notes.push((n = { key, n: notes.length + 1, when, text })); return n.n; };
  let a = 1440, b = 0;
  days.forEach((d) => { const h = hoursOn(d); if (h && !h.closed && h.open != null) { a = Math.min(a, h.open); b = Math.max(b, h.close); } if (!shut(d)) (plan.shifts[d] || []).forEach((s) => { a = Math.min(a, s.start); b = Math.max(b, s.end); }); });
  if (a >= b) { a = 360; b = 1320; }
  a = Math.floor(a / 60) * 60; b = Math.ceil(b / 60) * 60;
  const X = (m) => ((m - a) / (b - a)) * 100 + '%', W = (m1, m2) => ((m2 - m1) / (b - a)) * 100 + '%';
  const sheet = el('div', 'sheet' + (O.col === 'mono' ? ' mono' : O.col === 'bw' ? ' bw' : '') + (O.page === 'gray' ? ' gray' : ''));
  sheet.append(headEl(w0, 'Hourly schedule'));
  const grid = el('div', 'grid'), hl = el('div', 'hours'), step = Math.max(1, O.grid || 1);
  grid.append(el('div'), hl);
  for (let m = a; m <= b; m += 60 * step) { const s = el('span', null, clock(m)); s.style.left = X(m); if (m === a) s.style.transform = 'none'; if (m === b) s.style.transform = 'translateX(-100%)'; hl.append(s); }
  const usedRoles = new Set(), usedSigns = new Set(); let anyMoved = false;
  days.forEach((d, di) => {
    const h = hoursOn(d), left = h && h.closed ? (plan.shifts[d] || []).length : 0;
    const list = left ? [] : (plan.shifts[d] || []).slice().sort((p, q) => p.start - q.start || q.end - p.end);
    const evs = eventsOn(d), hols = [], signs = [], others = [], timed = [];
    evs.forEach((o) => {
      const t = holType(o.x, d), k = markOf(o.x);
      if (t) { if (O.hol) hols.push({ name: o.x.title, type: t, o }); }
      else if (k) { if (O.signs) { signs.push({ k, o }); if (o.x.hours && O.at) timed.push({ k, o }); } }
      else if (O.ev) { others.push(o); if (o.x.hours && O.at) timed.push({ o }); }
    });
    if (O.hol) builtinOn(d).forEach((bh) => { if (!evs.some((o) => holLike(bh.name, o.x.title)) && !(h && h.name && holLike(bh.name, h.name, true))) hols.push({ name: bh.name, type: bh.type }); });
    const spHol = O.hol && h && h.name && builtinOn(d).some((bh) => holLike(bh.name, h.name, true));
    if (spHol) hols.unshift({ name: h.name, type: 'national', sp: true });
    const lanes = [];
    list.forEach((s) => {
      let li;
      if (O.lanes === 'person') { li = lanes.findIndex((l) => l[0] && l[0].staffId === s.staffId); if (li < 0) li = lanes.length; }
      else { li = lanes.findIndex((l) => l.every((x) => x.end <= s.start || x.start >= s.end)); if (li < 0) li = lanes.length; }
      (lanes[li] = lanes[li] || []).push(s); s.__l = li;
    });
    const PH = 19, GAP = 3, TOP = timed.length ? 16 : 5, covH = O.cov ? 13 : 0, rowH = Math.max(34, TOP + lanes.length * (PH + GAP) + 2 + covH);
    const isPast = O.past && d < today;
    const lab = el('div', 'lab' + (isPast ? ' past' : ''));
    lab.append(el('div', 'dn', DAYS[di].slice(0, 3)), el('div', 'dd', short(d)));
    if (signs.length) { const sg = el('div', 'signs'); signs.forEach(({ k, o }) => { usedSigns.add(k); if (o.moved) anyMoved = true; const i = icon(k, o.moved ? 'moved' : ''); i.title = `${o.x.title}${o.moved ? ` (moved here: ${dshort(o.moved)} the store is closed)` : ''}`; sg.append(i); if (o.x.note) sg.append(SUP(num('ev' + o.x.title + d, dshort(d), `${o.x.title}: ${o.x.note}`))); }); lab.append(sg); }
    hols.forEach((x) => { const t = el('div', 'hol' + (x.type === 'local' ? ' local' : ''), x.name); t.title = x.name; const wr = el('div'); wr.append(t); const nt = x.sp ? h.sp && h.sp.note : x.o && x.o.x.note; if (nt) wr.append(SUP(num('hol' + x.name + d, dshort(d), `${x.name}: ${nt}`))); lab.append(wr); });
    if (h && h.name && !spHol) { const xx = el('div', 'x', h.name); if (h.sp && h.sp.note) xx.append(SUP(num('sp' + d, dshort(d), `${h.name}: ${h.sp.note}`))); lab.append(xx); }
    others.forEach((o) => { const e = el('div', 'ev', `${o.x.hours ? clock(o.x.hours[0]) + ' ' : ''}${o.x.title}`); if (o.x.note) e.append(SUP(num('ev' + o.x.title + d, `${dshort(d)}${o.x.hours ? ', ' + clock(o.x.hours[0]) + '–' + clock(o.x.hours[1]) : ''}`, `${o.x.title}: ${o.x.note}`))); lab.append(e); });
    if (O.off) { const off = staff.map((p) => [p, (p.timeOff || []).find((t) => t.status !== 'denied' && t.from <= d && d <= t.to)]).filter(([, t]) => t);
      if (off.length) { const xx = el('div', 'x', 'Off: '); off.forEach(([p, t], i) => { xx.append((i ? '; ' : '') + nameOf(p, O.name === 'none' ? 'first' : O.name, staff)); if (t.note) xx.append(SUP(num('to' + p.id + t.id, `${p.name}, ${t.from === t.to ? dshort(t.from) : dshort(t.from) + ' – ' + dshort(t.to)}`, `Time off: ${t.note}`))); }); lab.append(xx); } }
    const row = el('div', 'row' + (h && h.closed ? ' closed' : '') + (isPast ? ' past' : '')); row.style.height = rowH + 'px';
    if (!O.shut) row.style.background = '#ffffff';
    if (h && !h.closed && h.open != null) { const o = el('div', 'open'); o.style.left = X(h.open); o.style.width = W(h.open, h.close); row.append(o); }
    if (O.grid) for (let m = a + 60 * O.grid; m < b; m += 60 * O.grid) { const t = el('div', 'tick' + (m % 60 === 0 ? ' h' : '')); t.style.left = X(m); row.append(t); }
    if (h && h.closed) { const c = el('div', 'closedtxt', 'CLOSED' + (h.name ? ' · ' + h.name : '')); if (left) c.append(el('span', 'leftover', `${left} shift${left === 1 ? ' is' : 's are'} still on the schedule: not printed`)); row.append(c); }
    list.forEach((s) => {
      const p = byId[s.staffId] || { name: '?', role: '' }; usedRoles.add(p.role);
      const pi = staff.indexOf(p), c = O.col === 'person' ? PERSON_COLS[(pi < 0 ? 0 : pi) % PERSON_COLS.length] : ROLE_COL[p.role] || ['#475569', '#e7ebf1'];
      const e = el('div', 'pill' + (O.shape === 'sq' ? ' sq' : '') + (/^(GM|AGM|SM)$/.test(p.role) ? ' lead' : ''));
      e.style.left = `calc(${X(s.start)} + 1px)`; e.style.width = `calc(${W(s.start, s.end)} - 2px)`; e.style.top = TOP + s.__l * (PH + GAP) + 'px'; e.style.height = PH + 'px';
      e.style.background = c[1]; e.style.borderColor = c[0]; e.style.color = c[0];
      const nm = nameOf(p, O.name, staff); if (nm) e.append(el('span', 'nm', nm));
      if (O.time) e.append(el('span', 't', `${clock(s.start)}–${clock(s.end)}`));
      if (s.note) e.append(SUP(num('sh' + s.id, `${p.name}, ${dshort(d)} ${clock(s.start)}–${clock(s.end)}`, s.note)));
      e.title = `${p.name} (${p.role || ''}) ${clock(s.start)}–${clock(s.end)}${s.note ? ' · ' + s.note : ''}`;
      row.append(e);
    });
    if (O.cov && list.length) { const cv = el('div', 'cov'); for (let m = a; m < b; m += 60) { const n = list.filter((s) => s.start < m + 60 && s.end > m).length; if (!n) continue; const i = el('i'); i.style.left = X(m); i.style.width = W(m, m + 60); i.append(el('b'), String(n)); cv.append(i); } row.append(cv); }
    timed.forEach(({ k, o }) => {
      const m = o.x.hours[0]; if (m < a || m > b) return;
      const ln = el('div', 'evline'); ln.style.left = X(m); row.append(ln);
      const mk = el('div', 'mark'); mk.style.left = X(m); mk.title = `${clock(m)}–${clock(o.x.hours[1])} ${o.x.title}`;
      mk.append(k ? icon(k) : el('span', 'flag', `${clock(m)} ${o.x.title.length > 18 ? o.x.title.slice(0, 17) + '…' : o.x.title}`)); row.append(mk);
    });
    if (O.now && d === today) { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); if (m > a && m < b) { const l = el('div', 'now'); l.style.left = X(m); row.append(l); } }
    if (di) grid.append(el('div', 'divider'));
    grid.append(lab, row);
  });
  sheet.append(grid);
  if (O.legend) {
    const lg = el('div', 'legend');
    if (O.col === 'role') Object.entries(ROLE_COL).filter(([r]) => usedRoles.has(r)).forEach(([r, c]) => { const s = el('span'), e = el('em'); e.style.background = c[1]; e.style.borderColor = c[0]; s.append(e, r); lg.append(s); });
    MARKS.filter(([k]) => usedSigns.has(k)).forEach(([k, l]) => { const s = el('span'); s.append(icon(k), l); lg.append(s); });
    if (anyMoved) { const s = el('span'); s.append(icon('payday', 'moved'), 'Circled: moved to the day before (the store is closed that day)'); lg.append(s); }
    if (lg.children.length) sheet.append(lg);
  }
  const notesEl = () => { if (!notes.length) return null; const box = el('div', 'notes'); box.append(el('h3', null, 'Notes')); const ol = el('ol'); notes.forEach((x) => { const li = el('li'); li.append(el('b', null, x.n), el('span', 'when', x.when + ' · '), x.text); ol.append(li); }); box.append(ol); return box; };
  return { sheet, notesEl, hasNotes: notes.length > 0 };
}

  // ---------- the pages: the week fitted to the paper (inside the border's room); the notes under it when there is room, else a page of their own ----------
  function measure(node, widthPx) { const box = document.createElement('div'); box.className = 'hw-measure'; box.style.cssText = `position:absolute;left:-99999px;top:0;width:${widthPx}px`; box.append(node); document.body.append(box); const r = node.getBoundingClientRect(); box.remove(); return r; }
  function buildPages(forPrint) {
    const [pw, ph] = paperOf(O), IN = 96, M = domBorderM(0.4), W = (pw - 2 * M) * IN, H = (ph - 2 * M) * IN;
    // lay the content out at a width (never under 900px, so names stay readable) whose shape fills the room: when the
    // height is what limits it, it is laid out wider (the pills get longer) until it fills the width too
    const fitted = (make) => {
      let lay = Math.max(W, 900), hh = 0, s = 1;
      for (let i = 0; i < 5; i++) { hh = measure(make(), lay).height; s = Math.min(W / lay, H / hh); const want = W / s; if (Math.abs(want - lay) < 4) break; lay = Math.max(900, want); }
      return { lay, h: hh, s: Math.min(W / lay, H / hh) };
    };
    const wkA = buildWeek(), alone = fitted(() => buildWeek().sheet);
    let withNotes = false, notesPage = false, both = null;
    if (wkA.hasNotes && O.notes !== 'off') {
      if (O.notes === 'page') notesPage = true;
      else { // on the page when the week and its notes together are still at least 85% of the size the week has alone
        both = fitted(() => { const d = el('div'), w2 = buildWeek(); d.append(w2.sheet, w2.notesEl()); return d; });
        if (both.s >= alone.s * 0.85) withNotes = true; else notesPage = true;
      }
    }
    const page = (content, f) => {
      const p = el('div', 'paper'); p.style.width = pw * IN + 'px'; p.style.height = ph * IN + 'px';
      const inn = el('div', 'in'), fit = el('div', 'fit'), s = Math.min(f.s, 1.6);
      inn.style.inset = M * IN + 'px';
      fit.style.width = f.lay + 'px'; fit.style.transform = `scale(${s})`; fit.append(content); inn.append(fit); p.append(inn);
      const bl = domBorderLayer(pw, ph); if (bl) p.append(bl);
      if (forPrint) p.querySelectorAll('.hw-leftover, .hw-now').forEach((x) => x.remove());
      return p;
    };
    const pages = [], w1 = buildWeek(), main = el('div'); main.append(w1.sheet); if (withNotes) main.append(w1.notesEl());
    pages.push(page(main, withNotes ? both : alone));
    if (notesPage) { // the notes page: the same heading, then the notes
      const w0 = weeksList()[wk], mk = () => { const d = el('div'); d.append(headEl(w0, 'Hourly schedule · notes'), buildWeek().notesEl()); return d; };
      const lay = Math.max(W, 760), hh = measure(mk(), lay).height; pages.push(page(mk(), { lay, s: Math.min(W / lay, H / hh, 1.25) })); }
    if (pages.length > 1) pages.forEach((p, i) => p.querySelectorAll('.hw-pgno').forEach((x) => { x.textContent = ` · Page ${i + 1} of ${pages.length}`; }));
    return { pages, pw, ph, where: !wkA.hasNotes ? 'No notes this week' : O.notes === 'off' ? 'Notes off' : withNotes ? 'Notes on the page' : O.notes === 'page' ? 'Notes on a page of their own' : 'Notes on a page of their own (no room on the week’s page)' };
  }

  // ---------- the print window: the choices on the left, the pages beside them ----------
  function dialog() {
    if (blockedHere()) return;
    const ws = weeksList(), at = ws.findIndex((w) => w <= ui.day && ui.day <= addDays(w, 6)), today = iso(new Date()), tw = ws.findIndex((w) => w <= today && today <= addDays(w, 6));
    wk = at >= 0 ? at : tw >= 0 ? tw : 0;
    let pw = null;
    const refresh = () => { saveO(); if (pw) pw.refresh(); };
    const fld = (label, ctl) => h('label', { class: 'field' }, h('span', null, label), ctl);
    const sel = (key, choices, num) => { const s = h('select', { class: 'input', onchange: () => { O[key] = num ? +s.value : s.value; refresh(); } }, choices.map(([v, l]) => h('option', { value: v, selected: String(O[key]) === String(v) }, l))); return s; };
    const tick = (key, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!O[key], onchange: (e) => { O[key] = e.target.checked; refresh(); } }), ' ' + label);
    const head = (t) => h('div', { class: 'pd-head' }, t);
    const weekSel = h('select', { class: 'input', onchange: () => { wk = +weekSel.value; refresh(); } }, ws.map((w, i) => h('option', { value: i, selected: i === wk }, `Week ${i + 1}: ${short(w)} – ${short(addDays(w, 6))}${i === tw ? ' (this week)' : ''}`)));
    const fileName = () => fileStem('hourly week', fileDate(weeksList()[wk]));
    pw = printWindow({ title: 'Hourly week: print or save', kind: 'hourly', use: 'hourly', reopen: () => hourlyWeekDialog(), opts: printFrame({
      what: pfFixed('What', 'One week: 7 days on a page'), week: fld('Week', weekSel),
      paper: paperChoices(O, refresh), color: fld('Print in', sel('page', [['color', 'Colour'], ['gray', 'Black and white']])),
      save: saveChoices(O, refresh),
      notes: fld('Numbered notes and details', sel('notes', [['auto', 'On the page if room'], ['page', 'On a page of their own'], ['off', 'Off']])),
      extraTitle: 'Options for the hourly week', extra: [
      head('The shifts'),
      fld('Names', sel('name', [['first', 'First name (Luke)'], ['full', 'First Last (Luke Smith)'], ['firstl', 'First L. (Luke S.)'], ['lastfirst', 'Last, First (Smith, Luke)'], ['lastf', 'Last F. (Smith L.)'], ['init', 'Initials (LS)'], ['none', 'None']])), tick('time', 'Times in the pill'),
      fld('Colour', sel('col', [['role', 'By role'], ['person', 'By person'], ['mono', 'One colour'], ['bw', 'Black and white (leads filled)']])), fld('Shape', sel('shape', [['pill', 'Pill'], ['sq', 'Box']])),
      fld('Rows', sel('lanes', [['pack', 'Packed: overlaps stack'], ['person', 'One line a person']])),
      head('The day'),
      fld('Hour lines', sel('grid', [[1, 'Every hour'], [2, 'Every 2 hours'], [0.5, 'Every half hour'], [0, 'None']], true)), tick('shut', 'Shade the hours the store is closed'), tick('cov', 'How many on, each hour'), tick('past', 'Dim the days gone by'), tick('now', 'A line at the time now (today, on screen)'),
      head('By the day’s name'),
      tick('signs', 'Signs (truck, produce, payday…)'), tick('hol', 'Holidays'), tick('ev', 'Events'), tick('off', 'Time off'), tick('at', 'Markers at their time of day'),
      head('Legend'), tick('legend', 'Legend (roles, signs)')] }),
    draw: (pv) => {
      const r = buildPages(false), w = pvWidth(pv), k = w / (r.pw * 96);
      pv.replaceChildren(...r.pages.flatMap((p, i) => { p.style.transform = `scale(${k})`; p.style.transformOrigin = '0 0';
        const wrap = h('div', { class: 'pd-page', style: { width: r.pw * 96 * k + 'px', height: r.ph * 96 * k + 'px', position: 'relative', overflow: 'hidden' } }, p);
        return [wrap, r.pages.length > 1 ? h('div', { class: 'pd-cap' }, `Page ${i + 1} of ${r.pages.length}`) : null].filter(Boolean); }));
      const w0 = weeksList()[wk];
      return `Week of ${short(w0)} – ${short(addDays(w0, 6))} · ${PAPERS[O.paper] ? PAPERS[O.paper][2] : O.paper} ${O.orient} · ${r.pages.length} page${r.pages.length > 1 ? 's' : ''} · ${r.where}`;
    },
    actions: [{ label: 'Cancel' },
      { label: 'Print…', onClick: () => { saveO(); (async () => { const r = buildPages(true), W = Math.round(r.pw * 96), H = Math.round(r.ph * 96); toast('Getting the pages ready…');
        try { const cs = await Promise.all(r.pages.map((p) => svgToCanvas(pageSvg(p, W, H, 300 / 96), Math.round(r.pw * 300), Math.round(r.ph * 300)))); printSurfaces(cs, O); } catch (e) { toast('Could not get the pages ready: ' + e.message); } })(); } },
      { label: 'Save', primary: true, onClick: () => { saveO(); const r0 = buildPages(true), W = Math.round(r0.pw * 96), H = Math.round(r0.ph * 96);
        savePrintout({ name: fileName(), pw: r0.pw, ph: r0.ph, o: O, svgs: (k) => buildPages(true).pages.map((p) => pageSvg(p, W, H, k)) }); } }] });
  }
  return { dialog };
})();
// the hourly week's print window (Print & share › Hourly week, and Layout in every print window)
function hourlyWeekDialog() { HW.dialog(); }
