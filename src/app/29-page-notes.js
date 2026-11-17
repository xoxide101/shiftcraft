  // ===================================================================
  // Notes on printed pages: numbered
  // ===================================================================
  // On screen colours and chips tell things apart (special store hours, events, time off and requests, notes on shifts).
  // Printed, the sheet carries small numbers instead (¹ ²) and a numbered list says what each one is. Where the list goes
  // is one choice for every printout (notesWhere, kept in this browser):
  //   'page'     under the sheet, numbered from 1 on each page
  //   'separate' on its own page after the sheets, one list for the whole printout (a number means the same on every page)
  //   'off'      no numbers and no list
  const NOTES_WHERE_KEY = KEY + '-print-notes';
  const NOTES_WHERE = [['page', 'Numbered notes under the sheet'], ['separate', 'Numbered notes on a separate page'], ['off', 'No numbered notes']];
  let notesWhere = 'page';
  try { const v = localStorage.getItem(NOTES_WHERE_KEY); if (NOTES_WHERE.some(([k]) => k === v)) notesWhere = v; } catch (e) { /* blocked */ }
  const setNotesWhere = (v) => { notesWhere = v; try { localStorage.setItem(NOTES_WHERE_KEY, v); } catch (e) { /* blocked */ } };
  const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const supNum = (n) => String(n).replace(/\d/g, (c) => SUPS[c]);
  const supList = (ns) => (ns && ns.length ? ' ' + ns.map(supNum).join(',') : '');
  // the numbers given out for one printout (or one page)
  function noteBook() {
    const keys = new Map(), list = [];
    return { list, add(key, text) { if (!keys.has(key)) { list.push({ n: list.length + 1, text }); keys.set(key, list.length); } return keys.get(key); } };
  }
  // the texts, the same wherever they are printed
  const noteSpecial = (sp) => `${datesOnly(sp)} · ${sp.name || 'Special store hours'}: store ${sp.closed ? 'closed all day' : `open ${clock(sp.open)} – ${clock(sp.close)}`}${sp.note ? ' — ' + sp.note : ''}`;
  const noteEvent = (x) => `${datesOnly(x)}${x.hours ? `, ${clock(x.hours[0])} – ${clock(x.hours[1])}` : ''} · ${x.title}${x.note ? ' — ' + x.note : ''}`;
  const noteTimeOff = (p, t) => `${timeOffWhen(t)} · ${p.name}: ${timeOffLabel(t).toLowerCase()}${t.note ? ' — ' + t.note : ''}`;
  const noteKey = { sp: (x) => 'sp' + x.id, ev: (x) => 'ev' + x.id, to: (p, t) => 'to' + (t.id || p.id + t.from) };
  // numbers for some days: special store hours and events (on the day), time off (on the person and day), notes on shifts
  // o.book: share the numbers across pages; o.numbered: where the list goes (notesWhere when not given)
  // on paper: a closed day has nobody on it (onPaper, 04-calculations.js)
  const notesFor = onPaper(notesForBody);
  function notesForBody(days, o = {}) {
    const where = o.numbered || notesWhere, book = o.book || noteBook(), on = where !== 'off';
    const dayN = new Map(), personN = new Map(), shiftN = new Map(), mine = new Set();
    const take = (key, text) => { const n = book.add(key, text); mine.add(n); return n; };
    const push = (m, k, n) => { if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(n)) m.get(k).push(n); };
    if (on) days.forEach((d) => {
      const sp = specialOn(d);
      if (sp) push(dayN, d, take(noteKey.sp(sp), noteSpecial(sp)));
      eventsOn(d).forEach((x) => push(dayN, d, take(noteKey.ev(x), noteEvent(x))));
      plan.staff.filter((p) => !p.left).forEach((p) => timeOffOn(p, d).forEach((t) => push(personN, p.id + '|' + d, take(noteKey.to(p, t), noteTimeOff(p, t)))));
      shiftsOn(d).filter((s) => s.note).sort((a, b) => a.start - b.start).forEach((s) => {
        const p = staffById(s.staffId);
        shiftN.set(s, take('sh' + (s.id || d + s.staffId + s.start), `${dayName(d, 'short')} ${usDate(d).slice(0, 5)} · ${p ? p.name : '?'} (${clock(s.start)}–${clock(s.end)}): ${s.note}`));
      });
    });
    return {
      book, on, where,
      // the list to print with this page (empty when it goes on its own page or is left out)
      list: where === 'page' ? [...mine].sort((a, b) => a - b).map((n) => book.list[n - 1]) : [],
      day: (d) => supList(dayN.get(d)), person: (id, d) => supList(personN.get(id + '|' + d)), personHas: (id, d) => personN.has(id + '|' + d),
      shift: (s) => (shiftN.has(s) ? ' ' + supNum(shiftN.get(s)) : ''),
    };
  }
  // Writes the notes on ruled lines, then leaves the rest of the lines blank for handwriting.
  function drawNotes(text, line, list, M, CW, y, bottom, inch, pt, gap = 0.3) {
    text('Notes', M, y + pt(10), 'left', 11, '700');
    let ly = y + inch(0.45);
    list.forEach((n) => {
      if (ly > bottom) return;
      text(`${n.n}.`, M + pt(16), ly - pt(4), 'right', 9, '700');
      text(n.text, M + pt(22), ly - pt(4), 'left', 9, '400', '#000', CW - pt(25));
      line(M, ly, M + CW, ly, 0.5, '#bbb');
      ly += inch(gap);
    });
    for (; ly < bottom; ly += inch(gap)) line(M, ly, M + CW, ly, 0.5, '#bbb');
  }
  // the separate notes page(s) after the sheets: the whole printout's list, as many pages as it takes
  // on paper: a closed day has nobody on it (onPaper, 04-calculations.js)
  const drawNotesPages = onPaper(drawNotesPagesBody);
  function drawNotesPagesBody(book, o) {
    let [pw, ph] = PAPERS[o.paper] || PAPERS.letter;
    if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi), H = Math.round(ph * dpi), gap = 0.3, M = decoMargin(0.45) * dpi;
    const per = Math.max(1, Math.floor((H - 2 * M - 0.9 * dpi) / (gap * dpi)) - 1), pages = [];
    for (let k = 0; k * per < book.list.length || k === 0; k++) {
      const c = makeSurface(W, H, o), g = c.getContext('2d');
      const pt = (n) => n / 72 * dpi, inch = (n) => n * dpi;
      const text = (s, x, y, align = 'left', size = 9, weight = '400', col = '#000', maxW) => {
        g.font = `${weight} ${pt(size)}px Arial, Helvetica, sans-serif`; g.fillStyle = col; g.textAlign = align;
        let str = String(s); if (maxW) while (str.length > 1 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…';
        g.fillText(str, x, y); g.textAlign = 'left';
      };
      const line = (x1, y1, x2, y2, wpt, col) => { g.strokeStyle = col; g.lineWidth = pt(wpt); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      const n = Math.ceil(book.list.length / per);
      headLine(g, M, W - M, M + pt(18), { s: sheetName(), px: pt(18), weight: '700' }, { s: `Notes for the pages before${n > 1 ? ` · ${k + 1} of ${n}` : ''}`, px: pt(10) });
      drawNotes(text, line, book.list.slice(k * per, (k + 1) * per), M, W - 2 * M, M + pt(34), H - M, inch, pt, gap);
      pages.push(c);
    }
    return pages;
  }
