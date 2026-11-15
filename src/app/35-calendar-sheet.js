  // ===================================================================
  // Calendar sheet: weeks as rows, Monday–Sunday as columns
  // ===================================================================
  function drawCalendarSheet(item, o) {
    const { start, weeks } = item;
    let [pw, ph] = PAPERS[o.paper];
    if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi);
    const pt = (v) => v / 72 * dpi, inch = (v) => v * dpi;
    const M = inch(0.4), CW = W - 2 * M;
    const weekW = CW * 0.1, dayW = (CW - weekW) / 7;
    const entryPt = Math.max(6, Math.min(8.5, dayW / dpi * 72 / 15.5));
    const lineH = pt(entryPt * 1.38);
    const dayHeadH = pt(entryPt * 2.1), dayFootH = pt(entryPt * 1.7);
    const shortName = (p) => { const parts = p.name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]; };
    const nb = notesFor(daysFrom(start, weeks * 7), o), noteList = nb.list;
    const rowsData = Array.from({ length: weeks }, (_, k) => {
      const days = daysFrom(addDays(start, k * 7), 7);
      const lists = days.map((d) => shiftsOn(d).map((s) => ({ s, p: staffById(s.staffId) }))
        .sort((a, b) => GROUPS.findIndex((g) => g[0] === ROLES[a.p.role].group) - GROUPS.findIndex((g) => g[0] === ROLES[b.p.role].group) || a.s.start - b.s.start)
        // and who has time off (not working), each with the number of their note
        .concat(nb.on ? plan.staff.filter((p) => !p.left && nb.personHas(p.id, d) && !shiftsOn(d).some((s) => s.staffId === p.id)).map((p) => ({ off: true, p })) : []));
      const most = Math.max(3, ...lists.map((l) => l.length));
      return { days, lists, h: dayHeadH + most * lineH + dayFootH + pt(4) };
    });
    const titleH = pt(48), headH = pt(20), legendH = pt(26), notesH = o.notes || noteList.length ? Math.max(inch(1.1), inch(0.3) * (noteList.length + 1.5)) : 0;
    const natural = M + titleH + headH + rowsData.reduce((t, r) => t + r.h, 0) + legendH + notesH + M;
    const paperH = Math.round(ph * dpi);
    // Few weeks: stretch the rows so the calendar fills the page. Many weeks: the page grows instead.
    if (natural < paperH) rowsData.forEach((r) => { r.h += (paperH - natural) / rowsData.length; });
    const H = Math.max(paperH, Math.round(natural));
    if (!o.vector && tooBig(W, H)) throw new Error('too big');
    const c = makeSurface(W, H, o), g = c.getContext('2d');
    const font = (size, weight = '400') => `${weight} ${pt(size)}px Arial, Helvetica, sans-serif`;
    const text = (s, xx, yy, align = 'left', size = 9, weight = '400', col = '#000', maxW) => {
      g.font = font(size, weight); g.fillStyle = col; g.textAlign = align;
      let str = String(s);
      if (maxW) while (str.length > 1 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…';
      g.fillText(str, xx, yy); g.textAlign = 'left';
    };
    const line = (x1, y1, x2, y2, wpt, col) => { g.strokeStyle = col; g.lineWidth = pt(wpt); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const end = addDays(start, weeks * 7 - 1);
    let y = M + pt(20);
    text([plan.company, plan.location].filter(Boolean).join(' – ') || 'Schedule', M, y, 'left', 20, '700');
    text(`Printed ${new Date().toLocaleDateString()}`, W - M, y, 'right', 9, '400', '#444');
    y += pt(20);
    text(`${longDate(start)} – ${longDate(end)}`, M, y, 'left', 12, '700');
    if (placeLine()) text(placeLine(), W - M, y, 'right', 9, '400', '#444');
    y = M + titleH;
    // Heading row
    const top = y;
    g.fillStyle = '#222'; g.fillRect(M, y, CW, headH);
    WEEKDAYS.forEach((wd, i) => text(wd, M + i * dayW + dayW / 2, y + headH * 0.68, 'center', 9.5, '700', '#fff'));
    text('Week', M + 7 * dayW + weekW / 2, y + headH * 0.68, 'center', 9.5, '700', '#fff');
    y += headH;
    rowsData.forEach((row) => {
      row.days.forEach((d, i) => {
        const x0 = M + i * dayW;
        const outside = !planDays().includes(d);
        if (outside) { g.fillStyle = '#f6f6f6'; g.fillRect(x0, y, dayW, row.h); }
        const dt = parseIso(d);
        const num = String(dt.getDate()) + nb.day(d);
        text(num, x0 + pt(4), y + dayHeadH * 0.78, 'left', entryPt + 4, '700');
        g.font = font(entryPt + 4, '700'); const numW = g.measureText(num).width;
        if (dt.getDate() === 1 || d === start) text(dt.toLocaleDateString(undefined, { month: 'short' }), x0 + pt(8) + numW, y + dayHeadH * 0.78, 'left', entryPt, '700', '#555');
        const fc = forecastOf(d);
        if (fc != null) text(money(fc), x0 + dayW - pt(4), y + dayHeadH * 0.72, 'right', entryPt - 0.5, '400', '#666');
        let ly = y + dayHeadH + lineH * 0.75;
        row.lists[i].forEach(({ s, p, off }) => {
          if (off) { text(`${shortName(p)}  off${nb.person(p.id, d)}`, x0 + pt(10), ly, 'left', entryPt, '400', '#555', dayW - pt(13)); ly += lineH; return; }
          const gk = ROLES[p.role].group;
          g.fillStyle = PRINT_COLORS[gk]; g.fillRect(x0 + pt(4), ly - pt(entryPt * 0.72), pt(3), pt(entryPt * 0.8));
          const iss = availIssue(p, d, s);
          text(`${shortName(p)}  ${clock(s.start)}–${clock(s.end)}${iss ? ' !' : ''}${nb.shift(s)}${nb.person(p.id, d)}`, x0 + pt(10), ly, 'left', entryPt, '400', iss ? '#b00' : '#000', dayW - pt(13));
          ly += lineH;
        });
        if (row.lists[i].some((x) => !x.off)) {
          const tot = dayHours(d);
          text(`${row.lists[i].filter((x) => !x.off).length} people · ${hrs(tot)} h`, x0 + dayW - pt(4), y + row.h - pt(5), 'right', entryPt - 0.5, '700', '#333');
        }
        line(x0, y, x0, y + row.h, 0.5, '#999');
      });
      // Week summary column
      const xw = M + 7 * dayW;
      g.fillStyle = '#f1f1f1'; g.fillRect(xw, y, weekW, row.h);
      const wh = row.days.reduce((t, d) => t + dayHours(d), 0), tw = row.days.reduce((t, d) => t + (targetHours(d) || 0), 0);
      let wy = y + dayHeadH * 0.8;
      text(`${shortDate(row.days[0])}`, xw + pt(5), wy, 'left', entryPt, '700'); wy += lineH * 1.2;
      text(`${hrs(wh)} h`, xw + pt(5), wy, 'left', entryPt + 2, '700'); wy += lineH * 1.3;
      text(`Target ${hrs(tw)} h`, xw + pt(5), wy, 'left', entryPt - 0.5, '400', '#444'); wy += lineH;
      text(`Var ${signed(wh - tw)} h`, xw + pt(5), wy, 'left', entryPt - 0.5, '700', Math.abs(wh - tw) > 6 ? '#b00' : '#444');
      line(xw, y, xw, y + row.h, 1, '#000');
      y += row.h;
      line(M, y, M + CW, y, 0.8, '#666');
    });
    g.strokeStyle = '#000'; g.lineWidth = pt(1); g.strokeRect(M, top, CW, y - top);
    // Legend
    y += pt(16);
    let lx = M;
    GROUPS.forEach(([gk, label]) => { g.fillStyle = PRINT_COLORS[gk]; g.fillRect(lx, y - pt(7), pt(8), pt(8)); text(label, lx + pt(12), y, 'left', 8.5); lx += pt(12) + pt(8.5 * 0.6 * label.length) + pt(18); });
    text('! = outside availability', lx, y, 'left', 8.5, '400', '#b00');
    if (nb.on) text('¹ ² = see the numbered notes', lx + pt(120), y, 'left', 8.5, '400', '#333');
    if (notesH) {
      y += pt(18);
      drawNotes(text, line, noteList, M, CW, y, H - M, inch, pt, 0.3);
    }
    return c;
  }

