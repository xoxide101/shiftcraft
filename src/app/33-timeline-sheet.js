  // ===================================================================
  // Visual timeline sheet: bars for every shift plus "people on the floor"
  // ===================================================================
  const PRINT_COLORS = { mgr: '#5b6675', sup: '#1d3f78', tm: '#2a7fd4', trn: '#1f8a5c' };
  // A week of timelines on one page: each day's timeline page drawn small (from a 7 × 5 in layout, so its text stays as
  // big as it can) in a 3 × 3 grid, the week's dates as the title; for reviewing the week at a glance
  function drawWeekTiles(start, o) {
    let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi), H = Math.round(ph * dpi), c = makeSurface(W, H, { ...o, vector: false }), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const M = 0.3 * dpi, GAP = 0.12 * dpi, TOP = 0.42 * dpi, days = weekDays(weekOf(start));
    g.fillStyle = '#000'; g.font = `700 ${(14 / 72) * dpi}px Arial, Helvetica, sans-serif`; g.textBaseline = 'alphabetic';
    g.fillText(`${[plan.company, plan.location].filter(Boolean).join(' – ') || 'Schedule'} · week of ${longDate(days[0])}`, M, M + (12 / 72) * dpi);
    const cols = 3, rows = 3, tw = (W - 2 * M - (cols - 1) * GAP) / cols, th = (H - M - TOP - M - (rows - 1) * GAP) / rows;
    // everyone working this week gets a number (in the app's groups, then by name); the tiles show the numbers and the
    // legend in the spare space says who is who, so the tiles stay uncluttered
    const ids = new Set(days.flatMap((d) => shiftsOn(d).map((s) => s.staffId)));
    const people = Object.keys(ROLES).flatMap((rk) => plan.staff.filter((p) => ids.has(p.id) && p.role === rk).sort((a, b) => a.name.localeCompare(b.name)));
    const numbers = new Map(people.map((p, i) => [p.id, i + 1]));
    days.forEach((d, i) => {
      const tile = drawDaySheet(d, { ...o, pageIn: [7, 5], dpi: (tw / 7), vector: false, coverage: o.coverage, notes: false, numbers });
      const x = M + (i % cols) * (tw + GAP), y = M + TOP + Math.floor(i / cols) * (th + GAP), k = Math.min(tw / tile.width, th / tile.height);
      g.drawImage(tile, x, y, tile.width * k, tile.height * k);
      g.strokeStyle = '#999'; g.lineWidth = Math.max(1, dpi / 150); g.strokeRect(x, y, tile.width * k, tile.height * k);
    });
    // the legend: in the two spare tiles at the bottom right, in columns
    const lx = M + (tw + GAP), ly = M + TOP + 2 * (th + GAP), lw = 2 * tw + GAP, lh = th;
    g.strokeStyle = '#999'; g.strokeRect(lx, ly, lw, lh);
    // the list in GM / AGM / SM / TM / NH, each under its own heading (a heading never sits alone at the foot of a column)
    const lines = []; Object.entries(ROLES).forEach(([rk, r]) => { const list = people.filter((p) => p.role === rk); if (list.length) { lines.push({ head: `${r.short} · ${r.label}${list.length > 1 ? 's' : ''}` }); list.forEach((p) => lines.push({ p })); } });
    const perCol = Math.max(2, Math.ceil(lines.length / 3) + 1), fs = Math.min((10 / 72) * dpi, lh / (perCol + 2.2)), colW = lw / 3;
    g.fillStyle = '#000'; g.font = `700 ${fs}px Arial, Helvetica, sans-serif`; g.fillText('Who is who', lx + fs * 0.8, ly + fs * 1.4);
    let col = 0, rowN = 0;
    lines.forEach((ln) => {
      if (rowN >= perCol || (ln.head && rowN >= perCol - 1)) { col++; rowN = 0; }
      const cx = lx + fs * 0.8 + col * colW, cy = ly + fs * 2.9 + rowN * fs * 1.25; rowN++;
      if (ln.head) { g.font = `700 ${fs * 0.92}px Arial, Helvetica, sans-serif`; g.fillStyle = '#444'; g.fillText(ln.head, cx, cy); g.fillStyle = '#000'; return; }
      const p = ln.p;
      g.font = `700 ${fs}px Arial, Helvetica, sans-serif`; g.fillStyle = '#000'; g.textAlign = 'right'; g.fillText(String(numbers.get(p.id)), cx + fs * 1.4, cy); g.textAlign = 'left';
      g.font = `400 ${fs}px Arial, Helvetica, sans-serif`; let nm = p.name; while (nm.length > 3 && g.measureText(nm).width > colW - fs * 2.6) nm = nm.slice(0, -2) + '…';
      g.fillText(nm, cx + fs * 1.9, cy);
    });
    if (!people.length) { g.font = `400 ${fs}px Arial, Helvetica, sans-serif`; g.fillText('No one is scheduled this week.', lx + fs * 0.8, ly + fs * 2.9); }
    return c;
  }
  function drawDaySheet(d, o) {
    let [pw, ph] = o.pageIn || PAPERS[o.paper];
    if (!o.pageIn && o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi), H = Math.round(ph * dpi);
    const c = makeSurface(W, H, o);
    const g = c.getContext('2d');
    const pt = (n) => n / 72 * dpi, inch = (n) => n * dpi;
    const font = (size, weight = '400') => `${weight} ${pt(size)}px Arial, Helvetica, sans-serif`;
    const text = (s, x, y, align = 'left', size = 9, weight = '400', col = '#000', maxW) => {
      g.font = font(size, weight); g.fillStyle = col; g.textAlign = align;
      let str = String(s);
      if (maxW) while (str.length > 1 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…';
      g.fillText(str, x, y); g.textAlign = 'left';
      return g.measureText(str).width;
    };
    const line = (x1, y1, x2, y2, wpt, col) => { g.strokeStyle = col; g.lineWidth = pt(wpt); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const M = inch(0.45), CW = W - 2 * M;
    let y = M + pt(18);
    const f = forecastOf(d), t = targetHours(d), v = varianceHours(d);
    const totals = `Scheduled ${hrs(dayHours(d))} h  ·  Forecast ${money(f)}  ·  Target ${t == null ? '—' : hrs(t)} h  ·  Variance ${v == null ? '—' : signed(v)} h`;
    if (o.numbers) { y -= pt(4); text(longDate(d), M, y, 'left', 16, '700'); y += pt(13); text(totals, M, y, 'left', 9.5, '400', '#333'); } // a tile: the page has the company's name
    else {
      text([plan.company, plan.location].filter(Boolean).join(' – ') || 'Schedule', M, y, 'left', 18, '700');
      text(totals, W - M, y, 'right', 10, '400', '#333');
      y += pt(20);
      text(longDate(d), M, y, 'left', 14, '700');
      if (placeLine()) text(placeLine(), W - M, y, 'right', 9, '400', '#444');
    }
    y += pt(12);

    // Who is working, grouped like the app
    const rows = [];
    GROUPS.forEach(([gk, label]) => {
      const by = new Map(); shiftsOn(d).forEach((s) => { const p = staffById(s.staffId); if (p && ROLES[p.role].group === gk) { if (!by.has(p.id)) by.set(p.id, { p, ss: [] }); by.get(p.id).ss.push(s); } });
      const list = [...by.values()].map((x) => ({ ...x, ss: x.ss.sort((a, b) => a.start - b.start), s: x.ss[0] })).sort((a, b) => a.s.start - b.s.start || a.p.name.localeCompare(b.p.name));
      if (!list.length) return;
      rows.push({ t: 'g', label, n: list.length, h: list.reduce((a, x) => a + x.ss.reduce((t, s) => t + len(s), 0), 0) });
      list.forEach((x) => rows.push({ t: 'p', ...x, gk }));
    });
    const nameW = CW * (o.numbers ? 0.07 : 0.17), x0 = M + nameW, x1 = M + CW;
    const span = DAY_END - DAY_START, xAt = (m) => x0 + (m - DAY_START) / span * (x1 - x0);
    const headH = pt(18), covH = o.coverage === false ? 0 : inch(o.numbers ? 0.8 : 1.25);
    const noteList = notesFor([d]);
    let notesH = o.notes || noteList.length ? Math.max(inch(0.9), inch(0.3) * (noteList.length + 1.5)) : 0;
    let avail = H - M - y - headH - covH - notesH - inch(0.2);
    const n = Math.max(1, rows.length);
    let rowH = Math.min(inch(0.38), avail / n);
    if (rowH < inch(0.2) && notesH && !noteList.length) { notesH = 0; avail = H - M - y - headH - covH - inch(0.2); rowH = Math.min(inch(0.38), avail / n); }
    const barPt = Math.max(6, Math.min(10, rowH / dpi * 72 * 0.45));
    const top = y;
    // Hour labels
    g.fillStyle = '#222'; g.fillRect(M, y, CW, headH);
    text('Name', M + pt(5), y + headH * 0.7, 'left', 8.5, '700', '#fff');
    for (let m = DAY_START; m < DAY_END; m += 60) text(hourLabel(m), xAt(m) + pt(3), y + headH * 0.7, 'left', 8, '700', '#fff');
    y += headH;
    const gridTop = y;
    rows.forEach((r) => {
      if (r.t === 'g') {
        g.fillStyle = '#e6e6e6'; g.fillRect(M, y, CW, rowH);
        text(`${r.label}  (${r.n} · ${hrs(r.h)} h)`, M + pt(5), y + rowH * 0.66, 'left', barPt, '700');
      } else {
        if (o.numbers) text(String(o.numbers.get(r.p.id) || '?'), x0 - pt(5), y + rowH * 0.66, 'right', barPt, '700', '#000');
        else { text(r.p.name, M + pt(5), y + rowH * 0.66, 'left', barPt, '700', '#000', nameW - pt(26)); text(ROLES[r.p.role].short, x0 - pt(4), y + rowH * 0.66, 'right', barPt - 1.5, '400', '#555'); }
        r.ss.forEach((sh) => {
          const bx = xAt(sh.start), bw = xAt(sh.end) - bx, by = y + rowH * 0.14, bh = rowH * 0.72;
          g.fillStyle = PRINT_COLORS[r.gk] || '#2a7fd4';
          g.beginPath(); (g.roundRect ? g.roundRect(bx, by, bw, bh, pt(2)) : g.rect(bx, by, bw, bh)); g.fill();
          const label = `${clock(sh.start, true)}–${clock(sh.end, true)}  ${hrs(len(sh))} h${sh.note ? '   Note: ' + sh.note : ''}`;
          text(label, bx + pt(4), by + bh * 0.68, 'left', barPt, '700', '#fff', bw - pt(6));
          if (availIssue(r.p, d, sh)) text('!', bx + bw - pt(4), by + bh * 0.7, 'right', barPt, '700', '#ffd34d');
        });
      }
      y += rowH;
      line(M, y, x1, y, 0.4, '#bbb');
    });
    if (!rows.length) { text('Nobody is scheduled on this day.', x0 + pt(8), y + pt(20), 'left', 11, '400', '#666'); y += pt(30); }
    // Grid: hours and half hours
    for (let m = DAY_START; m <= DAY_END; m += 30) line(xAt(m), gridTop, xAt(m), y, m % 60 ? 0.3 : 0.6, m % 60 ? '#e2e2e2' : '#aaa');
    line(x0, top, x0, y, 0.8, '#000');
    g.strokeStyle = '#000'; g.lineWidth = pt(1); g.strokeRect(M, top, CW, y - top);

    // People on the floor, every 15 minutes
    if (covH) {
      y += inch(0.22);
      text('People on the floor', M, y + pt(4), 'left', 10, '700');
      const slots = [];
      for (let m = DAY_START; m < DAY_END; m += STEP) slots.push(shiftsOn(d).filter((s) => s.start <= m && s.end > m).length);
      const max = Math.max(1, ...slots);
      const cy = y + pt(10), ch = covH - pt(26);
      g.fillStyle = '#dbe7f6'; g.strokeStyle = '#2a64b8'; g.lineWidth = pt(1.2);
      g.beginPath(); g.moveTo(x0, cy + ch);
      slots.forEach((n, i) => { const xa = xAt(DAY_START + i * STEP), xb = xAt(DAY_START + (i + 1) * STEP), yy = cy + ch - n / max * ch; g.lineTo(xa, yy); g.lineTo(xb, yy); });
      g.lineTo(x1, cy + ch); g.closePath(); g.fill(); g.stroke();
      line(x0, cy + ch, x1, cy + ch, 0.8, '#000');
      for (let m = DAY_START; m < DAY_END; m += 60) {
        line(xAt(m), cy, xAt(m), cy + ch, 0.3, '#ccc');
        const n = slots[(m - DAY_START) / STEP];
        text(String(n), xAt(m + 30), cy + ch + pt(10), 'center', 8, '700', n ? '#000' : '#999');
      }
      text(`max ${max}`, x0 - pt(4), cy + pt(8), 'right', 8, '400', '#555');
      text('0', x0 - pt(4), cy + ch, 'right', 8, '400', '#555');
      text('count at each hour', M, cy + ch + pt(10), 'left', 7.5, '400', '#555');
      y = cy + ch + pt(14);
    }
    if (notesH) {
      y += inch(0.18);
      drawNotes(text, line, noteList, M, CW, y, H - M, inch, pt, 0.3);
    }
    return c;
  }
