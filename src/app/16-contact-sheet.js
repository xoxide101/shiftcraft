  // ---- the availability and contact list (a printout for the wall or the office)
  // The availability and contact sheet itself, used by the printout and by the preview in the Print or save window
  // Contact QR codes: each person as a vCard 3.0 (name, role, company and location, phone, email) in a QR code; a phone's
  // camera offers to add them to its contacts. qrcode-generator (Kazuhiko Arase, MIT) makes the code, in UTF-8.
  function vcardOf(p) {
    const e = (t) => String(t || '').replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const parts = p.name.trim().split(/\s+/), last = parts.length > 1 ? parts.pop() : '', first = parts.join(' ');
    return ['BEGIN:VCARD', 'VERSION:3.0', `N:${e(last)};${e(first)};;;`, `FN:${e(p.name)}`,
      plan.company || plan.location ? `ORG:${e(plan.company || plan.location)}${plan.company && plan.location ? ';' + e(plan.location) : ''}` : '',
      `TITLE:${e(ROLES[p.role].label)}`, p.phone ? `TEL;TYPE=CELL:${e(p.phone)}` : '', p.email ? `EMAIL;TYPE=INTERNET:${e(p.email)}` : '', p.empId ? `NOTE:${e('Employee ID ' + p.empId)}` : '', 'END:VCARD'].filter(Boolean).join('\r\n');
  }
  function qrOf(text) {
    if (typeof qrcode !== 'function') return null;
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make(); return q;
  }
  // a QR code drawn with plain rectangles (so it is exact on screen, in pictures and in SVG), quiet zone included
  function drawQr(g, text, x, y, size) {
    const q = qrOf(text); if (!q) return;
    const n = q.getModuleCount(), m = size / (n + 8);
    g.fillStyle = '#fff'; g.fillRect(x, y, size, size); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(x + (c + 4) * m, y + (r + 4) * m, m + 0.02 * m, m + 0.02 * m);
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
  // how many cards fit a page: cards about 2.6 × 2 in (portrait Letter: 3 × 5)
  const cardGrid = (pw, ph) => [Math.max(1, Math.floor((pw - 0.6) / 2.55)), Math.max(1, Math.floor((ph - 1.1) / 2.0))];
  function drawContactCards(item, o) {
    let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi), H = Math.round(ph * dpi), c = makeSurface(W, H, o), g = c.getContext('2d');
    const pt = (n) => (n / 72) * dpi, M = 0.3 * dpi, TOP = 0.75 * dpi, [cols, rows] = cardGrid(pw, ph);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.textBaseline = 'alphabetic';
    const font = (w, size) => { g.font = `${w} ${pt(size)}px Arial, Helvetica, sans-serif`; };
    const fit = (str, maxW) => { while (str.length > 1 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…'; return str; };
    g.fillStyle = '#000'; font('700', 14); g.fillText(`${[plan.company, plan.location].filter(Boolean).join(' – ') || 'Team'} · contact cards`, M, M + pt(12));
    font('400', 9); g.fillStyle = '#444'; g.fillText(`Scan a code with a phone camera to add that person to its contacts.${item.pages > 1 ? `   Page ${item.page} of ${item.pages}` : ''}`, M, M + pt(26));
    const cw = (W - 2 * M) / cols, chh = (H - M - TOP) / rows;
    item.people.forEach((p, i) => {
      const x = M + (i % cols) * cw, y = TOP + Math.floor(i / cols) * chh, pad = pt(7), qs = Math.min(cw * 0.5, chh - 2 * pad - pt(30));
      g.strokeStyle = '#999'; g.lineWidth = Math.max(1, dpi / 150); g.setLineDash && g.setLineDash([pt(3), pt(3)]); g.strokeRect(x + pt(2), y + pt(2), cw - pt(4), chh - pt(4)); g.setLineDash && g.setLineDash([]);
      g.fillStyle = '#000'; font('700', 11); g.fillText(fit(p.name, cw - 2 * pad), x + pad, y + pad + pt(10));
      font('400', 8.5); g.fillStyle = '#444'; g.fillText(fit(ROLES[p.role].label, cw - 2 * pad), x + pad, y + pad + pt(21));
      drawQr(g, vcardOf(p), x + pad, y + pad + pt(27), qs);
      const tx = x + pad + qs + pt(6), tw = cw - (tx - x) - pad; let ty = y + pad + pt(40);
      g.fillStyle = '#000'; font('700', 9.5); g.fillText(fit(p.phone || 'no phone yet', tw), tx, ty); ty += pt(13);
      if (p.email) { font('400', 8); g.fillText(fit(p.email, tw), tx, ty); ty += pt(12); }
      if (p.empId) { font('400', 8); g.fillStyle = '#444'; g.fillText(fit('ID ' + p.empId, tw), tx, ty); }
    });
    if (!item.people.length) { font('400', 11); g.fillStyle = '#666'; g.fillText('Nobody to show (add phone numbers on Staff › Day by day).', M, TOP + pt(20)); }
    return c;
  }
  function availabilitySheet() {
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
        WEEKDAYS.map((_, i) => { const a = avOf(p, i) || avFromSets(p, i); return h('td', { class: 'al-day ' + avClass(a) }, avCellLines(p, i, a).map((x) => h('div', null, x.textContent.replace(/–/g, '⁠–⁠')))); }),
        h('td', { class: 'al-note' }, comingUpLines(p).map((t) => h('div', null, t))));
    };
    const sheet = h('div', { class: 'person-sheet al-sheet' },
      h('style', null, `
        .al-sheet { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #000; }
        /* printers leave out background colours unless told to keep them: the black Off boxes, green days and yellow rows need them */
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
        .al-day { border: 1px solid #000; text-align: center; background: #e2f0d9; font-size: 10pt; height: 18px; }
        .al-day.off { background: #000 !important; color: #fff !important; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
        .al-day.hl { background: #ffc000; }
        .al-day div { line-height: 1.15; }
        .al-id { font-weight: 400; font-size: 7.5pt; color: #444; }
        .al-note { border: 1px solid #000; font-size: 7.5pt !important; line-height: 1.15; vertical-align: middle; }
        .al-notehead { border: 1px solid #000; background: #d9d9d9; vertical-align: bottom; text-align: center; font-weight: 400; font-size: 9pt; }
        .al-foot { margin-top: 8px; font-size: 8.5pt; line-height: 1.3; }
        .al-foot b { margin-right: 4px; }
      `),
      h('table', null,
        h('colgroup', null, h('col', { style: { width: '170px' } }), h('col', { style: { width: '88px' } }), positions.map(() => h('col', { style: { width: '17px' } })), h('col', { style: { width: '8px' } }), WEEKDAYS.map(() => h('col', null)), h('col', { style: { width: '150px' } })),
        h('thead', null, h('tr', null,
          h('th', { class: 'al-title' }, h('b', null, 'Schedule Availability and Contact Information'), plan.company || plan.location ? h('b', { style: { textDecoration: 'none', fontSize: '9pt' } }, [plan.company, plan.location].filter(Boolean).join(' · ')) : null, h('b', null, 'Version ' + version)),
          h('th', { class: 'al-headpos', style: { textAlign: 'right' } }, h('span', { class: 'al-up' }, 'Phone Numbers')),
          positions.map((pos) => h('th', { class: 'al-headpos al-postop' }, h('span', { class: 'al-up' }, pos.name))), h('th'),
          WEEKDAYS.map((w) => h('th', { class: 'al-dayhead' }, w)), h('th', { class: 'al-notehead' }, 'School · time off (next 8 weeks)'))),
        h('tbody', null, sections.flatMap(([g, title]) => {
          const list = people.filter((p) => groupOf(p) === g).sort((a, b) => (a.pending || ROLES[a.role].group === 'trn') - (b.pending || ROLES[b.role].group === 'trn'));
          return list.length ? [h('tr', { class: 'al-section' }, h('td', null, title), h('td', { colspan: positions.length + 11 })), ...list.map(row)] : [];
        }))),
      // special store hours and events coming up (from the Calendar)
      (() => { const { sp, ev } = storeComingUp(), us = usualSummary(); return us || sp.length || ev.length ? h('div', { class: 'al-foot' }, us ? h('div', null, h('b', null, 'Store hours:'), us) : null, sp.length ? h('div', null, h('b', null, us ? 'Special hours:' : 'Store hours:'), sp.join('  ·  ')) : null, ev.length ? h('div', null, h('b', null, 'Coming up:'), ev.join('  ·  ')) : null) : null; })());
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
  async function availabilityCanvas(paper, dpi) {
    const pg = availPaper(paper), W = Math.round(pg.W * 96), H = Math.round(pg.H * 96), sh = availabilitySheet(); fitAvailability(sh, pg);
    const page = h('div', { xmlns: 'http://www.w3.org/1999/xhtml', style: { width: W + 'px', height: H + 'px', padding: '0.4in', boxSizing: 'border-box', background: '#ffffff', color: '#000000', overflow: 'hidden' } }, sh);
    const xhtml = new XMLSerializer().serializeToString(page), k = dpi / 96;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * k)}" height="${Math.round(H * k)}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const g = c.getContext('2d'); if (!g) throw new Error('too big');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return { canvas: c, svg, pg };
  }
  // A one-page PDF holding a JPEG picture of the page, wIn × hIn inches: written by hand (header, catalogue, page, image,
  // drawing, cross-reference table), so no library is needed
  async function pdfFromCanvas(c, wIn, hIn) {
    const jpg = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))).arrayBuffer());
    const W = (wIn * 72).toFixed(2), H = (hIn * 72).toFixed(2), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
    const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => put('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    obj(4, () => { put(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put('\nendstream'); });
    obj(5, () => put(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    const xref = len;
    put(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  async function saveAvailability(o) {
    const fmt = o.availFormat || 'pdf', dpi = +o.dpi || 300, pg = availPaper(o.availPaper);
    const big = tooBig(Math.round(pg.W * dpi), Math.round(pg.H * dpi)), useDpi = big ? 300 : dpi;
    toast('Making the availability list…');
    try {
      const { canvas } = await availabilityCanvas(o.availPaper, useDpi);
      const name = `${fileStem('availability and contact list')}.${fmt}`;
      const blob = fmt === 'pdf' ? await pdfFromCanvas(canvas, pg.W, pg.H) : await canvasBlob(canvas, { format: fmt, dpi: useDpi });
      const type = fmt === 'pdf' ? { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } } : { description: fmt.toUpperCase() + ' image', accept: { [fmt === 'jpg' ? 'image/jpeg' : 'image/' + fmt]: ['.' + fmt] } };
      const n = await saveMany([{ name, blob, type }]);
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
    document.body.classList.add('print-people');
    const done = () => { document.body.classList.remove('print-people'); area.replaceChildren(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 60);
  }
