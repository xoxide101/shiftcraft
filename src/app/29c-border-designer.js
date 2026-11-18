  // ===================================================================
  // Border designer: your own page borders (src/border, put in by build.py), kept in this browser
  // ===================================================================
  // The designer is its own page (border_lab.html) in a frame on the Border designer screen; it reads the pictures
  // (window.LAB_ICONS) and its designs through window.BORDER_HOST below, and keeps every change as you go. Printouts
  // draw the open design with the same drawing part (window.makeBorderEngine). The border is a choice of its own in
  // every print window (Off, Thin frame, My border) with Customize border… to come here and back.
  const BORDER_KEY = KEY + '-borders';
  let borders = { designs: [], current: '' };
  try { const b = JSON.parse(localStorage.getItem(BORDER_KEY) || 'null'); if (b && Array.isArray(b.designs)) borders = b; } catch (e) { /* blocked */ }
  const bordersSave = () => { try { localStorage.setItem(BORDER_KEY, JSON.stringify(borders)); } catch (e) { /* blocked or full */ } };
  const myBorder = () => borders.designs.find((d) => d.id === borders.current) || null;
  let bEngine = null;
  const bEng = () => bEngine || (bEngine = typeof window.makeBorderEngine === 'function' ? window.makeBorderEngine() : null);
  // your border is used on printouts automatically once you have one, unless you picked the thin frame (or Off)
  try { deco.chosen = !!JSON.parse(localStorage.getItem(DECO_KEY) || '{}').chosen; } catch (e) { deco.chosen = false; }
  const useMine = () => !!(deco.border && myBorder() && (deco.style === 'design' || !deco.chosen));
  const borderOnPrint = useMine;
  function borderUseOnPrint(on) { deco.border = true; deco.style = on && myBorder() ? 'design' : 'frame'; deco.chosen = !on; decoSave(); }
  // how far in from the paper's edge your border reaches (inches); the printout starts inside it
  const bInsets = new Map();
  function myBorderInset(over) {
    const d = myBorder(), en = bEng(); if (!d || !en) return 0.45;
    const k = JSON.stringify([d.s, over || null]); if (!bInsets.has(k)) { if (bInsets.size > 20) bInsets.clear(); bInsets.set(k, en.inset(d.s, over)); }
    return bInsets.get(k);
  }
  // your border for a page W × H (dots at 96 per inch) as SVG, without the white page under it (it is laid over)
  function myBorderSvg(W, H, over) { const d = myBorder(), en = bEng(); if (!d || !en) return ''; return en.render(d.s, W, H, over).replace(/^(<svg[^>]*>)<rect [^>]*fill="#fff"\/>/, '$1'); }
  // on a drawn page: a vector page takes the drawing as it is; a picture page draws it once it is ready (an SVG image
  // stays sharp at any DPI), and the open print window draws again when it is
  const bImgs = new Map();
  function drawMyBorder(g, W, H, inch) {
    const d = myBorder(); if (!d) return;
    const pw = Math.round(W * 96 / inch), ph = Math.round(H * 96 / inch), svg = myBorderSvg(pw, ph);
    if (typeof g.rawSvg === 'function') { g.rawSvg(svg.replace(/^<svg[^>]*?viewBox="([^"]*)"[^>]*>/, (m, vb) => `<svg x="0" y="0" width="${W}" height="${H}" viewBox="${vb}" preserveAspectRatio="none">`)); return; }
    const k = d.id + pw + 'x' + ph + JSON.stringify(d.s);
    let e = bImgs.get(k);
    if (!e) { if (bImgs.size > 12) bImgs.clear(); const img = new Image(); e = { img, ok: false }; img.onload = () => { e.ok = true; if (typeof pwOpen === 'function') pwOpen(); }; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); bImgs.set(k, e); }
    if (e.ok) g.drawImage(e.img, 0, 0, W, H);
  }
  // on a printed web page (the Calendar): drawn to the page box (paper less its margins), and the page's room set
  function myBorderOverlay(paper) {
    const [w, hh, m] = paper || [11, 8.5, 10 / 25.4], d = myBorder(); if (!d) return null;
    const over = { margin: Math.max(0.02, (d.s.margin || 0.42) - m) };
    const box = h('div', { class: 'deco-mine' }); box.innerHTML = myBorderSvg(Math.round((w - 2 * m) * 96), Math.round((hh - 2 * m) * 96), over).replace(/^<svg[^>]*?viewBox="([^"]*)"[^>]*>/, (x, vb) => `<svg viewBox="${vb}" preserveAspectRatio="none">`);
    document.documentElement.style.setProperty('--my-border-pad', Math.max(0.2, myBorderInset(over) + 0.06).toFixed(3) + 'in');
    return box;
  }
  // a small picture of your border (the print windows)
  const bThumbs = new Map();
  function myBorderThumb() { const d = myBorder(); if (!d) return ''; const k = JSON.stringify(d.s); if (!bThumbs.has(k)) { if (bThumbs.size > 8) bThumbs.clear(); bThumbs.set(k, myBorderSvg(528, 408)); } return bThumbs.get(k); }

  // the Border choice in every print window
  // (your current border is picked automatically; any other kept design can be picked here, or Thin frame or Off)
  function borderField(changed, customize) {
    const d = myBorder(), now = !deco.border ? 'off' : useMine() ? 'd:' + d.id : 'frame';
    const prev = h('span', { class: 'pd-bprev' });
    const showPrev = () => { const x = useMine() ? myBorder() : null; prev.innerHTML = x ? myBorderThumb() : ''; prev.title = x ? `Your border: ${x.name}` : ''; prev.hidden = !x; };
    const s = h('select', { class: 'input', 'aria-label': 'Border', style: { width: 'auto' }, onchange: () => {
      const v = s.value; if (v === 'designer') { s.value = now; customize(); return; } deco.border = v !== 'off';
      if (v === 'frame') { deco.style = 'frame'; deco.chosen = true; }
      if (v.startsWith('d:')) { deco.style = 'design'; deco.chosen = false; borders.current = v.slice(2); bordersSave(); bInsets.clear(); }
      decoSave(); showPrev(); if (ui.tab === 'calendar') render(); changed(); } },
      [['off', 'Off (none)'], ['frame', 'Thin frame (default)'], ...borders.designs.map((x) => ['d:' + x.id, 'My border: ' + x.name]), ['designer', d ? 'Border designer… (change it)' : 'Border designer… (make one)']].map(([v, l]) => h('option', { value: v, selected: now === v }, l)));
    showPrev();
    return h('div', { class: 'field' }, h('span', null, 'Border'), h('div', { class: 'pd-border' }, s, prev),
      d ? null : h('p', { class: 'hint' }, 'Once you make a border, printouts use it automatically.'));
  }

  // the screen: the designer in a frame filling the window under the ribbon
  let borderUse = null, borderBack = null, borderPrev = 'schedule';
  function openBorderDesigner(use, back) {
    if (use === undefined && ui.tab === 'border') return; // the ribbon tab, already here
    borderUse = use || null; borderBack = back || null;
    if (ui.tab !== 'border') borderPrev = ui.tab;
    ui.tab = 'border'; persist(); render();
  }
  window.BORDER_HOST = {
    get: () => JSON.parse(JSON.stringify(borders)),
    put: (b) => { const first = !borders.designs.length; borders = JSON.parse(JSON.stringify(b)); bordersSave(); bInsets.clear(); if (first && borders.designs.length) { deco.border = true; deco.chosen = false; deco.style = 'design'; decoSave(); } },
    opener: () => borderUse,
    back: () => !!borderBack,
    goBack: () => { const f = borderBack; borderBack = null; borderUse = null; ui.tab = borderPrev === 'border' ? 'schedule' : borderPrev; persist(); render(); if (f) setTimeout(f, 60); },
    useOnPrint: (on) => borderUseOnPrint(on),
    useAndLeave: () => { borderUseOnPrint(true); if (borderBack) window.BORDER_HOST.goBack(); else { borderUse = null; ui.tab = 'schedule'; persist(); render(); toast('Printouts use your border'); } },
    usingOnPrint: () => borderOnPrint(),
  };
  function borderView(main) {
    if (!window.BORDER_LAB_SRC) { main.append(h('div', { class: 'card' }, h('p', null, 'The Border designer is not in this copy of ShiftCraft.'))); return; }
    const f = h('iframe', { class: 'border-frame', title: 'Border designer' });
    f.srcdoc = window.BORDER_LAB_SRC;
    main.append(f);
    const fit = () => { if (!f.isConnected) { removeEventListener('resize', fit); return; } f.style.height = Math.max(520, innerHeight - f.getBoundingClientRect().top - 14) + 'px'; };
    requestAnimationFrame(fit); addEventListener('resize', fit);
  }

  // web-page printouts (a person's schedule, the calendar, a tab as it is): the border laid over each page, and a
  // margin wide enough for it (the preview, saving, and Print… all use these)
  const domBorderM = (m) => (deco.border ? Math.max(m, useMine() ? myBorderInset() + 0.06 : 0.45) : m);
  function domBorderLayer(pw, ph) {
    if (!deco.border) return null;
    const IN = 96, W = Math.round(pw * IN), H = Math.round(ph * IN), t = iso(new Date());
    const el = h('div', { class: 'pd-blayer', style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', pointerEvents: 'none' } });
    if (useMine()) el.innerHTML = myBorderSvg(W, H).replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${W}" height="${H}"`);
    else { const col = decoTheme(t, t).col; el.append(h('div', { style: { position: 'absolute', inset: '0.2in', border: `1.2px solid ${col}`, borderRadius: '0.08in' } }), h('div', { style: { position: 'absolute', inset: '0.24in', border: `0.6px solid ${col}`, borderRadius: '0.05in' } })); }
    return el;
  }
  // Print… for a web-page printout with a border: the same pages as the preview, printed as 300 DPI pictures
  async function printDomPictures(sections, o, pw, ph, m) {
    if (blockedHere()) return;
    toast('Getting the pages ready…');
    try { const cs = await Promise.all(domPageSvgs(sections, { pw, ph, m }, 300 / 96).map((s) => svgToCanvas(s, Math.round(pw * 300), Math.round(ph * 300)))); printSurfaces(cs, o); }
    catch (e) { toast('Could not get the pages ready: ' + e.message); }
  }
  const noBorderCopy = (el) => { if (deco.border) el.querySelectorAll('.deco-overlay .deco-mine, .deco-overlay .deco-frame').forEach((x) => x.remove()); };
