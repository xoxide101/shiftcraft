  // ===================================================================
  // Drawing surfaces: a normal canvas, or an SVG "canvas" for vector output.
  // Vector pages print sharp at any DPI and have no size limit.
  // ===================================================================
  function svgContext(W, H) {
    const parts = [], measure = document.createElement('canvas').getContext('2d');
    let path = [];
    const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const n = (v) => Math.round(v * 100) / 100;
    const ctx = {
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px Arial', textAlign: 'left', textBaseline: 'alphabetic',
      fillRect(a, b, w, hh) { parts.push(`<rect x="${n(a)}" y="${n(b)}" width="${n(w)}" height="${n(hh)}" fill="${this.fillStyle}"/>`); },
      strokeRect(a, b, w, hh) { parts.push(`<rect x="${n(a)}" y="${n(b)}" width="${n(w)}" height="${n(hh)}" fill="none" stroke="${this.strokeStyle}" stroke-width="${n(this.lineWidth)}"/>`); },
      beginPath() { path = []; },
      moveTo(a, b) { path.push(`M${n(a)} ${n(b)}`); },
      lineTo(a, b) { path.push(`L${n(a)} ${n(b)}`); },
      closePath() { path.push('Z'); },
      rect(a, b, w, hh) { path.push(`M${n(a)} ${n(b)}h${n(w)}v${n(hh)}h${n(-w)}Z`); },
      roundRect(a, b, w, hh, r) { r = Math.max(0, Math.min(r, w / 2, hh / 2)); path.push(`M${n(a + r)} ${n(b)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(hh - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}v${n(-(hh - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}Z`); },
      fill() { parts.push(`<path d="${path.join('')}" fill="${this.fillStyle}"/>`); },
      stroke() { parts.push(`<path d="${path.join('')}" fill="none" stroke="${this.strokeStyle}" stroke-width="${n(this.lineWidth)}"/>`); },
      save() {}, restore() {},
      // a decoration's outline picture (29-decorations.js): an SVG path, moved and scaled
      decoPath(d, a, b, s, col, lw) { parts.push(`<path d="${d}" transform="translate(${n(a)} ${n(b)}) scale(${+s.toFixed(4)})" fill="none" stroke="${col}" stroke-width="${+(lw / s).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/>`); },
      measureText(t) { measure.font = this.font; return measure.measureText(t); },
      fillText(t, a, b) {
        const size = (/([\d.]+)px/.exec(this.font) || [0, 10])[1], weight = (/^\s*(\d{3})/.exec(this.font) || [0, 400])[1];
        const anchor = { left: 'start', center: 'middle', right: 'end' }[this.textAlign] || 'start';
        parts.push(`<text x="${n(a)}" y="${n(b)}" font-family="Arial, Helvetica, sans-serif" font-size="${n(+size)}" font-weight="${weight}" fill="${this.fillStyle}" text-anchor="${anchor}">${x(t)}</text>`);
      },
    };
    ctx.toSVG = (wIn, hIn) => `<svg xmlns="http://www.w3.org/2000/svg" width="${wIn}in" height="${hIn}in" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
    return ctx;
  }
  function makeSurface(W, H, o) {
    if (o.vector) {
      const g = svgContext(W, H);
      return { width: W, height: H, vector: true, getContext: () => g, svg: () => g.toSVG(+(W / o.dpi).toFixed(3), +(H / o.dpi).toFixed(3)) };
    }
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    return c;
  }
  // A heading line on a printed page: text on the left and (smaller) text on the right, never over each other or off
  // the page, however long the store's name is or however narrow the paper. The right side gets … first (it keeps at
  // least 35% of the line), then the left side shrinks (down to 70% of its size) and gets … if it still doesn't fit.
  // L / R: { s, px (font size in pixels), weight, col }. Returns the left side's font size in pixels.
  function headLine(g, x0, x1, y, L, R) {
    const f = (t, px) => `${t.weight || '400'} ${px}px Arial, Helvetica, sans-serif`;
    const wOf = (t, px, str) => { g.font = f(t, px); return g.measureText(str).width; };
    const cut = (t, px, str, max) => { g.font = f(t, px); while (str.length > 1 && g.measureText(str).width > max) str = str.slice(0, -2) + '…'; return str; };
    const span = x1 - x0, gap = L.px * 0.9;
    let ls = String(L.s || ''), rs = R && R.s ? String(R.s) : '', px = L.px;
    if (rs) rs = cut(R, R.px, rs, Math.max(span * 0.35, span - wOf(L, px, ls) - gap));
    const room = span - (rs ? wOf(R, R.px, rs) + gap : 0);
    while (px > L.px * 0.7 && wOf(L, px, ls) > room) px -= L.px * 0.03;
    ls = cut(L, px, ls, room);
    const al = g.textAlign, fs = g.fillStyle;
    g.textAlign = 'left'; g.font = f(L, px); g.fillStyle = L.col || '#000'; g.fillText(ls, x0, y);
    if (rs) { g.textAlign = 'right'; g.font = f(R, R.px); g.fillStyle = R.col || '#444'; g.fillText(rs, x1, y); }
    g.textAlign = al; g.fillStyle = fs;
    return px;
  }
  const sheetName = () => [plan.company, plan.location].filter(Boolean).join(' – ') || 'Schedule';
  const hourLabel = (m) => { const h24 = Math.floor(m / 60) % 24; return `${h24 % 12 || 12}${h24 < 12 ? 'am' : 'pm'}`; };
  // Browsers can't hold pictures much over ~250 million pixels; bigger pages are saved as vectors.
  const tooBig = (W, H) => W > 32000 || H > 32000 || W * H > 200e6;

