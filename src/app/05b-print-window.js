  // ===================================================================
  // Print windows: the choices on the left, the pages as they will print on the right
  // ===================================================================
  // Every printout opens one of these (Print or save, the Calendar, person sheets, Print screen, Print this page).
  // printWindow({ title, opts: [elements], draw: (pv) => text | Promise<text>, actions }) puts the choices on the left
  // and calls draw(pv) to fill the preview on the right; it returns { refresh } to call when a choice changes.
  // The text draw returns shows above the preview (pages, size, where the notes went).
  // Every print window also gets the Border (Off, Thin frame, My border) and Customize border…, which opens the Border
  // designer: use (the kind of page, for its room) and reopen (to come back here) say where it was opened from;
  // keep() is called first so the window's choices are kept, not cancelled.
  let pwOpen = null; // the open print window's refresh (your border is drawn after its picture is ready)
  // Layout: every printout, the same list at the top of every print window; picking another opens its window (kind:
  // this window's; onKind(k) true when this window shows that one itself)
  const PRINT_KINDS = [['table', 'Week table (names × days)'], ['timeline', 'Visual timeline (bars, a page a day or 7 small tiles)'], ['hourly', 'Hourly week (7 days, shifts as pills)'], ['calendar', 'Calendar: the month (holidays, time off, signs)'],
    ['person', 'A person or group (a page each)'], ['avail', 'Availability and contact list'], ['cards', 'Contact cards with QR codes'], ['page', 'This tab as it is'], ['screen', 'Print screen (a picture of the screen)']];
  function openPrint(kind) {
    ({ table: () => exportImageDialog({ layout: 'table' }), timeline: () => exportImageDialog({ layout: 'timeline' }), hourly: () => hourlyWeekDialog(),
      calendar: () => { ui.tab = 'calendar'; persist(); render(); setTimeout(() => calPrintDialog(), 60); }, person: () => printPeopleDialog(),
      avail: () => exportImageDialog({ layout: 'avail' }), cards: () => exportImageDialog({ layout: 'cards' }), page: () => printPageDialog(), screen: () => printScreenDialog() })[kind]();
  }
  function printWindow({ title, opts, draw, actions, onClose, use, reopen, keep, kind, onKind }) {
    const pv = h('div', { class: 'pd-pv', 'aria-label': 'Print preview' }), info = h('div', { class: 'pd-info' });
    if (kind) { const ks = h('select', { class: 'input', 'aria-label': 'Layout', onchange: () => { const v = ks.value; if (onKind && onKind(v)) return; md.close(); setTimeout(() => openPrint(v), 30); } },
      PRINT_KINDS.map(([v, l]) => h('option', { value: v, selected: v === kind }, l)));
      opts = [h('label', { class: 'field pd-layout' }, h('span', null, 'Layout'), ks), ...opts]; }
    opts = [...opts, borderField(() => { if (typeof pwOpen === 'function') pwOpen(); }, () => { if (keep) keep(); md.close(); openBorderDesigner(use || 'free', reopen || null); })];
    let t = 0, n = 0;
    const refresh = () => { clearTimeout(t); t = setTimeout(async () => { const me = ++n; try { const s = await draw(pv); if (me === n) info.textContent = s || ''; } catch (e) { info.textContent = 'No preview: ' + e.message; } }, 40); };
    const md = modal({ title, wide: true, body: [h('div', { class: 'pd-grid' }, h('div', { class: 'pd-opts' }, opts), h('div', { class: 'pd-right' }, info, pv))], actions, onClose });
    md.el.classList.add('pdlg');
    pwOpen = refresh;
    refresh();
    return { refresh, close: md.close, el: md.el, info };
  }
  const pvWidth = (pv) => Math.max(260, (pv.clientWidth || 760) - 56);
  // pictures (canvas pages): each on a sheet of paper; at most `max` shown, then how many more
  function pvPictures(pv, canvases, total = canvases.length) {
    const w = pvWidth(pv), out = [];
    canvases.forEach((c, i) => { out.push(h('img', { class: 'pd-page', alt: `Page ${i + 1}`, src: c.toDataURL('image/png'), style: { width: w + 'px' } }), total > 1 ? h('div', { class: 'pd-cap' }, `Page ${i + 1} of ${total}`) : null); });
    if (total > canvases.length) out.push(h('div', { class: 'pd-cap' }, `… and ${total - canvases.length} more page${total - canvases.length > 1 ? 's' : ''} like these`));
    pv.replaceChildren(...out.filter(Boolean));
  }
  // ---------- web-page printouts (the Calendar, person sheets, a screen) ----------
  // The page's print styles (its @media print rules) copied once under .pd-print, so a copy of what prints, laid out at the
  // paper's printable width, looks as it will on paper; then cut into pages.
  let pvCssDone = false;
  function pvPrintCss() {
    if (pvCssDone) return; pvCssDone = true;
    const scope = (sel) => { const parts = [], s = sel; let depth = 0, cur = '';
      for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur);
      return parts.map((p) => { p = p.trim(); return /^(html|body|:root)\b/.test(p) ? p.replace(/^(html|body|:root)/, '.pd-print') : '.pd-print ' + p; }).join(', '); };
    const out = [];
    const walk = (rules, inPrint) => { for (const r of rules) {
      if (r.type === 4) { const m = r.media ? r.media.mediaText : r.conditionText || ''; if (/\bprint\b/.test(m)) walk(r.cssRules, true); else if (inPrint) walk(r.cssRules, true); }
      else if (inPrint && r.type === 1) out.push(`${scope(r.selectorText)} { ${r.style.cssText} }`); } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules, false); } catch (e) { /* another site's sheet */ } }
    document.head.append(h('style', { id: 'pd-print-css' }, out.join('\n')));
  }
  // Where the pages end: about a page each, moved up to a clean place (before a table row, a box, a heading, a list
  // item) so nothing is cut through, as the browser does when it prints. meas: the section laid out at the page's width.
  function pageCuts(meas, ch) {
    const top = meas.getBoundingClientRect().top, H = meas.scrollHeight;
    // clean places: before a body row, a list item, a box, a heading…; a table's heading rows stay with the table, and a
    // heading (or a table's title) stays with what follows it: the cut moves up to before it
    const at = (e) => e.getBoundingClientRect().top - top;
    const safe = [...meas.querySelectorAll('tbody tr, li, h1, h2, h3, .al-dbox, .card, section, .person-sheet, .ps-tasks, .ps-sign, .cal-legend, .cal-pnotes, table, p')].map(at).filter((y) => y > 0).sort((a, b) => a - b);
    const heads = [...meas.querySelectorAll('h1, h2, h3, .al-dbox, table')].map(at);
    const out = [];
    for (let off = 0; off < H - 3;) {
      let end = off + ch;
      if (end < H - 3) {
        const c = safe.filter((y) => y > off + ch * 0.5 && y <= end).pop();
        if (c) { end = c; const hd = heads.filter((y) => y > off + ch * 0.5 && y < end && end - y < 90).sort((a, b) => a - b)[0]; if (hd) end = hd; }
      }
      out.push([off, Math.min(end, H) - off]); off = end;
    }
    return out.length ? out : [[0, ch]];
  }
  // wider than the paper (a wide table): shrunk to the paper's width, as the browser does when it prints
  function fitWide(meas, cw) { const kid = meas.firstChild, sw = Math.max(meas.scrollWidth, ...[...meas.querySelectorAll('.table-wrap, .tl-wrap, table')].map((e) => e.scrollWidth + (e.getBoundingClientRect().left - meas.getBoundingClientRect().left))); if (sw <= cw + 2) return 1; const z = cw / sw; kid.style.zoom = z; return z; }
  // the month (with its legend) stays on one page: a little too tall (a border's wider margin) and it is made smaller
  function fitTall(meas, ch, z) {
    const card = meas.querySelector('.cal-card'); if (!card) return z;
    const bottom = card.getBoundingClientRect().bottom - meas.getBoundingClientRect().top;
    if (bottom <= ch || bottom > ch * 1.45) return z;
    const z2 = z * (ch / bottom) * 0.97; meas.firstChild.style.zoom = z2; return z2;
  }
  const zoomOf = (meas, node, cw) => { if (!node.pdZoom) return fitWide(meas, cw); if (node.pdZoom !== 1) meas.firstChild.style.zoom = node.pdZoom; return node.pdZoom; };
  // a month with its details under it that do not all fit on one page: the month on a page of its own, the details from
  // the next (each starts at the top of its page, so no cut can land in the month's legend)
  function splitMonth(node, cw, ch) {
    const card = node.querySelector(':scope > .cal-card'), notes = node.querySelector(':scope > .cal-pnotes'); if (!card || !notes) return [node];
    const meas = h('div', { class: 'pd-print pd-measure', style: { width: cw + 'px' } }, node.cloneNode(true)); document.body.append(meas);
    const z = fitWide(meas, cw), tall = meas.scrollHeight; meas.remove(); if (tall <= ch) return [node];
    const kids = [...node.children], i = kids.indexOf(card), a = node.cloneNode(false), b = node.cloneNode(false);
    kids.forEach((k, j) => { if (j <= i) a.append(k.cloneNode(true)); else if (k.classList.contains('cal-pnotes')) b.append(k.cloneNode(true)); }); // the month, then the details (what is after them is screen-only)
    // both at the month's size (made smaller to fit its page, if it had to be): the details as they were under it
    const m2 = h('div', { class: 'pd-print pd-measure', style: { width: cw + 'px' } }, a.cloneNode(true)); document.body.append(m2);
    const zm = fitTall(m2, ch, fitWide(m2, cw)); m2.remove(); a.pdZoom = zm; b.pdZoom = Math.min(z, zm);
    return [a, b];
  }
  // sections: elements, each starting on a new page (a person each, the notes on their own page); paper in inches
  function pvDom(pv, sections, { pw, ph, m = 0.4 }) {
    pvPrintCss(); m = domBorderM(m);
    const IN = 96, cw = (pw - 2 * m) * IN, ch = (ph - 2 * m) * IN, w = pvWidth(pv), k = w / (pw * IN), pages = [];
    sections.filter(Boolean).flatMap((n) => splitMonth(n, cw, ch)).forEach((node) => {
      const meas = h('div', { class: 'pd-print pd-measure', style: { width: cw + 'px' } }, node.cloneNode(true)); document.body.append(meas);
      const z = fitTall(meas, ch, zoomOf(meas, node, cw)); pageCuts(meas, ch).forEach(([off, len]) => pages.push({ node, off, len, z })); meas.remove();
    });
    const MAX = 12;
    pv.replaceChildren(...pages.slice(0, MAX).flatMap((p, i) => {
      const kid = p.node.cloneNode(true); if (p.z !== 1) kid.style.zoom = p.z; noBorderCopy(kid);
      const content = h('div', { class: 'pd-print', style: { width: cw + 'px', marginTop: -p.off + 'px' } }, kid);
      const sheet = h('div', { class: 'pd-sheet', style: { width: pw * IN + 'px', height: ph * IN + 'px', transform: `scale(${k})` } },
        h('div', { class: 'pd-clip', style: { left: m * IN + 'px', top: m * IN + 'px', width: cw + 'px', height: p.len + 'px' } }, content), domBorderLayer(pw, ph));
      return [h('div', { class: 'pd-page', style: { width: pw * IN * k + 'px', height: ph * IN * k + 'px' } }, sheet), pages.length > 1 ? h('div', { class: 'pd-cap' }, `Page ${i + 1} of ${pages.length}`) : null].filter(Boolean);
    }), ...(pages.length > MAX ? [h('div', { class: 'pd-cap' }, `… and ${pages.length - MAX} more pages`)] : []));
    return pages.length;
  }
  // the paper for web-page printouts: set just before printing, taken off after
  function setPrintPage(pw, ph, m = 0.4) {
    $('#pd-page')?.remove();
    document.head.append(h('style', { id: 'pd-page' }, `@page { size: ${pw}in ${ph}in; margin: ${m}in; }`));
    const done = () => { $('#pd-page')?.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
  }
  // paper choices shared by the print windows: size and orientation (o.paper, o.orient), as [width, height] in inches
  const paperOf = (o) => { const p = PAPERS[o.paper] || PAPERS.letter; return o.orient === 'portrait' ? [p[0], p[1]] : [p[1], p[0]]; };
  function paperChoices(o, changed) {
    const s1 = h('select', { class: 'input', 'aria-label': 'Paper size', onchange: () => { o.paper = s1.value; changed(); } }, Object.entries(PAPERS).map(([k, v]) => h('option', { value: k, selected: o.paper === k }, v[2])));
    const s2 = h('select', { class: 'input', 'aria-label': 'Orientation', onchange: () => { o.orient = s2.value; changed(); } }, [['landscape', 'Landscape (wide)'], ['portrait', 'Portrait (tall)']].map(([k, l]) => h('option', { value: k, selected: o.orient === k }, l)));
    return [h('label', { class: 'field' }, h('span', null, 'Paper size'), s1), h('label', { class: 'field' }, h('span', null, 'Orientation'), s2)];
  }
  // ---------- saving any printout: PDF (all pages in one), PNG, JPG, BMP or SVG, at a DPI ----------
  const SAVE_TYPES = [['pdf', 'PDF – all pages in one file'], ['png', 'PNG – sharpest picture'], ['jpg', 'JPG – smaller file'], ['bmp', 'BMP – plain bitmap'], ['svg', 'SVG – vector, any size']];
  const fileType = (ext) => (ext === 'pdf' ? { description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } } : { description: ext.toUpperCase() + ' image', accept: { [ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/' + ext]: ['.' + ext] } });
  // the file type and resolution boxes (o.format, o.dpi), for the print windows' Save
  function saveChoices(o, changed, types = SAVE_TYPES) {
    if (!types.some(([v]) => v === o.format)) o.format = types[0][0];
    if (!DPI_OPTIONS.some(([v]) => v === +o.dpi)) o.dpi = 300;
    const f = h('select', { class: 'input', 'aria-label': 'File type', onchange: () => { o.format = f.value; changed(); } }, types.map(([v, l]) => h('option', { value: v, selected: o.format === v }, l)));
    const d = h('select', { class: 'input', 'aria-label': 'Resolution', onchange: () => { o.dpi = +d.value; changed(); } }, DPI_OPTIONS.map(([v, l]) => h('option', { value: v, selected: +o.dpi === v }, l)));
    return [h('label', { class: 'field' }, h('span', null, 'File type (for saving)'), f), h('label', { class: 'field' }, h('span', null, 'Resolution (for saving)'), d)];
  }
  // a page as an SVG picture of W × H CSS pixels: the page's own stylesheet goes in with it, so it is laid out again
  // exactly as in the preview (print styles, drawn marks like the no sign and the X, sign pictures, decorations)
  let allCssText = '';
  const allCss = () => { if (allCssText) return allCssText; pvPrintCss(); const out = []; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) out.push(r.cssText); } catch (e) { /* another site's sheet */ } } return (allCssText = out.join('\n').replace(/\]\]>/g, ']] >')); };
  // the stylesheet's own body rules (font, line height…), for the picture's outer box (it has no body of its own)
  let bodyCssText = null;
  const bodyCss = () => { if (bodyCssText != null) return bodyCssText; const out = []; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.type === 1 && /^(html|body)(\s*,\s*(html|body))*$/.test(r.selectorText.trim())) out.push(r.style.cssText); } catch (e) { /* another site's sheet */ } }
    return (bodyCssText = out.join(';').replace(/"/g, "'").replace(/background[^;]*;?/g, '')); };
  function pageSvg(el, W, H, k) {
    const xhtml = new XMLSerializer().serializeToString(el);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * k)}" height="${Math.round(H * k)}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;background:#fff;${bodyCss()}"><style><![CDATA[${allCss()}]]></style>${xhtml}</div></foreignObject></svg>`;
  }
  async function svgToCanvas(svg, w, hgt) {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = hgt; const g = c.getContext('2d'); if (!g) throw new Error('too big');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, hgt); g.drawImage(img, 0, 0, w, hgt); return c;
  }
  // a web-page printout's pages (as in the preview) as SVG pictures, each W × H at k (DPI / 96)
  function domPageSvgs(sections, { pw, ph, m = 0.4 }, k) {
    pvPrintCss(); m = domBorderM(m);
    const IN = 96, W = Math.round(pw * IN), H = Math.round(ph * IN), cw = (pw - 2 * m) * IN, ch = (ph - 2 * m) * IN, out = [];
    const host = h('div', { style: { position: 'fixed', left: '-40000px', top: '0' } }); document.body.append(host);
    try {
      sections.filter(Boolean).flatMap((n) => splitMonth(n, cw, ch)).forEach((node) => {
        const meas = h('div', { class: 'pd-print', style: { width: cw + 'px' } }, node.cloneNode(true)); host.append(meas);
        const z = fitTall(meas, ch, zoomOf(meas, node, cw)), cuts = pageCuts(meas, ch); meas.remove();
        for (const [off, len] of cuts) {
          const sheet = h('div', { class: 'pd-print', style: { position: 'relative', width: W + 'px', height: H + 'px', background: '#fff', overflow: 'hidden' } },
            h('div', { style: { position: 'absolute', left: m * IN + 'px', top: m * IN + 'px', width: cw + 'px', height: len + 'px', overflow: 'hidden' } },
              h('div', { class: 'pd-print', style: { width: cw + 'px', marginTop: -off + 'px' } }, (() => { const kid = node.cloneNode(true); if (z !== 1) kid.style.zoom = z; noBorderCopy(kid); return kid; })())), domBorderLayer(pw, ph));
          out.push(pageSvg(sheet, W, H, k));
        }
      });
    } finally { host.remove(); }
    return out;
  }
  // save the pages: PDF (one file), or a picture a page; at a DPI too big for a picture, SVG pictures and a 300 DPI PDF
  async function savePrintout({ name, pw, ph, o, svgs, canvases }) {
    const fmt = o.format || 'pdf', dpi = +o.dpi || 300, big = tooBig(Math.round(pw * dpi), Math.round(ph * dpi));
    toast('Making the file…');
    try {
      const files = [];
      // canvases(dpi): the pages as pictures at that DPI; svgs(k): as SVG text (web-page printouts)
      const pics = async (d) => (canvases ? canvases(d) : Promise.all(svgs(d / 96).map((s) => svgToCanvas(s, Math.round(pw * d), Math.round(ph * d)))));
      if (fmt === 'pdf') files.push({ name: `${name}.pdf`, blob: await pdfFromCanvas(await pics(big || dpi > 600 ? Math.min(dpi, 600) : dpi), pw, ph), type: fileType('pdf') });
      else if (fmt === 'svg' || big) {
        const list = svgs ? svgs(dpi / 96) : (await canvases(dpi, true)).map((c) => c.svg());
        list.forEach((s, i) => files.push({ name: `${name}${list.length > 1 ? ' page ' + (i + 1) : ''}.svg`, blob: new Blob([s], { type: 'image/svg+xml' }), type: fileType('svg') }));
      } else {
        const cs = await pics(dpi);
        for (let i = 0; i < cs.length; i++) files.push({ name: `${name}${cs.length > 1 ? ' page ' + (i + 1) : ''}.${fmt}`, blob: await canvasBlob(cs[i], { format: fmt, dpi }), type: fileType(fmt) });
      }
      const n = await saveMany(files);
      if (n) toast((n === 1 ? `Saved ${files[0].name}` : `Saved ${n} files`) + (big && fmt !== 'svg' ? ` (${fmt === 'pdf' ? 'at 600 DPI' : 'as SVG'}: ${dpi} DPI on this paper is more than a browser can draw)` : fmt === 'pdf' && dpi > 600 ? ' (pictures in the PDF at 600 DPI)' : ''));
    } catch (e) { toast('That could not be made: ' + e.message); }
  }
  // Print this page (the Week, the Hand-off, Ctrl+P): what is on the screen, on the paper picked here
  function printPageDialog() {
    if (blockedHere()) return;
    const o = { paper: 'letter', orient: 'landscape', format: 'pdf', dpi: 300, ...(() => { try { return JSON.parse(localStorage.getItem(KEY + '-pagepr')) || {}; } catch (e) { return {}; } })() };
    const tabName = (TABS.find(([k]) => k === ui.tab) || [0, 'This page'])[1];
    const keep = () => { try { localStorage.setItem(KEY + '-pagepr', JSON.stringify(o)); } catch (e) { /* blocked */ } };
    const content = () => [h('div', { class: 'main' }, [...$('#main').children].map((c) => c.cloneNode(true)))];
    const pw = printWindow({ title: `Print or save · ${tabName}`, kind: 'page', reopen: () => printPageDialog(), opts: [...paperChoices(o, () => pw.refresh()), ...saveChoices(o, () => pw.refresh()),
      h('p', { class: 'hint' }, 'This tab as it is now, in light colours. Print screen makes a picture of the screen itself.')],
      draw: (pv) => { const [w, hgt] = paperOf(o), n = pvDom(pv, content(), { pw: w, ph: hgt }); return `${tabName} · ${PAPERS[o.paper][2]} ${o.orient} · ${n} page${n > 1 ? 's' : ''}`; },
      actions: [{ label: 'Cancel' },
        { label: 'Print…', onClick: () => { keep(); const [w, hgt] = paperOf(o); if (deco.border) { printDomPictures(content(), o, w, hgt); return; } setPrintPage(w, hgt); setTimeout(() => window.print(), 80); } },
        { label: 'Save', primary: true, onClick: () => { keep(); const [w, hgt] = paperOf(o), sec = content(); savePrintout({ name: fileStem(tabName.toLowerCase(), fileDate(ui.day)), pw: w, ph: hgt, o, svgs: (k) => domPageSvgs(sec, { pw: w, ph: hgt }, k) }); } }] });
  }
