  // ---- the availability and contact list (a printout for the wall or the office)
  // The availability and contact sheet itself, used by the printout and by the preview in the Print or save window
  // Contact QR codes: each person as a vCard 3.0 (name, role, company and location, phone, email) in a QR code; a phone's
  // camera offers to add them to its contacts. qrcode-generator (Kazuhiko Arase, MIT) makes the code, in UTF-8.
  // What goes on the contact cards and in their QR codes: two separate choices (a card can show the phone number while
  // the code leaves it out, or the other way round). Kept in this browser; the name is always on both.
  // The address is only offered while it is in use (Company & Location › Contact details we keep).
  // [key, label, on by default on the card, in the QR code]
  const CARD_FIELDS = [['role', 'Title (role)', 1, 1], ['id', 'Employee ID', 1, 1], ['shift', 'Shift code', 0, 0], ['company', 'Company', 1, 1], ['location', 'Location', 1, 1], ['store', 'Store number', 0, 0],
    ['phone', 'Phone', 1, 1], ['email', 'Email', 1, 1], ['addr', 'Home address', 1, 1], ['notes', 'Info (notes about them)', 0, 0]];
  const CARD_KEY = KEY + '-cards';
  const cardPrefs = { show: Object.fromEntries(CARD_FIELDS.map(([k, , a]) => [k, !!a])), qr: Object.fromEntries(CARD_FIELDS.map(([k, , , b]) => [k, !!b])), fit: 'std' };
  try {
    const c = JSON.parse(localStorage.getItem(CARD_KEY) || '{}');
    ['show', 'qr'].forEach((g) => { if (!c[g]) return; if ('org' in c[g]) { c[g].company = c[g].location = c[g].org; delete c[g].org; } Object.assign(cardPrefs[g], c[g]); }); // (company & location were one switch)
    if (c.fit === 'one') cardPrefs.fit = 'one';
  } catch (e) { /* blocked */ }
  const saveCardPrefs = () => { try { localStorage.setItem(CARD_KEY, JSON.stringify(cardPrefs)); } catch (e) { /* blocked */ } };
  const addrInUse = () => !(plan.contactUse && plan.contactUse.address === false);
  const cardOn = (grp, k) => !!cardPrefs[grp][k] && (k !== 'addr' || addrInUse());
  function vcardOf(p, grp = 'qr') {
    const e = (t) => String(t || '').replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n'), on = (k) => cardOn(grp, k);
    const parts = p.name.trim().split(/\s+/), last = parts.length > 1 ? parts.pop() : '', first = parts.join(' ');
    return ['BEGIN:VCARD', 'VERSION:3.0', `N:${e(last)};${e(first)};;;`, `FN:${e(p.name)}`,
      (() => { const c = on('company') ? plan.company : '', l = on('location') ? plan.location : ''; return c || l ? `ORG:${e(c || l)}${c && l ? ';' + e(l) : ''}` : ''; })(),
      on('role') ? `TITLE:${e(ROLES[p.role].label)}` : '', on('phone') && p.phone ? `TEL;TYPE=CELL:${e(p.phone)}` : '', on('email') && p.email ? `EMAIL;TYPE=INTERNET:${e(p.email)}` : '',
      on('addr') && p.address ? `ADR;TYPE=HOME:;;${e(p.address)};;;;` : '',
      // the rest as one note: Employee ID, shift code, store number, info
      (() => { const n = [on('id') && p.empId ? 'Employee ID ' + p.empId : '', on('shift') && p.shiftCode ? 'Shift code ' + p.shiftCode : '', on('store') && plan.storeNo ? 'Store #' + plan.storeNo : '', on('notes') && p.notes ? p.notes : ''].filter(Boolean).join(' · '); return n ? `NOTE:${e(n)}` : ''; })(), 'END:VCARD'].filter(Boolean).join('\r\n');
  }
  function qrOf(text) {
    if (typeof qrcode !== 'function') return null;
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make(); return q;
  }
  // a QR code drawn with plain rectangles (so it is exact on screen, in pictures and in SVG), quiet zone included
  // In a picture every dot is the same whole number of pixels, square (1:1), so scanners read it cleanly; the code is
  // centred in its box. In SVG (vector) the dots are exact anyway.
  function drawQr(g, text, x, y, size) {
    const q = qrOf(text); if (!q) return 0;
    const n = q.getModuleCount(), N = n + 8, vector = !!g.toSVG;
    const m = vector ? size / N : Math.max(1, Math.floor(size / N)), real = m * N;
    x += (size - real) / 2; y += (size - real) / 2; if (!vector) { x = Math.round(x); y = Math.round(y); }
    g.fillStyle = '#fff'; g.fillRect(x, y, real, real); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(x + (c + 4) * m, y + (r + 4) * m, m, m);
    return m;
  }
  // Push the contact QR codes into the shared Craft barcode library (localStorage 'craft-barcodes', the same list
  // BarcodeCraft, LabelCraft and PressCraft use; logged in: your account's 'craft'/'barcodes' too), so any app can put
  // a person's contact code on a sheet. One entry per person (id 'sc-' + their id): sending again updates them.
  async function cardsToLibrary(people) {
    const LIB = 'craft-barcodes', now = new Date().toISOString(), where = plan.location || plan.company || 'Team';
    const mine = people.map((p) => ({ id: 'sc-' + p.id, name: `${p.name} (${where} contact)`, type: 'QRCODE', value: vcardOf(p), wmm: 30, hmm: 30, ecc: 'M', saved: now, from: 'ShiftCraft' }));
    const merge = (...lists) => { const all = new Map(); lists.flat().forEach((x) => { const o = all.get(x.id); if (!o || (x.saved || '') >= (o.saved || '')) all.set(x.id, x); }); return [...all.values()].sort((a, b) => (b.saved || '').localeCompare(a.saved || '')); };
    let local = []; try { local = JSON.parse(localStorage.getItem(LIB) || '[]') || []; } catch (e) { /* none */ }
    const list = merge(local, mine);
    try { localStorage.setItem(LIB, JSON.stringify(list)); } catch (e) { return toast('The barcode library is full in this browser.'); }
    const A = CA(); let acct = '';
    if (A) { try { const got = (await A.get('craft', 'barcodes')) || []; await A.put('craft', 'barcodes', merge(got, list)); acct = ' and your account'; } catch (e) { acct = ' (your account could not be reached; it is kept in this browser)'; } }
    toast(`${mine.length} contact QR code${mine.length === 1 ? '' : 's'} added to the barcode library in this browser${acct}. Use Insert › Barcode in LabelCraft or PressCraft, or BarcodeCraft, to put them on a sheet.`);
  }
  const cardPeople = (range) => sortStaff(plan.staff.filter((p) => p.active && !p.left && (range !== 'phones' || p.phone)));
  // How the cards sit on a page. Standard: about 2.5 × 3.2 in each (portrait Letter: 3 × 3), as many pages as needed.
  // Everyone on 1 page: the grid that gives the biggest cards for n people. k: the card's size against standard.
  const CARD_W = 2.5, CARD_H = 3.2;
  function cardGrid(pw, ph, n = 1) {
    const aw = pw - 0.6, ah = ph - 1.1;
    if (cardPrefs.fit !== 'one') { const cols = Math.max(1, Math.floor(aw / CARD_W)), rows = Math.max(1, Math.floor(ah / CARD_H)); return [cols, rows, 1]; }
    let best = [1, n, 0];
    for (let cols = 1; cols <= Math.max(1, n); cols++) { const rows = Math.ceil(Math.max(1, n) / cols), k = Math.min(aw / cols / CARD_W, ah / rows / CARD_H); if (k > best[2]) best = [cols, rows, k]; }
    return best;
  }
  // Each card, everything centred: name; role · ID; company; the QR code; phone, email and address at the bottom.
  function drawContactCards(item, o) {
    let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi), H = Math.round(ph * dpi), c = makeSurface(W, H, o), g = c.getContext('2d');
    const [cols, rows, k0] = cardGrid(pw, ph, item.total || item.people.length), k = Math.max(0.55, Math.min(1.3, k0 || 1));
    const pt = (n) => (n / 72) * dpi, M = 0.3 * dpi, TOP = 0.75 * dpi;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.textBaseline = 'alphabetic';
    const font = (w, size) => { g.font = `${w} ${pt(size)}px Arial, Helvetica, sans-serif`; };
    const fit = (str, maxW) => { while (str.length > 1 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…'; return str; };
    // words on up to two lines
    const wrap2 = (str, maxW) => { if (g.measureText(str).width <= maxW) return [str]; const w = str.split(' '); let a = ''; while (w.length && g.measureText((a ? a + ' ' : '') + w[0]).width <= maxW) a += (a ? ' ' : '') + w.shift(); return a ? [a, fit(w.join(' '), maxW)] : [fit(str, maxW)]; };
    const on = (f) => cardOn('show', f);
    g.fillStyle = '#000'; font('700', 14); g.fillText(`${[plan.company, plan.location].filter(Boolean).join(' – ') || 'Team'} · Contact Cards`, M, M + pt(12));
    font('400', 9); g.fillStyle = '#444'; g.fillText(`Scan a code with a phone camera to add that person to its contacts.${item.pages > 1 ? `   Page ${item.page} of ${item.pages}` : ''}`, M, M + pt(26));
    const cw = (W - 2 * M) / cols, chh = (H - M - TOP) / rows;
    item.people.forEach((p, i) => {
      const x = M + (i % cols) * cw, y = TOP + Math.floor(i / cols) * chh, pad = pt(8 * k), cx = x + cw / 2, tw = cw - 2 * pad;
      g.strokeStyle = '#999'; g.lineWidth = Math.max(1, dpi / 150); g.setLineDash && g.setLineDash([pt(3), pt(3)]); g.strokeRect(x + pt(2), y + pt(2), cw - pt(4), chh - pt(4)); g.setLineDash && g.setLineDash([]);
      g.textAlign = 'center';
      // the lines above the code and below it, measured first so the code gets the room in between
      // under the name, one smaller line (two when it is long): title, company, location, store number, Employee ID, shift code
      const sub = [on('role') ? ROLES[p.role].label : '', on('company') ? plan.company : '', on('location') ? plan.location : '', on('store') && plan.storeNo ? 'Store #' + plan.storeNo : '',
        on('id') && p.empId ? 'ID ' + p.empId : '', on('shift') && p.shiftCode ? 'Code ' + p.shiftCode : ''].filter(Boolean);
      // it breaks only between items, never inside one
      font('400', 8 * k); const subL = [];
      sub.forEach((t) => { const last = subL.length - 1; if (last >= 0 && g.measureText(subL[last] + ' · ' + t).width <= tw) subL[last] += ' · ' + t; else subL.push(t); });
      if (subL.length > 2) subL.splice(1, subL.length, fit(subL.slice(1).join(' · '), tw));
      const top = [[p.name, '700', 12], ...subL.map((t) => [t, '400', 8, '#444'])];
      font('400', 7.5 * k);
      const addr = on('addr') && p.address ? wrap2(p.address, tw) : [];
      font('400', 7.5 * k); const info = on('notes') && p.notes ? [fit(p.notes, tw)] : [];
      const bot = [on('phone') ? [p.phone || 'no phone yet', '700', 10.5, p.phone ? '#000' : '#999'] : null, on('email') && p.email ? [p.email, '400', 8.5] : null, ...addr.map((a) => [a, '400', 7.5, '#333']), ...info.map((a) => [a, '400', 7.5, '#666'])].filter(Boolean);
      const lh = (l) => pt(l[2] * k * 1.3);
      const topH = top.reduce((t, l) => t + lh(l), 0), botH = bot.reduce((t, l) => t + lh(l), 0);
      let ty = y + pad;
      top.forEach((l) => { ty += lh(l); font(l[1], l[2] * k); g.fillStyle = l[3] || '#000'; g.fillText(fit(l[0], tw), cx, ty - pt(l[2] * k * 0.28)); });
      // the phone line sits at the same height on every card: room is kept for the lines a card could have
      const most = (on('phone') ? 10.5 : 0) + (on('email') ? 8.5 : 0) + (on('addr') ? 7.5 * Math.max(1, addr.length) : 0) + (on('notes') ? 7.5 : 0), botRes = Math.max(botH, pt(most * k * 1.3));
      const room = chh - 2 * pad - topH - botRes - pt(10 * k), qs = Math.max(pt(20), Math.min(tw, room));
      g.textAlign = 'left'; drawQr(g, vcardOf(p, 'qr'), cx - qs / 2, ty + pt(5 * k), qs); g.textAlign = 'center';
      ty = y + chh - pad - botRes - pt(2);
      bot.forEach((l) => { ty += lh(l); font(l[1], l[2] * k); g.fillStyle = l[3] || '#000'; g.fillText(fit(l[0], tw), cx, ty - pt(l[2] * k * 0.28)); });
      g.textAlign = 'left';
    });
    if (!item.people.length) { font('400', 11); g.fillStyle = '#666'; g.fillText('Nobody to show (add phone numbers on Staff › Contact & training).', M, TOP + pt(20)); }
    return c;
  }
  // the QR code's size on paper and the size of its dots, for the Print or save window (the longest code of them all)
  function cardQrInfo(pw, ph, people) {
    if (!people.length || typeof qrcode !== 'function') return '';
    const [cols, rows, k0] = cardGrid(pw, ph, people.length), k = Math.max(0.55, Math.min(1.3, k0 || 1));
    const cwIn = (pw - 0.6) / cols, chIn = (ph - 1.1) / rows;
    const n = Math.max(...people.map((p) => qrOf(vcardOf(p, 'qr')).getModuleCount())) + 8;
    const lines = 1 + (['role', 'id', 'shift', 'company', 'location', 'store'].some((k) => cardOn('show', k)) ? 1.5 : 0) + (cardOn('show', 'notes') ? 1 : 0) + (cardOn('show', 'phone') ? 1 : 0) + (cardOn('show', 'email') ? 1 : 0) + (cardOn('show', 'addr') ? 1.6 : 0);
    const qsIn = Math.max(0.28, Math.min(cwIn - 0.22 * k, chIn - 0.22 * k - lines * 0.15 * k - 0.14 * k)), dotMm = qsIn * 25.4 / n;
    return `QR codes about ${(qsIn * 25.4).toFixed(0)} mm (${qsIn.toFixed(2)} in), dots ${dotMm.toFixed(2)} mm: ${dotMm >= 0.4 ? 'scans easily' : dotMm >= 0.3 ? 'scans fine with most phones' : 'small: fewer per page or less in the code scans better'}`;
  }
  // ---- the details under the availability list, for the weeks chosen when printing (kept in this browser):
  // store hours (usual Monday to Sunday, and special hours), time off with its notes, events, and holidays; two small
  // tables side by side. where: under the list ('page'), on a page of their own ('separate'), or left out ('off').
  const AVD_KEY = KEY + '-avail-details';
  const AVAIL_RANGES = [['this', 'This week'], ['next1', 'Next week'], ['this2', 'This week and next'], ['next2', 'The next 2 weeks'], ['next4', 'The next 4 weeks'], ['next8', 'The next 8 weeks']];
  const availDet = { where: 'page', range: 'next1' };
  try { const c = JSON.parse(localStorage.getItem(AVD_KEY) || '{}'); if (['page', 'separate', 'off'].includes(c.where)) availDet.where = c.where; if (AVAIL_RANGES.some(([k]) => k === c.range)) availDet.range = c.range; } catch (e) { /* blocked */ }
  const saveAvailDet = () => { try { localStorage.setItem(AVD_KEY, JSON.stringify(availDet)); } catch (e) { /* blocked */ } };
  const availRange = () => { const mon = mondayOf(iso(new Date())), r = availDet.range, start = r.startsWith('this') ? mon : addDays(mon, 7), n = { this: 1, next1: 1, this2: 2, next2: 2, next4: 4, next8: 8 }[r] || 1; return [start, addDays(start, n * 7 - 1)]; };
  function availDetails() {
    const [a, b] = availRange(), on = (x) => x.from <= b && x.to >= a, span = a.slice(0, 4) === b.slice(0, 4) ? `${shortDate(a)} – ${shortDate(b)}` : `${shortDate(a)}, ${a.slice(0, 4)} – ${shortDate(b)}, ${b.slice(0, 4)}`;
    const box = (title, cols, head, rows, none) => h('div', { class: 'al-dbox' }, h('table', null, h('colgroup', null, cols.map((w) => h('col', w ? { style: { width: w } } : null))),
      h('thead', null, h('tr', null, h('th', { colspan: head.length, class: 'al-dtitle' }, title)), h('tr', null, head.map((x) => h('th', null, x)))),
      h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: head.length, class: 'al-dnone' }, none)))));
    const tr = (cls, ...cells) => h('tr', { class: cls || '' }, cells.map((c) => h('td', null, c)));
    const hrsOf = (x) => (x.closed ? 'Closed' : `${clockShort(x.open)}–${clockShort(x.close)}`);
    // 1 · store hours: the usual week, then special hours in these weeks
    const wk = usualWeek(), sp = (plan.specialHours || []).filter(on).sort((x, y) => x.from.localeCompare(y.from));
    const hours = box(`Store hours · ${span}`, ['34%', '26%', ''], ['Day', 'Hours', 'Note'],
      // the usual week with alike days together (Mon – Thu 7am–9pm), then special hours
      [...(() => { const out = []; for (let i = 0; i < 7;) { let j = i; while (j < 6 && usualText(wk[j + 1]) === usualText(wk[i])) j++; out.push(tr(wk[i] && wk[i].closed ? 'al-dclosed' : '', WEEKDAYS[i] + (j > i ? ' – ' + WEEKDAYS[j] : ''), usualText(wk[i]).replace(/^closed$/, 'Closed'), 'Usual hours')); i = j + 1; } return out; })(),
        ...sp.map((x) => tr('al-dspecial' + (x.closed ? ' al-dclosed' : ''), datesOnly(x), hrsOf(x), (x.name || 'Special hours') + (x.note ? ' — ' + x.note : '')))], 'Not set (Company & Location).');
    // 2 · time off (approved and asked for) with its notes
    const off = plan.staff.filter((p) => !p.left).flatMap((p) => (p.timeOff || []).filter((t) => t.status !== 'denied' && on(t)).map((t) => ({ p, t }))).sort((x, y) => x.t.from.localeCompare(y.t.from) || x.p.name.localeCompare(y.p.name));
    const timeOff = box(`Time off · ${span}`, ['26%', '30%', '20%', ''], ['Who', 'When', 'Why', 'Note'],
      off.map(({ p, t }) => tr(t.status === 'requested' ? 'al-dasked' : '', p.name, timeOffWhen(t), timeOffLabel(t), t.note || '')), 'Nobody has time off.');
    // 3 · store events
    const ev = (plan.events || []).filter(on).sort((x, y) => x.from.localeCompare(y.from) || (x.hours ? x.hours[0] : -1) - (y.hours ? y.hours[0] : -1));
    const events = box(`Events · ${span}`, ['34%', '30%', ''], ['When', 'Event', 'Note'],
      ev.map((x) => tr('', datesOnly(x) + (x.hours ? `, ${clockShort(x.hours[0])}–${clockShort(x.hours[1])}` : ''), x.title, x.note || '')), 'No events.');
    // 4 · holidays, with the store's hours on them
    const hol = holidaysFrom(a, 60).filter((x) => x.date <= b);
    const holidays = box(`Holidays · ${span}`, ['34%', '33%', ''], ['Date', 'Holiday', 'Store'],
      hol.map((x) => { const s = specialOn(x.date), u = usualOn(x.date); return tr(s && s.closed ? 'al-dclosed' : '', `${dayName(x.date, 'short')} ${shortDate(x.date)}`, x.name, s ? hrsOf(s) + (s.name && s.name !== x.name ? ` (${s.name})` : '') : `usual ${usualText(u)}${x.closed ? ' · often closed' : ''}`); }), 'No holidays in these weeks.');
    return h('div', { class: 'al-details' }, hours, timeOff, events, holidays);
  }
  const availDetailsPage = () => h('div', { class: 'person-sheet al-sheet' }, h('style', null, AL_CSS),
    h('div', { style: { fontSize: '14pt', fontWeight: 700, marginBottom: '10px' } }, `${[plan.company, plan.location].filter(Boolean).join(' · ') || 'Schedule'} · Schedule Availability and Contact Information: details`), availDetails());
  const AL_CSS = `
        .al-sheet { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #000; }
        /* printers leave out background colours unless told to keep them: the coloured days and yellow rows need them */
        .al-sheet, .al-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .al-sheet table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .al-sheet th, .al-sheet td { font-size: 9pt; padding: 1px 3px; }
        .al-title { text-align: left; vertical-align: top; width: 170px; }
        .al-title b { display: block; text-decoration: underline; font-size: 11pt; text-align: center; margin-bottom: 8px; }
        .al-up { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; font-weight: 400; font-size: 9pt; }
        .al-headpos { width: 14px; vertical-align: bottom; }
        .al-dayhead { border: 1px solid #000; background: #d9d9d9; height: 120px; vertical-align: bottom; text-align: center; font-weight: 400; font-size: 10pt; }
        .al-section td { padding-top: 12px; font-weight: 700; font-size: 12pt; text-decoration: underline; text-align: center; }
        .al-name { font-weight: 700; white-space: nowrap; overflow: hidden; }
        .al-name.pend { background: #ffff00; }
        .al-phone { font-weight: 700; white-space: nowrap; text-align: right; }
        .al-blank { display: inline-block; width: 92px; border-bottom: 1px solid #000; height: 12px; }
        .al-tick, .al-postop { padding: 1px 0 !important; text-align: center; }
        .al-box { display: inline-block; width: 12px; height: 12px; border: 1.3px solid #000; border-radius: 2px; margin: 0 1px; font-size: 9px; line-height: 12px; text-align: center; vertical-align: middle; }
        .al-box.on { background: #000; color: #fff; }
        /* green can work, red can't, yellow call or arrange first, black not given */
        .al-day { border: 1px solid #000; text-align: center; background: #c6e0b4; font-size: 10pt; height: 18px; }
        .al-day.off { background: #ff7c7c !important; color: #000 !important; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
        .al-day.hl { background: #ffff00; }
        .al-day.none { background: #fff !important; }
        .al-key { display: flex; justify-content: flex-end; gap: 14px; margin-top: 4px; font-size: 8.5pt; }
        .al-key span { display: inline-block; width: 22px; height: 11px; border: 1px solid #000; vertical-align: -1px; margin-right: 4px; }
        .al-day div { line-height: 1.15; }
        .al-id { font-weight: 400; font-size: 7.5pt; color: #444; }
        /* the details: two small tables side by side, then two more */
        .al-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 12px; align-items: start; }
        .al-dbox table { table-layout: fixed; }
        .al-dbox th, .al-dbox td { border: 1px solid #000; font-size: 8pt; padding: 1px 4px; text-align: left; vertical-align: top; overflow: hidden; }
        .al-dbox thead th { background: #d9d9d9; font-weight: 700; }
        .al-dbox th.al-dtitle { background: #000; color: #fff; font-size: 9pt; text-align: center; }
        .al-dnone { color: #555; font-style: italic; }
        .al-dspecial td { font-weight: 700; background: #fff2cc; }
        .al-dclosed td { background: #f4cccc; }
        .al-dasked td { font-style: italic; }
      `;
  function availabilitySheet(where = availDet.where) {
    const now = new Date(), pad = (n) => String(n).padStart(2, '0');
    const version = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${pad(now.getHours())}.${pad(now.getMinutes())}`;
    const positions = (plan.positions || []).filter((x) => x.active), people = sortStaff(plan.staff.filter((p) => p.active));
    const sections = [['mgr', PLURAL.mgr], ['sup', PLURAL.sup], ['tm', PLURAL.tm]];
    const groupOf = (p) => (ROLES[p.role].group === 'trn' || p.pending ? 'tm' : ROLES[p.role].group);
    const tick = (on) => h('span', { class: 'al-box' + (on ? ' on' : '') }, on ? '✔' : '');
    const row = (p) => {
      const pend = p.pending || ROLES[p.role].group === 'trn';
      return h('tr', null,
        h('td', { class: 'al-name' + (pend ? ' pend' : '') }, p.name + (pend ? ' - Pending Training' : ''), p.empId ? h('span', { class: 'al-id' }, ' #' + p.empId) : null),
        h('td', { class: 'al-phone' }, p.phone || h('span', { class: 'al-blank' }, '')),
        positions.map((pos) => h('td', { class: 'al-tick' }, tick(Array.isArray(p.trained) && p.trained.includes(pos.id)))), h('td'),
        // the hours themselves, one stretch a line (split days stacked), and school class times
        WEEKDAYS.map((_, i) => { const a = avOf(p, i) || avFromSets(p, i); return h('td', { class: 'al-day ' + avClass(a) }, (a && a.k === 'unk' ? [] : avCellLines(p, i, a)).map((x) => h('div', null, x.textContent.replace(/–/g, '⁠–⁠')))); }));
    };
    const sheet = h('div', { class: 'person-sheet al-sheet' },
      h('style', null, AL_CSS),
      h('table', null,
        h('colgroup', null, h('col', { style: { width: '170px' } }), h('col', { style: { width: '88px' } }), positions.map(() => h('col', { style: { width: '17px' } })), h('col', { style: { width: '8px' } }), WEEKDAYS.map(() => h('col', null))),
        h('thead', null, h('tr', null,
          h('th', { class: 'al-title' }, h('b', null, 'Schedule Availability and Contact Information'), plan.company || plan.location ? h('b', { style: { textDecoration: 'none', fontSize: '9pt' } }, [plan.company, plan.location].filter(Boolean).join(' · ')) : null, h('b', null, 'Version ' + version)),
          h('th', { class: 'al-headpos', style: { textAlign: 'right' } }, h('span', { class: 'al-up' }, 'Phone Numbers')),
          positions.map((pos) => h('th', { class: 'al-headpos al-postop' }, h('span', { class: 'al-up' }, pos.name))), h('th'),
          WEEKDAYS.map((w) => h('th', { class: 'al-dayhead' }, w)))),
        h('tbody', null, sections.flatMap(([g, title]) => {
          const list = people.filter((p) => groupOf(p) === g).sort((a, b) => (a.pending || ROLES[a.role].group === 'trn') - (b.pending || ROLES[b.role].group === 'trn'));
          return list.length ? [h('tr', { class: 'al-section' }, h('td', null, title), h('td', { colspan: positions.length + 9 })), ...list.map(row)] : [];
        }))),
      h('div', { class: 'al-key' }, [['#c6e0b4', 'Available'], ['#ff7c7c', 'Unavailable'], ['#ffff00', 'Call or arrange first']].map(([c, l]) => h('div', null, h('span', { style: { background: c } }), l))),
      where === 'page' ? availDetails() : null);
    if (where === 'separate') sheet.notesPage = availDetailsPage();
    return sheet;
  }
  // the availability sheet on Letter, Legal or Tabloid (landscape): how big the page is and how much the sheet is enlarged
  // to fill it (by whichever of width or height runs out first, so it stays one page)
  const availPaper = (paper) => { const k = PAPERS[paper] ? paper : 'letter', [a, b] = PAPERS[k], W = Math.max(a, b), H = Math.min(a, b); return { key: k, W, H, zoom: Math.min((W - 0.8) / 10.2, (H - 0.8) / 7.7) }; };
  let availPaperPref = 'letter'; try { availPaperPref = localStorage.getItem(KEY + '-avail-paper') || 'letter'; } catch (e) { /* ignore */ }
  // Fitting the sheet to its page: it is measured off screen and enlarged until it fills the page's height (the width
  // always fits: the table spreads across it), at most half as big again; then, if the page is still taller, the rows
  // are stretched to use the rest, so the sheet fills the paper top to bottom. Returns the zoom (set on the sheet).
  function fitAvailability(sh, pg) {
    const innerW = (pg.W - 0.8) * 96, innerH = (pg.H - 0.8) * 96 - 2;
    const holder = h('div', { style: { position: 'fixed', left: '-100000px', top: '0', width: innerW + 'px', visibility: 'hidden', background: '#fff' } }, sh);
    document.body.append(holder);
    const heightAt = (z) => { sh.style.zoom = z; sh.style.width = innerW / z + 'px'; return sh.getBoundingClientRect().height; };
    // it fits when it is no taller than the page and no day name or entry spills out of its box (the day columns get
    // narrower as everything else grows)
    const cells = [...sh.querySelectorAll('.al-day, .al-dayhead')];
    const fits = (z) => heightAt(z) <= innerH && cells.every((c) => c.scrollWidth <= c.clientWidth + 1);
    let lo = 0.3, hi = 1.5 * Math.max(1, pg.zoom);
    if (fits(hi)) lo = hi;
    else for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    const z = lo, used = heightAt(z), rows = [...sh.querySelectorAll('tbody tr')].filter((r) => r.querySelector('.al-day'));
    if (rows.length && used < innerH - 4) {
      const extra = (innerH - used) / z / rows.length;
      rows.forEach((r) => { r.style.height = r.getBoundingClientRect().height / z + extra + 'px'; });
    }
    holder.remove(); sh.style.width = '';
    return z;
  }
  // The availability sheet as a picture at a resolution: the page (paper size, landscape) drawn through SVG, as Print
  // screen does; dpi 96 = the screen's size
  // el: another page to draw instead (the notes page)
  async function availabilityCanvas(paper, dpi, el) {
    const pg = availPaper(paper), W = Math.round(pg.W * 96), H = Math.round(pg.H * 96), sh = el || availabilitySheet(); if (!el) fitAvailability(sh, pg);
    const page = h('div', { xmlns: 'http://www.w3.org/1999/xhtml', style: { width: W + 'px', height: H + 'px', padding: '0.4in', boxSizing: 'border-box', background: '#ffffff', color: '#000000', overflow: 'hidden' } }, sh);
    const xhtml = new XMLSerializer().serializeToString(page), k = dpi / 96;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * k)}" height="${Math.round(H * k)}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext('2d'); if (!g) throw new Error('too big');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, svg, pg, sheet: sh };
  }
  // A one-page PDF holding a JPEG picture of the page, wIn × hIn inches: written by hand (header, catalogue, page, image,
  // drawing, cross-reference table), so no library is needed
  async function pdfFromCanvas(cs, wIn, hIn) {
    cs = Array.isArray(cs) ? cs : [cs];
    const jpgs = [];
    for (const c of cs) jpgs.push(new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))).arrayBuffer()));
    const W = (wIn * 72).toFixed(2), H = (hIn * 72).toFixed(2), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`, total = 3 + 3 * cs.length;
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => put(`<< /Type /Pages /Kids [${cs.map((_, k) => `${3 + 3 * k} 0 R`).join(' ')}] /Count ${cs.length} >>`));
    // each page: the page, its picture, its drawing
    cs.forEach((c, k) => {
      const pn = 3 + 3 * k;
      obj(pn, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${pn + 1} 0 R >> >> /Contents ${pn + 2} 0 R >>`));
      obj(pn + 1, () => { put(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgs[k].length} >>\nstream\n`); put(jpgs[k]); put('\nendstream'); });
      obj(pn + 2, () => put(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    });
    const xref = len;
    put(`xref\n0 ${total}\n0000000000 65535 f \n${Array.from({ length: total - 1 }, (_, k) => String(offs[k + 1]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function saveAvailability(o) {
    const fmt = o.availFormat || 'pdf', dpi = +o.dpi || 300, pg = availPaper(o.availPaper);
    const big = tooBig(Math.round(pg.W * dpi), Math.round(pg.H * dpi)), useDpi = big ? 300 : dpi;
    toast('Making the availability list…');
    try {
      const { canvas, sheet } = await availabilityCanvas(o.availPaper, useDpi);
      // the numbered notes on a page of their own: a second page in the PDF, or a second picture
      const notes = sheet.notesPage ? (await availabilityCanvas(o.availPaper, useDpi, sheet.notesPage)).canvas : null;
      const name = `${fileStem('availability and contact list')}.${fmt}`;
      const blob = fmt === 'pdf' ? await pdfFromCanvas(notes ? [canvas, notes] : canvas, pg.W, pg.H) : await canvasBlob(canvas, { format: fmt, dpi: useDpi });
      const type = fmt === 'pdf' ? { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } } : { description: fmt.toUpperCase() + ' image', accept: { [fmt === 'jpg' ? 'image/jpeg' : 'image/' + fmt]: ['.' + fmt] } };
      const files = [{ name, blob, type }];
      if (notes && fmt !== 'pdf') files.push({ name: name.replace(/\.\w+$/, ` notes.${fmt}`), blob: await canvasBlob(notes, { format: fmt, dpi: useDpi }), type });
      const n = await saveMany(files);
      if (n) toast(`Saved ${name}${big ? ` (at 300 DPI: ${dpi} DPI on this paper is more than a browser can draw)` : ''}`);
    } catch (e) { toast('That could not be made: ' + e.message); }
  }
  function printAvailability(anyway, paper) {
    if (blockedHere()) return;
    if (paper) { availPaperPref = paper; try { localStorage.setItem(KEY + '-avail-paper', paper); } catch (e) { /* ignore */ } }
    // phone numbers have to be on the list: name anyone without one first
    const noPhone = sortStaff(plan.staff.filter((p) => p.active && !(p.phone || '').trim()));
    if (noPhone.length && !anyway) {
      modal({ title: 'Phone numbers missing', body: h('div', null, h('p', null, `${noPhone.length === 1 ? 'This person has' : 'These people have'} no phone number yet:`), h('ul', null, noPhone.map((p) => h('li', null, p.name))), h('p', { class: 'hint' }, 'Add them on Staff › Day by day (or Contact & training). Printing anyway leaves a line to write the number in.')),
        actions: [{ label: 'Print anyway', left: true, onClick: () => { setTimeout(() => printAvailability(true, paper)); } }, { label: 'Cancel' },
          { label: 'Add numbers', primary: true, onClick: () => { staffTab = 'avail'; try { localStorage.setItem('shiftcraft-staff-tab', 'avail'); } catch (e) {} ui.tab = 'staff'; persist(); render(); setTimeout(() => { const x = document.querySelector('input.need'); x && x.focus(); }, 60); } }] });
      return;
    }
    const area = $('#print-area'), sheet = availabilitySheet();
    // no margins on the page, so the browser leaves out its own header and footer (date, title, address, page number):
    // the sheet has its title and version already; the space round it is put back inside the page
    const pg = availPaper(availPaperPref);
    area.replaceChildren(h('style', null, `@page { size: ${pg.W}in ${pg.H}in; margin: 0; } #print-area { padding: 0.4in; box-sizing: border-box; }`), sheet);
    fitAvailability(sheet, pg); $('#print-area').append(sheet);
    if (sheet.notesPage) $('#print-area').append(h('div', { style: { breakBefore: 'page', pageBreakBefore: 'always', paddingTop: '0.4in' } }, sheet.notesPage));
    document.body.classList.add('print-people');
    const done = () => { document.body.classList.remove('print-people'); area.replaceChildren(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }
