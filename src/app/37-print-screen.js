  // ===================================================================
  // Print screen: a picture of exactly what is on screen (any tab)
  // ===================================================================
  const SCREEN_PROPS = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'min-width', 'min-height', 'max-width', 'box-sizing',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'border-collapse', 'border-spacing',
    'background-color', 'background-image', 'background-size', 'color', 'opacity', 'box-shadow', 'outline',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'white-space', 'text-overflow', 'vertical-align',
    'overflow-x', 'overflow-y', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-content', 'align-self', 'justify-content', 'gap', 'row-gap', 'column-gap',
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'place-items', 'table-layout', 'list-style-type', 'z-index', 'visibility', 'cursor', 'accent-color'];
  // Copies the page with every style written into it, so it can be drawn as a picture.
  function snapshotScreen(lightColors) {
    const root = document.documentElement, oldTheme = root.dataset.theme;
    if (lightColors) root.dataset.theme = 'light';
    try {
      const parts = [document.querySelector('.bar'), $('#main')];
      const W = Math.max(...parts.map((el) => el.scrollWidth));
      const wrap = document.createElement('div');
      let H = 0;
      parts.forEach((el) => {
        const clone = el.cloneNode(true);
        const src = [el, ...el.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
        src.forEach((n, i) => {
          const cs = getComputedStyle(n), t = dst[i];
          t.setAttribute('style', SCREEN_PROPS.map((k) => `${k}:${cs.getPropertyValue(k)}`).join(';'));
          if (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT') {
            const v = n.tagName === 'SELECT' ? (n.selectedOptions[0] || {}).text || '' : n.type === 'checkbox' ? '' : n.value;
            if (n.type === 'checkbox') { if (n.checked) t.setAttribute('checked', ''); }
            else { const span = document.createElement('span'); span.textContent = v || n.placeholder || ''; span.setAttribute('style', t.getAttribute('style') + ';display:inline-block;overflow:hidden;white-space:nowrap'); t.replaceWith(span); }
          }
        });
        // Show the whole page, not just the scrolled part
        clone.style.position = 'relative'; clone.style.overflow = 'visible'; clone.style.height = 'auto'; clone.style.width = W + 'px';
        clone.querySelectorAll('.tl-wrap, .table-wrap').forEach((x) => { x.style.overflow = 'visible'; });
        wrap.append(clone);
        H += el.scrollHeight;
      });
      wrap.setAttribute('style', `width:${W}px;background:${getComputedStyle(document.body).backgroundColor};font-family:${getComputedStyle(document.body).fontFamily}`);
      const xhtml = new XMLSerializer().serializeToString(wrap);
      return { W, H: H + 4, xhtml };
    } finally {
      if (lightColors) { if (oldTheme) root.dataset.theme = oldTheme; else delete root.dataset.theme; }
    }
  }
  const screenSvg = (snap, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(snap.W * scale)}" height="${Math.round(snap.H * scale)}" viewBox="0 0 ${snap.W} ${snap.H}"><foreignObject x="0" y="0" width="${snap.W}" height="${snap.H}">${snap.xhtml}</foreignObject></svg>`;
  async function screenCanvas(snap, scale) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(screenSvg(snap, scale));
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(snap.W * scale); c.height = Math.round(snap.H * scale);
    const g = c.getContext('2d');
    if (!g) throw new Error('too big');
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  // A tall screen on paper: cut into page-high pieces, each cut moved up to a gap between lines (a pixel row the same
  // as the one above it: only background and up-and-down lines pass through), so no line of text is cut in two
  function screenPages(c, max) {
    if (c.height <= max) return [c];
    const g = c.getContext('2d'), W = c.width, out = [];
    for (let y0 = 0; y0 < c.height;) {
      let y1 = Math.min(c.height, y0 + max);
      if (y1 < c.height) {
        const look = Math.floor(max * 0.3), top = y1 - look, d = g.getImageData(0, top, W, look).data, row = W * 4;
        for (let r = look - 1; r > 0; r--) {
          let same = true;
          for (let i = r * row, j = (r - 1) * row, e = i + row; i < e; i += 4, j += 4) if (Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) > 18) { same = false; break; }
          if (same) { y1 = top + r; break; }
        }
      }
      const p = document.createElement('canvas'); p.width = W; p.height = y1 - y0;
      p.getContext('2d').drawImage(c, 0, y0, W, y1 - y0, 0, 0, W, y1 - y0); out.push(p); y0 = y1;
    }
    return out;
  }
  function printScreenDialog() {
    const o = { format: 'png', dpi: 300, light: true, paper: 'letter', orient: 'landscape', ...(() => { try { return JSON.parse(localStorage.getItem(KEY + '-screen')) || {}; } catch (e) { return {}; } })() };
    if (!DPI_OPTIONS.some(([v]) => v === +o.dpi)) o.dpi = 300;
    const tabName = (TABS.find(([k]) => k === ui.tab) || [0, 'Screen'])[1];
    const sel = (key, options, label) => { const el = h('select', { class: 'input', onchange: () => { o[key] = key === 'dpi' ? +el.value : el.value; update(); } }, options.map(([v, l]) => h('option', { value: v, selected: String(o[key]) === String(v) }, l))); return h('label', { class: 'field' }, h('span', null, label), el); };
    const size = h('p', { class: 'hint' });
    const preview = h('img', { alt: 'Preview of the screen picture', style: { width: '100%', maxHeight: '42vh', objectFit: 'contain', objectPosition: 'top', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff' } });
    let snap = null;
    const update = async () => {
      snap = snapshotScreen(true);
      const scale = o.dpi / 96, W = Math.round(snap.W * scale), H = Math.round(snap.H * scale);
      const big = o.format !== 'svg' && tooBig(W, H);
      size.textContent = big
        ? `At ${o.dpi} DPI this screen would be ${W.toLocaleString()} × ${H.toLocaleString()} pixels, too big for a picture file, so it will be saved as SVG (sharp at any size).`
        : `${tabName} · ${W.toLocaleString()} × ${H.toLocaleString()} pixels · ${o.dpi} DPI (the screen is drawn ${scale.toFixed(1)}× sharper than it looks)`;
      size.className = big ? 'hint warn' : 'hint';
      try { preview.src = (await screenCanvas(snap, 0.5)).toDataURL(); } catch (e) { preview.removeAttribute('src'); }
    };
    modal({ title: `Print screen · ${tabName}`, wide: true, body: [
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' } },
        sel('format', [['png', 'PNG – sharpest picture'], ['jpg', 'JPG – smaller file'], ['bmp', 'BMP – plain bitmap'], ['svg', 'SVG – opens in a browser, any size']], 'File type'),
        sel('dpi', DPI_OPTIONS, 'Resolution'),
        sel('paper', Object.entries(PAPERS).map(([k, v]) => [k, v[2]]), 'Paper (for printing)'),
        sel('orient', [['landscape', 'Landscape (wide)'], ['portrait', 'Portrait (tall)']], 'Orientation (for printing)')),
      h('p', { class: 'hint' }, 'Pictures and printouts always use light colors, even when you edit in dark mode.'),
      size, preview,
      h('p', { class: 'hint' }, 'Takes the whole page of the tab you are on, including parts you would have to scroll to. Change tabs or days first to capture something else.')],
    actions: [{ label: 'Cancel' },
      { label: 'Print', onClick: async () => {
        remember();
        if (blockedHere()) return;
        const c = await screenCanvas(snapshotScreen(true), 2);
        let [pw, ph] = PAPERS[o.paper]; if (o.orient === 'landscape') [pw, ph] = [ph, pw];
        const area = $('#print-area');
        // a page each piece (the page's height at the width the picture prints)
        const pages = screenPages(c, Math.floor((ph - 0.6) / (pw - 0.6) * c.width) - 2);
        area.replaceChildren(h('style', null, `@page { size: ${pw}in ${ph}in; margin: 0.3in; } #print-area img.page { display: block; width: 100%; height: auto; break-after: page; page-break-after: always; } #print-area img.page:last-of-type { break-after: auto; page-break-after: auto; }`),
          ...pages.map((pc) => h('img', { class: 'page', alt: '', src: pc.toDataURL('image/png') })));
        document.body.classList.add('print-people');
        const done = () => { document.body.classList.remove('print-people'); area.replaceChildren(); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        setTimeout(() => window.print(), 200);
      } },
      { label: 'Save', primary: true, onClick: async () => {
        remember();
        const s2 = snapshotScreen(true), scale = o.dpi / 96;
        const stamp = `${dayName(ui.day, 'short')} ${fileDate(ui.day)}`;
        const base = `${fileStem(tabName.toLowerCase(), 'screen', stamp)}`;
        let blob, ext = o.format;
        if (o.format === 'svg' || tooBig(Math.round(s2.W * scale), Math.round(s2.H * scale))) { blob = new Blob([screenSvg(s2, scale)], { type: 'image/svg+xml' }); ext = 'svg'; }
        else {
          toast('Making the picture…');
          try { blob = await canvasBlob(await screenCanvas(s2, scale), o); }
          catch (e) { blob = new Blob([screenSvg(s2, scale)], { type: 'image/svg+xml' }); ext = 'svg'; }
        }
        const n = await saveBlob(`${base}.${ext}`, blob, { description: ext.toUpperCase() + ' image', accept: { [ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/' + ext]: ['.' + ext] } });
        if (n) toast(`Saved ${n}${ext !== o.format ? ' (as SVG, because that DPI is too big for a picture file)' : ''}`);
      } }] });
    function remember() { try { localStorage.setItem(KEY + '-screen', JSON.stringify(o)); } catch (e) { /* ignore */ } }
    update();
  }

