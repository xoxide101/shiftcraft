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
    const box = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' } });
    const size = h('p', { class: 'hint' });
    const preview = h('img', { alt: 'Preview', style: { width: '100%', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff' } });
    // the availability list's preview: the real sheet on a white landscape page, scaled down to fit the window
    const pagePrev = h('div', { 'aria-label': 'Print preview', style: { display: 'none', position: 'relative', overflow: 'hidden', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,.25)' } });
    const showPage = () => {
      const pg = availPaper(o.availPaper), PW = Math.round(pg.W * 96), PH = Math.round(pg.H * 96), sh = availabilitySheet(); fitAvailability(sh, pg);
      const inner = h('div', { style: { position: 'absolute', left: 0, top: 0, width: PW + 'px', height: PH + 'px', padding: '38px', boxSizing: 'border-box', background: '#fff', color: '#000', transformOrigin: '0 0', overflow: 'hidden' } }, sh);
      pagePrev.replaceChildren(inner);
      requestAnimationFrame(() => { const k = (pagePrev.clientWidth || 600) / PW; inner.style.transform = `scale(${k})`; pagePrev.style.height = PH * k + 'px'; });
    };
    const checks = h('div', { class: 'inline' });
    const curWeek = () => weekDays(weekOf(PD))[0];
    const items = () => {
      if (o.layout === 'timeline') return o.range === 'day' ? [PD] : o.range === 'weektile' ? [weekDays(weekOf(PD))[0]] : o.range === 'week' ? weekDays(weekOf(PD)) : planDays();
      if (o.layout === 'calendar') return [o.range === 'all' ? { start: plan.startDate, weeks: plan.weeks } : { start: curWeek(), weeks: { week: 1, two: 2, month: 4 }[o.range] || 1 }];
      if (o.layout === 'cards') { const [pw, ph] = pageSize(), ppl = cardPeople(o.range), [cc, rr] = cardGrid(pw, ph, ppl.length), per = cc * rr, pages = Math.max(1, Math.ceil(ppl.length / per)); return Array.from({ length: pages }, (_, k) => ({ people: ppl.slice(k * per, (k + 1) * per), page: k + 1, pages, total: ppl.length })); }
      return o.range === 'all' ? Array.from({ length: plan.weeks }, (_, k) => k) : [weekOf(PD)];
    };
    const draw = (item, opts) => (o.layout === 'cards' ? drawContactCards(item, opts) : o.layout === 'timeline' ? (o.range === 'weektile' ? drawWeekTiles(item, opts) : drawDaySheet(item, opts)) : o.layout === 'calendar' ? drawCalendarSheet(item, opts) : drawWeekSheet(item, opts));
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
      const s = h('select', { class: 'input', onchange: () => { o[key] = key === 'dpi' ? +s.value : s.value; if (key === 'layout') { o.range = ONE[o.layout] || RANGES[o.layout]()[0][0]; build(); } else if (key === 'range') build(); update(); } },
        options.map(([v, l]) => h('option', { value: v, selected: String(o[key]) === String(v) }, l)));
      return h('label', { class: 'field' }, h('span', null, label), s);
    };
    function build() {
      if (!RANGES[o.layout]) o.layout = 'table';
      if (!RANGES[o.layout]().some(([v]) => v === o.range)) o.range = RANGES[o.layout]()[0][0];
      if (o.layout === 'avail') { if (!PAPERS[o.availPaper]) o.availPaper = availPaperPref; box.replaceChildren(sel('layout', [['table', 'Week table (names × days)'], ['timeline', 'Visual timeline (bars, one page per day)'], ['calendar', 'Calendar (weeks as rows)'], ['avail', 'Availability and contact list (phones, positions, days)'], ['cards', 'Contact cards with QR codes (scan to add to a phone)']], 'Layout'), sel('availPaper', Object.entries(PAPERS).map(([k, v]) => [k, v[2].replace(/ in$/, ' in, landscape')]), 'Paper (printer stock)'), sel('availFormat', [['pdf', 'PDF – one page, ready to print or send'], ['png', 'PNG – sharpest picture'], ['jpg', 'JPG – smaller file'], ['bmp', 'BMP – plain bitmap']], 'File type (for saving)'), sel('dpi', DPI_OPTIONS.filter(([v]) => v <= 1200), 'Resolution (for saving)')); if (!o.availFormat) o.availFormat = 'pdf'; checks.replaceChildren(notesWhereSel()); return; }
      // (nulls left out: replaceChildren would write them as the word “null”)
      box.replaceChildren(...[
        sel('layout', [['table', 'Week table (names × days)'], ['timeline', 'Visual timeline (bars, one page per day)'], ['calendar', 'Calendar (weeks as rows)'], ['avail', 'Availability and contact list (phones, positions, days)'], ['cards', 'Contact cards with QR codes (scan to add to a phone)']], 'Layout'),
        sel('range', RANGES[o.layout](), 'What'),
        o.layout === 'cards' || o.range === 'all' ? null : weekSel(),
        o.layout === 'timeline' && o.range === 'day' ? daySel() : null,
        sel('paper', Object.entries(PAPERS).map(([k, v]) => [k, v[2]]), 'Paper size'),
        sel('orient', [['landscape', 'Landscape (wide)'], ['portrait', 'Portrait (tall)']], 'Orientation'),
        sel('format', [['png', 'PNG – sharpest picture'], ['jpg', 'JPG – smaller file'], ['bmp', 'BMP – plain bitmap'], ['svg', 'SVG – vector, any size']], 'File type (for saving)'),
        sel('dpi', DPI_OPTIONS, 'Resolution (for saving)')].filter(Boolean));
      checks.replaceChildren(...[
        notesWhereSel(),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.notes, onchange: (e) => { o.notes = e.target.checked; update(); } }), ' Notes area with lines'),
        o.layout === 'timeline' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: o.coverage, onchange: (e) => { o.coverage = e.target.checked; update(); } }), ' “People on the floor” chart') : null,
        o.layout === 'cards' ? cardChecks() : null,
        o.layout === 'cards' ? h('button', { type: 'button', class: 'btn', title: 'Put these contact QR codes in the shared barcode library, for Insert › Barcode in the other Craft apps', onclick: () => cardsToLibrary(cardPeople(o.range)) }, 'Add to barcode library') : null].filter(Boolean));
    }
    const pageSize = () => { let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw]; return [pw, ph]; };
    const update = () => {
      preview.style.display = o.layout === 'avail' ? 'none' : ''; pagePrev.style.display = o.layout === 'avail' ? '' : 'none';
      if (o.layout === 'avail') { showPage(); size.className = 'hint'; size.textContent = `Schedule Availability and Contact Information: everyone with phone numbers, the positions they are trained in and Monday to Sunday, on one ${PAPERS[o.availPaper || 'letter'][2].replace(/ in$/, ' in')} landscape page (bigger paper, bigger print). Print sends it straight to the printer (choose the same paper there); Save makes a ${(o.availFormat || 'pdf').toUpperCase()} at ${o.dpi} DPI.`; return; }
      const [pw, ph] = pageSize();
      const n = items().length, W = Math.round(pw * o.dpi), H = Math.round(ph * o.dpi);
      const big = o.format !== 'svg' && tooBig(W, H);
      const mb = (W * H * (o.format === 'bmp' ? 3 : o.format === 'png' ? 0.12 : 0.15)) / 1e6;
      size.textContent = o.format === 'svg'
        ? `${n} page${n > 1 ? 's' : ''} · SVG vector · prints sharp at any size and DPI${o.layout === 'calendar' ? ' · page grows to fit' : ` · ${pw} × ${ph} in`}`
        : big
          ? `At ${o.dpi} DPI a page would be ${W.toLocaleString()} × ${H.toLocaleString()} pixels (${(W * H / 1e9).toFixed(1)} billion), more than a browser can make into a ${o.format.toUpperCase()}. It will be saved as SVG instead: a vector file that prints sharp at ${o.dpi} DPI or any other.`
          : `${n} page${n > 1 ? 's' : ''} · ${W.toLocaleString()} × ${H.toLocaleString()} pixels${o.layout === 'calendar' ? ' (taller when there are many weeks)' : ' each'} · about ${mb < 1 ? '<1' : Math.round(mb)} MB each${o.dpi >= 1200 ? ' · this can take a while' : ''}`;
      size.className = big ? 'hint warn' : 'hint';
      if (o.layout === 'cards') { const info = cardQrInfo(pw, ph, cardPeople(o.range)); if (info) { size.textContent += ' · ' + info; if (/small:/.test(info)) size.className = 'hint warn'; } }
      if (whereFor() === 'separate') size.textContent += ' · then the numbered notes on a page of their own';
      preview.src = draw(items()[0], { ...o, dpi: 60, vector: false, numbered: whereFor() }).toDataURL();
    };
    build();
    modal({ title: { timeline: 'Visual timeline: print or save', calendar: 'Calendar: print or save' }[o.layout] || 'Print or save as image', wide: true, body: [box, checks, size, preview, pagePrev],
      actions: [{ label: 'Cancel' },
        { label: 'Print', onClick: () => { remember(); if (o.layout === 'avail') { setTimeout(() => printAvailability(false, o.availPaper)); return; } printSurfaces(allPages({ ...o, dpi: 300, vector: true }), o); } },
        { label: 'Save', primary: true, onClick: () => {
          remember();
          if (o.layout === 'avail') { saveAvailability(o); return; }
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
    update();
  }

