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
  const borderOnPrint = () => !!(deco.border && deco.style === 'design' && myBorder());
  function borderUseOnPrint(on) { deco.border = true; deco.style = on && myBorder() ? 'design' : 'frame'; decoSave(); }
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
  function myBorderThumb() { const d = myBorder(); if (!d) return ''; const k = JSON.stringify(d.s); if (!bThumbs.has(k)) { if (bThumbs.size > 8) bThumbs.clear(); bThumbs.set(k, myBorderSvg(1056, 816)); } return bThumbs.get(k); }

  // the Border choice in every print window
  function borderField(changed, customize) {
    const d = myBorder(), now = !deco.border ? 'off' : deco.style === 'design' && d ? 'design' : 'frame';
    const prev = h('span', { class: 'pd-bprev', title: d ? `Your border: ${d.name}` : '' }); if (d) prev.innerHTML = myBorderThumb();
    const s = h('select', { class: 'input', 'aria-label': 'Border', style: { width: 'auto' }, onchange: () => { deco.border = s.value !== 'off'; if (s.value !== 'off') deco.style = s.value; decoSave(); if (ui.tab === 'calendar') render(); changed(); } },
      [['off', 'Off'], ['frame', 'Thin frame'], ['design', d ? `My border: ${d.name}` : 'My border (make one first)']].map(([v, l]) => h('option', { value: v, selected: now === v, disabled: v === 'design' && !d }, l)));
    return h('div', { class: 'field' }, h('span', null, 'Border'), h('div', { class: 'pd-border' }, s, d ? prev : null,
      h('button', { class: 'btn sm', type: 'button', title: 'Open the Border designer, then come back to this window', onclick: customize }, 'Customize border…')));
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
    put: (b) => { borders = JSON.parse(JSON.stringify(b)); bordersSave(); },
    opener: () => borderUse,
    back: () => !!borderBack,
    goBack: () => { const f = borderBack; borderBack = null; borderUse = null; ui.tab = borderPrev === 'border' ? 'schedule' : borderPrev; persist(); render(); if (f) setTimeout(f, 60); },
    useOnPrint: (on) => borderUseOnPrint(on),
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
