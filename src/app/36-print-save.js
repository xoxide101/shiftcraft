  // ===================================================================
  // Saving and printing pages
  // ===================================================================
  async function canvasBlob(c, o) {
    if (c.vector) return new Blob([c.svg()], { type: 'image/svg+xml' });
    if (o.format === 'bmp') return canvasToBmp(c, o.dpi);
    const mime = o.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((r) => c.toBlob(r, mime, 0.95));
    if (!blob) throw new Error('too big');
    return withDpi(blob, o.format, o.dpi);
  }
  // Prints pages as vectors, so they come out at the printer's full resolution.
  function printSurfaces(surfaces, o) {
    if (blockedHere()) return;
    let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const area = $('#print-area');
    area.replaceChildren(h('style', null, `@page { size: ${pw}in ${ph}in; margin: 0; } #print-area img.page { display: block; width: ${pw}in; height: auto; break-after: page; page-break-after: always; } #print-area img.page:last-of-type { break-after: auto; page-break-after: auto; }`),
      ...surfaces.map((c) => h('img', { class: 'page', alt: '', src: c.vector ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg()) : c.toDataURL('image/png') })));
    document.body.classList.add('print-people');
    const done = () => { document.body.classList.remove('print-people'); area.replaceChildren(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 200);
  }
  const DPI_OPTIONS = [[300, '300 DPI – print quality (default)'], [600, '600 DPI'], [1200, '1200 DPI – very large files'], [2400, '2400 DPI – saved as SVG vector'], [4800, '4800 DPI – saved as SVG vector'], [200, '200 DPI'], [150, '150 DPI – smaller files']];
  function exportImageDialog(preset = {}) {
    // printing starts at this week (today's, when it is in the plan; else the day on screen), and the Week box picks
    // any other week of the plan (next week, the one after...) for planning ahead
    const today = iso(new Date());
    let PD = preset.day && planDays().includes(preset.day) ? preset.day : planDays().includes(today) ? today : planDays().includes(ui.day) ? ui.day : plan.startDate;
    const thisW = weekOf(today);
    const wkName = () => (weekOf(PD) === thisW ? 'This week' : `The week of ${shortDate(curWeek())}`);
    // the Week chooser: a month (any month, past or ahead, in the plan or not yet), then Week 1 2 3 4 5 of it (each
    // Monday-to-Sunday week counts in the month its Monday is in, so a month has 4 or 5). Shifts are kept by date, so a week outside the plan prints
    // what is saved on those days, or a blank sheet to fill in by hand.
    let shownMonth = mondayOf(PD).slice(0, 7);
    const inPlan = (mon) => mon >= plan.startDate && mon <= addDays(plan.startDate, plan.weeks * 7 - 1);
    const monthWeeks = (ym) => { const [y, m] = ym.split('-').map(Number), last = iso(new Date(y, m, 0)), out = []; for (let mon = mondayOf(addDays(ym + '-01', 6)); mon <= last; mon = addDays(mon, 7)) out.push(mon); return out; };
    const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); return iso(new Date(y, m - 1 + n, 1)).slice(0, 7); };
    const weekSel = () => {
      const thisMon = mondayOf(today), pdMon = mondayOf(PD), off = Math.round((parseIso(PD) - parseIso(pdMon)) / 864e5);
      const months = Array.from({ length: 37 }, (_, k) => addMonths(today.slice(0, 7), k - 18));
      if (!months.includes(shownMonth)) months.push(shownMonth), months.sort();
      const msel = h('select', { class: 'input', 'aria-label': 'Month', style: { width: 'auto' }, onchange: () => { shownMonth = msel.value; build(); } },
        months.map((ym) => h('option', { value: ym, selected: ym === shownMonth }, monthLabel(ym) + (ym === today.slice(0, 7) ? ' (this month)' : ''))));
      const go = (n) => { shownMonth = addMonths(shownMonth, n); build(); };
      const weeks = monthWeeks(shownMonth).map((mon, k) => {
        const tag = mon === thisMon ? 'this week' : mon === addDays(thisMon, 7) ? 'next week' : inPlan(mon) ? (mon < thisMon ? 'past' : 'planned') : mon < thisMon ? 'past · not in plan' : 'not planned yet';
        return h('button', { type: 'button', class: 'btn pw-week', 'aria-pressed': String(mon === pdMon), title: `${longDate(mon)} – ${longDate(addDays(mon, 6))} (${tag})`,
          onclick: () => { PD = addDays(mon, off); build(); update(); } },
          h('b', null, `Week ${k + 1}`), h('span', null, `${shortDate(mon)} – ${shortDate(addDays(mon, 6))}`), h('small', null, tag));
      });
      return h('div', { class: 'field', style: { gridColumn: '1 / -1' } }, h('span', null, `Week · printing ${shortDate(pdMon)} – ${shortDate(addDays(pdMon, 6))}`),
        h('div', { class: 'inline', style: { gap: '6px', flexWrap: 'wrap', alignItems: 'stretch' } },
          h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Previous month', onclick: () => go(-1) }, '‹'), msel,
          h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Next month', onclick: () => go(1) }, '›'),
          h('div', { class: 'pw-weeks', role: 'group', 'aria-label': 'Week of the month' }, weeks),
          pdMon === thisMon ? null : h('button', { type: 'button', class: 'btn sm', onclick: () => { PD = today; shownMonth = mondayOf(today).slice(0, 7); build(); update(); } }, 'This week')));
    };
    const daySel = () => {
      const s = h('select', { class: 'input', 'aria-label': 'Day to print', onchange: () => { PD = s.value; build(); update(); } }, weekDays(weekOf(PD)).map((d) => h('option', { value: d, selected: d === PD }, `${dayName(d)} ${shortDate(d)}${d === today ? ' (today)' : ''}`)));
      return h('label', { class: 'field' }, h('span', null, 'Day'), s);
    };
    const ONE = { table: 'week', timeline: 'weektile', calendar: 'week', avail: 'all', cards: 'all' };
    const o = { layout: 'table', range: 'week', format: 'png', paper: 'letter', orient: 'landscape', dpi: 300, notes: true, coverage: true, ...imgPrefs, ...preset };
    o.range = preset.range || ONE[o.layout] || 'week';
    if (!DPI_OPTIONS.some(([v]) => v === +o.dpi)) o.dpi = 300;
    const box = h('div', { style: { display: 'grid', gap: '10px' } });
    // the availability list's preview: the real sheet on a white landscape page, scaled down to fit the window
    const pagePrev = h('div', { 'aria-label': 'Print preview', style: { display: 'none', position: 'relative', overflow: 'hidden', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.25)' } });
    const showPage = () => {
      const pg = availPaper(o.availPaper), PW = Math.round(pg.W * 96), PH = Math.round(pg.H * 96), sh = availabilitySheet(); fitAvailability(sh, pg);
      const inner = h('div', { style: { position: 'absolute', left: 0, top: 0, width: PW + 'px', height: PH + 'px', padding: pg.m * 96 + 'px', boxSizing: 'border-box', background: '#fff', color: '#000', transformOrigin: '0 0', overflow: 'hidden' } }, sh);
      { const bl = domBorderLayer(pg.W, pg.H); if (bl) inner.append(bl); } // the border chosen (My border, Thin frame), over the page
      pagePrev.replaceChildren(inner);
      requestAnimationFrame(() => { const k = (pagePrev.clientWidth || 600) / PW; inner.style.transform = `scale(${k})`; pagePrev.style.height = PH * k + 'px'; });
    };
    const curWeek = () => weekDays(weekOf(PD))[0];
    const items = () => {
      if (o.layout === 'timeline') return o.range === 'day' ? [PD] : o.range === 'weektile' ? [weekDays(weekOf(PD))[0]] : o.range === 'week' ? weekDays(weekOf(PD)) : planDays();
      if (o.layout === 'calendar') return [o.range === 'all' ? { start: plan.startDate, weeks: plan.weeks } : { start: curWeek(), weeks: { week: 1, two: 2, month: 4 }[o.range] || 1 }];
      if (o.layout === 'cards') { const [pw, ph] = pageSize(), ppl = cardPeople(o.range), [cc, rr] = cardGrid(pw, ph, ppl.length), per = cc * rr, pages = Math.max(1, Math.ceil(ppl.length / per)); return Array.from({ length: pages }, (_, k) => ({ people: ppl.slice(k * per, (k + 1) * per), page: k + 1, pages, total: ppl.length })); }
      return o.range === 'all' ? Array.from({ length: plan.weeks }, (_, k) => k) : [weekOf(PD)];
    };
    // every page gets the decorations laid over it (29-decorations.js), for the days it shows
    const decoRange = (item) => { if (typeof item === 'string') { const m = mondayOf(item); return o.range === 'day' ? [item, item] : [m, addDays(m, 6)]; } if (typeof item === 'number') { const ds = weekDays(item); return [ds[0], ds[6]]; } if (item && item.start) return [item.start, addDays(item.start, item.weeks * 7 - 1)]; const m = mondayOf(iso(new Date())); return [m, addDays(m, 6)]; };
    const draw = (item, opts) => { const [a, b] = decoRange(item); return decorateSurface(drawRaw(item, opts), a, b, opts.dpi); };
    const drawRaw = (item, opts) => (o.layout === 'cards' ? drawContactCards(item, opts) : o.layout === 'timeline' ? (o.range === 'weektile' ? drawWeekTiles(item, opts) : drawDaySheet(item, opts)) : o.layout === 'calendar' ? drawCalendarSheet(item, opts) : drawWeekSheet(item, opts));
    const nameOf = (item) => (o.layout === 'cards' ? `${[plan.company, plan.location].filter(Boolean).join(' - ') || 'Team'} - contact cards${item.pages > 1 ? ' ' + item.page : ''}` : o.layout === 'timeline' ? (o.range === 'weektile' ? `${baseName(item, addDays(item, 6))} week timeline` : `${baseName(item, item)} timeline`) : o.layout === 'calendar' ? `${baseName(item.start, addDays(item.start, item.weeks * 7 - 1))} calendar` : baseName(...weekRange(item)));
    const RANGES = {
      avail: () => [['all', 'Everyone: one landscape page']],
      cards: () => [['all', `Everyone (${cardPeople('all').length})`], ['phones', `Only people with a phone number (${cardPeople('phones').length})`]],
      table: () => [['week', `${wkName()}${inPlan(curWeek()) ? ` (plan week ${weekOf(PD) + 1})` : ''}`], ['all', `All ${plan.weeks} weeks, one page each`]],
      timeline: () => [['day', `One day (${dayName(PD, 'short')} ${shortDate(PD)})`], ['weektile', `${wkName()} on 1 page (7 small tiles)`], ['week', `${wkName()}, 7 pages`], ['all', `All ${plan.weeks} weeks, ${plan.weeks * 7} pages`]],
      calendar: () => [['week', `Week of ${shortDate(curWeek())}`], ['two', `2 weeks from ${shortDate(curWeek())}`], ['month', `Month: 4 weeks from ${shortDate(curWeek())}`], ['all', `Whole plan, ${plan.weeks} week${plan.weeks > 1 ? 's' : ''}`]],
    };
    // where the numbered notes go (one choice for every printout): under the sheet, on a page of their own, or left out
    const notesWhereSel = () => { const s = h('select', { class: 'input', 'aria-label': 'Numbered notes', title: 'Special store hours, events, time off and notes on shifts get a small number on the sheet; the list says what each one is', onchange: () => { setNotesWhere(s.value); update(); } }, NOTES_WHERE.map(([v, l]) => h('option', { value: v, selected: notesWhere === v }, l))); return s; };
    // the week in tiles has no room for the list under it: there it goes on its own page
    const whereFor = () => (o.layout === 'timeline' && o.range === 'weektile' && notesWhere === 'page' ? 'separate' : notesWhere);
    // every page of the printout, and the notes page(s) after them when the list goes on its own page
    const allPages = (opts) => { const book = noteBook(), w = whereFor(), pages = items().map((it) => draw(it, { ...opts, numbered: w, book })); return w === 'separate' && book.list.length ? pages.concat(drawNotesPages(book, opts)) : pages; };
    // contact cards: what is printed, what is in the QR code (separately), and how many to a page
    const cardChecks = () => {
      // one row an item, with its own two switches: printed on the card, and in the QR code (any combination)
      const sw = (grp, k, l) => h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: !!cardPrefs[grp][k], 'aria-label': `${l}: ${grp === 'show' ? 'printed on the card' : 'in the QR code'}`, onchange: (e) => { cardPrefs[grp][k] = e.target.checked; saveCardPrefs(); update(); } }));
      const all = (grp, v) => { CARD_FIELDS.forEach(([k]) => { cardPrefs[grp][k] = v; }); saveCardPrefs(); build(); update(); };
      const grid = h('table', { class: 't compact card-fields' },
        h('thead', null, h('tr', null, h('th', null, 'Name is always on both'), h('th', { class: 'c' }, 'Printed on the card'), h('th', { class: 'c' }, 'In the QR code'))),
        h('tbody', null, CARD_FIELDS.filter(([k]) => k !== 'addr' || addrInUse()).map(([k, l]) => h('tr', null, h('td', null, l), sw('show', k, l), sw('qr', k, l))),
          h('tr', null, h('td', { class: 'muted small' }, 'All or none'), ...['show', 'qr'].map((grp) => h('td', { class: 'c nowrap' }, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => all(grp, true) }, 'All'), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => all(grp, false) }, 'None'))))));
      const fitSel = h('select', { class: 'input', 'aria-label': 'Cards per page', style: { width: 'auto' }, onchange: () => { cardPrefs.fit = fitSel.value; saveCardPrefs(); update(); } },
        [['std', 'Standard size cards, as many pages as needed'], ['one', 'Everyone on 1 page (cards as big as fit)']].map(([v, l]) => h('option', { value: v, selected: cardPrefs.fit === v }, l)));
      return h('div', { style: { display: 'grid', gap: '6px', width: '100%' } }, grid,
        h('div', { class: 'inline' }, h('b', { class: 'small', style: { minWidth: '190px' } }, 'Cards per page:'), fitSel), addrInUse() ? null : h('span', { class: 'hint small' }, 'Address is set to not in use (Company & Location › Contact details we keep).'));
    };
    const sel = (key, options, label) => {
      const s = h('select', { class: 'input', onchange: () => { if (key === 'layout' && s.value === 'pretty') { pw.close(); ui.tab = 'calendar'; persist(); render(); setTimeout(() => calPrintDialog(), 60); return; } // Calendar 2: the Calendar tab's own print window
        o[key] = key === 'dpi' ? +s.value : s.value; if (key === 'layout') { o.range = ONE[o.layout] || RANGES[o.layout]()[0][0]; build(); } else if (key === 'range') build(); update(); } },
        options.map(([v, l]) => h('option', { value: v, selected: String(o[key]) === String(v) }, l)));
      return h('label', { class: 'field' }, h('span', null, label), s);
    };
    function build() {
      // Calendar 1 (weeks as rows, drawn as a picture) is turned off for now: Calendar 2 (the Calendar tab's print) takes its
      // place. Its code (35-calendar-sheet.js) stays, to bring back or remove later.
      if (!RANGES[o.layout] || o.layout === 'calendar') o.layout = 'table';
      if (!RANGES[o.layout]().some(([v]) => v === o.range)) o.range = RANGES[o.layout]()[0][0];
      const deco = pfField('Decorations', decoControls(() => update()));
      // every layout fills the same frame (printFrame, 05b-print-window.js): what it does not use is greyed in its place
      if (o.layout === 'avail') {
        if (!PAPERS[o.availPaper]) o.availPaper = availPaperPref; if (!o.availFormat) o.availFormat = 'pdf';
        const ds = (key, opts, label) => { const x = h('select', { class: 'input', 'aria-label': label, onchange: () => { availDet[key] = x.value; saveAvailDet(); update(); } }, opts.map(([v, l]) => h('option', { value: v, selected: availDet[key] === v }, l))); return h('label', { class: 'field' }, h('span', null, label), x); };
        box.replaceChildren(...printFrame({
          what: sel('range', RANGES.avail(), 'What'),
          paper: [sel('availPaper', Object.entries(PAPERS).map(([k, v]) => [k, v[2]]), 'Paper size (printer stock)'), pfFixed('Orientation', 'Landscape (wide): always for this list')],
          color: ds('mode', [['color', 'Colour'], ['bw', 'Black and white (OFF in black)']], 'Print in'),
          save: [sel('availFormat', [['pdf', 'PDF – one page, ready to print or send'], ['png', 'PNG – sharpest picture'], ['jpg', 'JPG – smaller file'], ['bmp', 'BMP – plain bitmap']], 'File type (for saving)'), sel('dpi', DPI_OPTIONS.filter(([v]) => v <= 1200), 'Resolution (for saving)')],
          notes: [ds('where', [['page', 'Under the list'], ['separate', 'On a page of their own'], ['off', 'Leave them out']], 'Numbered notes and details'), ds('range', AVAIL_RANGES, 'Details for (store hours, time off, events, holidays)')],
          extraTitle: 'Options for the availability list',
          extra: [h('div', { class: 'field' }, h('span', null, 'On the page'), ...[['key', 'The colour key'], ['qr', 'Contact QR codes (name and phone: scan to add to a phone)']].map(([k, l]) =>
            h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: availDet[k] !== false && (k !== 'qr' || availDet.qr), onchange: (e) => { availDet[k] = e.target.checked; saveAvailDet(); update(); } }), ' ' + l)),
            ...[['hours', 'Store hours'], ['timeoff', 'Time off'], ['events', 'Events'], ['holidays', 'Holidays']].map(([k, l]) =>
              h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: availDet.tables[k] !== false, onchange: (e) => { availDet.tables[k] = e.target.checked; saveAvailDet(); update(); } }), ` Details: ${l}`)))],
          deco }));
        return;
      }
      const NAMES = { table: 'the week table', timeline: 'the visual timeline', cards: 'contact cards' };
      box.replaceChildren(...printFrame({
        what: sel('range', RANGES[o.layout](), 'What'),
        week: o.layout === 'cards' || o.range === 'all' ? null : weekSel(),
        day: o.layout === 'timeline' && o.range === 'day' ? daySel() : null,
        paper: [sel('paper', Object.entries(PAPERS).map(([k, v]) => [k, v[2]]), 'Paper size'), sel('orient', [['landscape', 'Landscape (wide)'], ['portrait', 'Portrait (tall)']], 'Orientation')],
        save: [sel('format', [['pdf', 'PDF – all pages in one file'], ['png', 'PNG – sharpest picture'], ['jpg', 'JPG – smaller file'], ['bmp', 'BMP – plain bitmap'], ['svg', 'SVG – vector, any size']], 'File type (for saving)'), sel('dpi', DPI_OPTIONS, 'Resolution (for saving)')],
        notes: pfField('Numbered notes and details', notesWhereSel()),
        lines: h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.notes, onchange: (e) => { o.notes = e.target.checked; update(); } }), ' Notes area with lines'),
        extraTitle: 'Options for ' + NAMES[o.layout],
        extra: [o.layout === 'timeline' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.coverage, onchange: (e) => { o.coverage = e.target.checked; update(); } }), ' “People on the floor” chart') : null,
          o.layout === 'cards' ? cardChecks() : null,
          o.layout === 'cards' ? h('button', { type: 'button', class: 'btn', title: 'Put these contact QR codes in the shared barcode library, for Insert › Barcode in the other Craft apps', onclick: () => cardsToLibrary(cardPeople(o.range)) }, 'Add to barcode library') : null],
        deco }));
    }
    const pageSize = () => { let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw]; return [pw, ph]; };
    let pw = null;
    const update = () => { pw && pw.refresh(); };
    // the preview: the pages as they will print (the first few), and what saving makes
    const drawPv = (pv) => {
      if (o.layout === 'avail') { pv.replaceChildren(pagePrev); pagePrev.style.display = ''; pagePrev.style.width = pvWidth(pv) + 'px'; pagePrev.style.flex = 'none'; showPage(); return `Schedule Availability and Contact Information: everyone with phone numbers, the positions they are trained in and Monday to Sunday, on one ${PAPERS[o.availPaper || 'letter'][2].replace(/ in$/, ' in')} landscape page (bigger paper, bigger print). Save makes a ${(o.availFormat || 'pdf').toUpperCase()} at ${o.dpi} DPI.`; }
      const [pw2, ph] = pageSize();
      const n = items().length, W = Math.round(pw2 * o.dpi), H = Math.round(ph * o.dpi);
      const big = o.format !== 'svg' && o.format !== 'pdf' && tooBig(W, H);
      const mb = (W * H * (o.format === 'bmp' ? 3 : o.format === 'png' ? 0.12 : 0.15)) / 1e6;
      let text = o.format === 'svg'
        ? `${n} page${n > 1 ? 's' : ''} · SVG vector · prints sharp at any size and DPI · ${pw2} × ${ph} in`
        : o.format === 'pdf' ? `${n} page${n > 1 ? 's' : ''} · one PDF, ${pw2} × ${ph} in pages, pictures at ${Math.min(o.dpi, 600)} DPI`
        : big ? `At ${o.dpi} DPI a page would be ${W.toLocaleString()} × ${H.toLocaleString()} pixels, more than a browser can make into a ${o.format.toUpperCase()}: it will be saved as SVG instead (sharp at ${o.dpi} DPI or any other).`
          : `${n} page${n > 1 ? 's' : ''} · ${W.toLocaleString()} × ${H.toLocaleString()} pixels each · about ${mb < 1 ? '<1' : Math.round(mb)} MB each${o.dpi >= 1200 ? ' · this can take a while' : ''}`;
      if (o.layout === 'cards') { const info = cardQrInfo(pw2, ph, cardPeople(o.range)); if (info) text += ' · ' + info; }
      if (whereFor() === 'separate') text += ' · then the numbered notes on a page of their own';
      // the first few pages (and the notes page), drawn small
      const book = noteBook(), w = whereFor(), list = items(), show = list.slice(0, 4).map((it) => draw(it, { ...o, dpi: 90, vector: false, numbered: w, book }));
      if (w === 'separate' && book.list.length && list.length <= 4) show.push(...drawNotesPages(book, { ...o, dpi: 90, vector: false }));
      pvPictures(pv, show, list.length + (w === 'separate' && book.list.length ? drawNotesPages(book, { ...o, dpi: 20, vector: false }).length : 0));
      return text;
    };
    build();
    pw = printWindow({ title: 'Print or save', kind: o.layout, onKind: (k) => { if (!['table', 'timeline', 'avail', 'cards'].includes(k)) return false; o.layout = k; o.range = ONE[o.layout] || RANGES[o.layout]()[0][0]; build(); update(); return true; }, use: o.layout === 'timeline' ? 'hourly' : 'week', reopen: () => exportImageDialog(preset), opts: [box], draw: drawPv,
      actions: [{ label: 'Cancel' },
        { label: 'Print…', onClick: () => { remember(); if (o.layout === 'avail') { setTimeout(() => printAvailability(false, o.availPaper)); return; } printSurfaces(allPages({ ...o, dpi: 300, vector: true }), o); } },
        { label: 'Save', primary: true, onClick: () => {
          remember();
          if (o.layout === 'avail') { saveAvailability(o); return; }
          if (o.format === 'pdf') { const [pw2, ph] = pageSize(), list = items(); savePrintout({ name: list.length === 1 ? nameOf(list[0]) : `${nameOf(list[0])} and on`, pw: pw2, ph, o, canvases: async (d, vector) => allPages({ ...o, dpi: d, vector: !!vector }) }); return; }
          (async () => {
            const list = items(), book = noteBook(), w = whereFor();
            toast(`Making ${list.length} file${list.length > 1 ? 's' : ''}…`);
            const files = [];
            let switched = false;
            const drawJob = (it, opts) => draw(it, { ...opts, numbered: w, book });
            for (const it of list) {
              const [pw, ph] = pageSize();
              let vector = o.format === 'svg' || tooBig(Math.round(pw * o.dpi), Math.round(ph * o.dpi));
              let blob = null;
              if (!vector) { try { blob = await canvasBlob(drawJob(it, o), o); } catch (e) { vector = true; } }
              if (vector) { blob = await canvasBlob(drawJob(it, { ...o, vector: true }), o); if (o.format !== 'svg') switched = true; }
              const ext = vector ? 'svg' : o.format;
              files.push({ name: `${nameOf(it)}.${ext}`, blob, type: { description: ext.toUpperCase() + ' image', accept: { [ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/' + ext]: ['.' + ext] } } });
            }
            // the notes page(s): made after the sheets, so the list has every number
            if (w === 'separate' && book.list.length) {
              const [pw, ph] = pageSize(), vector = o.format === 'svg' || tooBig(Math.round(pw * o.dpi), Math.round(ph * o.dpi));
              const pages = drawNotesPages(book, { ...o, vector });
              for (let k = 0; k < pages.length; k++) { const ext = vector ? 'svg' : o.format, blob = await canvasBlob(pages[k], o); files.push({ name: `${nameOf(list[0])} notes${pages.length > 1 ? ' ' + (k + 1) : ''}.${ext}`, blob, type: { description: ext.toUpperCase() + ' image', accept: { [ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/' + ext]: ['.' + ext] } } }); }
            }
            const n = await saveMany(files);
            if (n) toast((n === 1 ? `Saved ${files[0].name}` : `Saved ${n} files`) + (switched ? ' (as SVG vector, because that DPI is too large for a picture file)' : ''));
          })();
        } }] });
    function remember() { try { localStorage.setItem(KEY + '-img', JSON.stringify(o)); } catch (e) { /* ignore */ } }
  }

