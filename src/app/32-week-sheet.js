  // ===================================================================
  // Week sheet image (for printing and marking up)
  // ===================================================================
  const PAPERS = { letter: [8.5, 11, 'Letter 8.5 × 11 in'], legal: [8.5, 14, 'Legal 8.5 × 14 in'], tabloid: [11, 17, 'Tabloid 11 × 17 in'] };
  function drawWeekSheet(w, o) {
    let [pw, ph] = PAPERS[o.paper];
    if (o.orient === 'landscape') [pw, ph] = [ph, pw];
    const dpi = o.dpi, W = Math.round(pw * dpi), H = Math.round(ph * dpi);
    const c = makeSurface(W, H, o);
    const g = c.getContext('2d');
    const pt = (n) => n / 72 * dpi, inch = (n) => n * dpi;
    const font = (size, weight = '400') => `${weight} ${pt(size)}px Arial, Helvetica, sans-serif`;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
    const M = inch(0.45), CW = W - 2 * M;
    const days = weekDays(w);
    let y = M + pt(18);
    g.font = font(20, '700'); g.fillText([plan.company, plan.location].filter(Boolean).join(' – ') || 'Schedule', M, y);
    g.font = font(10); g.textAlign = 'right'; g.fillStyle = '#444';
    g.fillText(`Printed ${new Date().toLocaleDateString()}`, W - M, y);
    if (placeLine()) g.fillText(placeLine(), W - M, y + pt(16));
    g.textAlign = 'left'; g.fillStyle = '#000';
    y += pt(20);
    g.font = font(13, '700'); g.fillText(`Week of ${longDate(days[0])} – ${longDate(days[6])}`, M, y);
    y += pt(14);

    const staff = sortStaff(plan.staff.filter((p) => p.active || days.some((d) => shiftsOn(d).some((s) => s.staffId === p.id))));
    const rows = []; let last = null;
    staff.forEach((p) => { const gk = ROLES[p.role].group; if (gk !== last) { rows.push({ t: 'g', label: GROUPS.find((x) => x[0] === gk)[1] }); last = gk; } rows.push({ t: 'p', p }); });
    const weekTotal = (fn) => days.reduce((a, d) => a + (fn(d) || 0), 0);
    const foot = [
      ['Scheduled hours', (d) => hrs(dayHours(d)), hrs(weekTotal(dayHours))],
      ['Forecast', (d) => money(forecastOf(d)), money(weekTotal(forecastOf))],
      ['Target hours', (d) => (targetHours(d) == null ? '—' : hrs(targetHours(d))), hrs(weekTotal(targetHours))],
      ['Hours variance', (d) => (varianceHours(d) == null ? '—' : signed(varianceHours(d))), signed(weekTotal(dayHours) - weekTotal(targetHours))],
    ];
    const headH = pt(30);
    const noteList = notesFor(days);
    let notesH = o.notes || noteList.length ? Math.max(inch(1.2), inch(0.32) * (noteList.length + 1.6)) : 0;
    let avail = H - M - y - notesH - headH;
    const n = rows.length + foot.length;
    let rowH = Math.min(inch(0.45), Math.max(inch(0.24), avail / Math.max(1, n)));
    if (rowH * n > avail && notesH && !noteList.length) { notesH = 0; avail = H - M - y - headH; rowH = Math.min(inch(0.45), avail / n); }
    if (rowH * n > avail) rowH = avail / n;
    if (o.notes && notesH === 0 && H - M - (y + headH + rowH * n) > inch(0.6)) notesH = H - M - (y + headH + rowH * n) - inch(0.1);
    else if ((o.notes || noteList.length) && notesH) notesH = Math.max(notesH, H - M - (y + headH + rowH * n) - inch(0.1));
    const nameW = CW * (o.orient === 'portrait' ? 0.22 : 0.2), hoursW = CW * 0.07, dayW = (CW - nameW - hoursW) / 7;
    // Text size follows the row height, but never so big that "10:30a–11:45p" overflows a day column.
    const cellPt = Math.max(6, Math.min(11, rowH / dpi * 72 * 0.42, dayW / dpi * 72 / 8.6));
    const colX = (i) => M + nameW + i * dayW;
    const line = (x1, y1, x2, y2, wpt = 0.5, col = '#888') => { g.strokeStyle = col; g.lineWidth = pt(wpt); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    const text = (s, x, yy, align = 'left', size = cellPt, weight = '400', col = '#000', maxW) => {
      g.font = font(size, weight); g.fillStyle = col; g.textAlign = align;
      let str = String(s);
      if (maxW) while (str.length > 1 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…';
      g.fillText(str, x, yy); g.textAlign = 'left';
    };
    const top = y;
    // Heading row
    g.fillStyle = '#222'; g.fillRect(M, y, CW, headH);
    const mid = (hh) => y + hh / 2 + pt(cellPt) * 0.35;
    text('Name', M + pt(6), mid(headH), 'left', cellPt + 0.5, '700', '#fff');
    days.forEach((d, i) => { text(`${dayName(d, 'short')} ${parseIso(d).getMonth() + 1}/${parseIso(d).getDate()}`, colX(i) + dayW / 2, mid(headH), 'center', cellPt + 0.5, '700', '#fff'); });
    text('Hours', M + CW - pt(6), mid(headH), 'right', cellPt + 0.5, '700', '#fff');
    y += headH;
    rows.forEach((r) => {
      if (r.t === 'g') {
        g.fillStyle = '#e4e4e4'; g.fillRect(M, y, CW, rowH);
        text(r.label, M + pt(6), mid(rowH), 'left', cellPt, '700');
      } else {
        const p = r.p, total = personWeekHours(p.id, w), over = p.maxHours && total > p.maxHours;
        text(`${p.name}`, M + pt(5), mid(rowH), 'left', cellPt, '700', '#000', nameW - pt(5) - cellPt / 72 * dpi * 2.4);
        text(ROLES[p.role].short, M + nameW - pt(6), mid(rowH), 'right', cellPt - 1.5, '400', '#555');
        days.forEach((d, i) => {
          const ss = shiftsOf(p, d), k = ss.length;
          ss.forEach((s, j) => text(`${clock(s.start, true)}–${clock(s.end, true)}${s.note ? ' *' : ''}`, colX(i) + dayW / 2, k === 1 ? mid(rowH) : y + rowH * (j + 0.8) / k, 'center', k === 1 ? cellPt : Math.max(5, cellPt * 0.78), '400', '#000', dayW - pt(4)));
        });
        text(hrs(total) + (over ? ' !' : ''), M + CW - pt(6), mid(rowH), 'right', cellPt, over ? '700' : '400', over ? '#b00' : '#000');
      }
      y += rowH;
      line(M, y, M + CW, y, 0.5, '#999');
    });
    foot.forEach(([label, fn, tot], k) => {
      g.fillStyle = '#f1f1f1'; g.fillRect(M, y, CW, rowH);
      text(label, M + pt(6), mid(rowH), 'left', cellPt, '700');
      days.forEach((d, i) => text(fn(d), colX(i) + dayW / 2, mid(rowH), 'center', cellPt, '400'));
      text(tot, M + CW - pt(6), mid(rowH), 'right', cellPt, '700');
      y += rowH;
      line(M, y, M + CW, y, k === foot.length - 1 ? 1 : 0.5, k === foot.length - 1 ? '#000' : '#999');
    });
    // Grid lines and border
    for (let i = 0; i <= 7; i++) line(colX(i), top, colX(i), y, 0.5, '#999');
    g.strokeStyle = '#000'; g.lineWidth = pt(1); g.strokeRect(M, top, CW, y - top);
    line(M, y - rowH * foot.length, M + CW, y - rowH * foot.length, 1.2, '#000');
    // Notes area with writing lines
    if (notesH > inch(0.5)) {
      y += inch(0.2);
      drawNotes(text, line, noteList, M, CW, y, H - M, inch, pt, 0.32);
    }
    return c;
  }
  // BMP has no built-in browser encoder, so build a 24-bit file by hand.
  function canvasToBmp(c, dpi) {
    const w = c.width, hgt = c.height, data = c.getContext('2d').getImageData(0, 0, w, hgt).data;
    const row = Math.ceil(w * 3 / 4) * 4, size = 54 + row * hgt;
    const buf = new ArrayBuffer(size), v = new DataView(buf), out = new Uint8Array(buf);
    v.setUint8(0, 0x42); v.setUint8(1, 0x4d); v.setUint32(2, size, true); v.setUint32(10, 54, true);
    v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, hgt, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true);
    v.setUint32(34, row * hgt, true); const ppm = Math.round(dpi / 0.0254); v.setInt32(38, ppm, true); v.setInt32(42, ppm, true);
    for (let y = 0; y < hgt; y++) {
      let o = 54 + y * row; const src = (hgt - 1 - y) * w * 4;
      for (let x = 0; x < w; x++) { const i = src + x * 4; out[o++] = data[i + 2]; out[o++] = data[i + 1]; out[o++] = data[i]; }
    }
    return new Blob([buf], { type: 'image/bmp' });
  }
  // Store the print resolution inside PNG and JPG files so they print at the right size.
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (bytes) => { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function withDpi(blob, type, dpi) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (type === 'png') {
      const ppm = Math.round(dpi / 0.0254);
      const chunk = new Uint8Array(21), v = new DataView(chunk.buffer);
      v.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); v.setUint32(8, ppm); v.setUint32(12, ppm); chunk[16] = 1;
      v.setUint32(17, crc32(chunk.subarray(4, 17)));
      const out = new Uint8Array(bytes.length + 21);
      out.set(bytes.subarray(0, 33)); out.set(chunk, 33); out.set(bytes.subarray(33), 54);
      return new Blob([out], { type: 'image/png' });
    }
    if (type === 'jpg' && bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46) {
      bytes[13] = 1; bytes[14] = dpi >> 8; bytes[15] = dpi & 255; bytes[16] = dpi >> 8; bytes[17] = dpi & 255;
      return new Blob([bytes], { type: 'image/jpeg' });
    }
    return blob;
  }
  async function sheetBlob(w, o) {
    const c = drawWeekSheet(w, o);
    if (o.format === 'bmp') return canvasToBmp(c, o.dpi);
    const mime = o.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((r) => c.toBlob(r, mime, 0.95));
    return withDpi(blob, o.format, o.dpi);
  }
  const imgPrefs = (() => { try { return JSON.parse(localStorage.getItem(KEY + '-img')) || {}; } catch (e) { return {}; } })();
