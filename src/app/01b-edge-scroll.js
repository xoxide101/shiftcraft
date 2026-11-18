  // ===================================================================
  // Wide areas (tables, the timeline): no scrollbar taking room; Office-style ‹ › at the left and right edges instead,
  // only when there is more that way. Click scrolls most of a screen; hold keeps going. Shift+wheel and touchpads still
  // scroll. Every .table-wrap, .tl-wrap and .tr-wrap gets them, wherever it is (the screens, windows, print windows).
  // ===================================================================
  const ES_SEL = '.table-wrap, .tl-wrap, .tr-wrap';
  function edgeScroll(w) {
    if (w.dataset.es || w.closest('.pd-print, .pd-pv, #print-area')) return;
    w.dataset.es = '1';
    const host = document.createElement('div'); host.className = 'es-host';
    w.parentNode.insertBefore(host, w); host.append(w); w.classList.add('es-wrap');
    const btn = (dir) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'es-btn no-print ' + (dir < 0 ? 'l' : 'r');
      b.title = dir < 0 ? 'Scroll left (hold to keep going)' : 'Scroll right (hold to keep going)'; b.setAttribute('aria-label', dir < 0 ? 'Scroll left' : 'Scroll right');
      b.innerHTML = `<span class="es-ch">${dir < 0 ? '‹' : '›'}</span>`;
      let t = null;
      const step = (smooth) => w.scrollBy({ left: dir * Math.max(80, w.clientWidth * (smooth ? 0.8 : 0.25)), behavior: smooth ? 'smooth' : 'auto' });
      const stop = () => { clearTimeout(t); clearInterval(t); t = null; };
      b.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); step(true); t = setTimeout(() => { t = setInterval(() => step(false), 90); }, 380); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((k) => b.addEventListener(k, stop));
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(true); } });
      host.append(b); return b;
    };
    const L = btn(-1), R = btn(1);
    // the arrow in the middle of the part of the area that is on screen (a tall table: where you are looking)
    const place = () => { if (L.hidden && R.hidden) return; const r = host.getBoundingClientRect(), top = Math.max(r.top, 0), bot = Math.min(r.bottom, innerHeight);
      const y = Math.max(4, Math.min(r.height - 40, (top + bot) / 2 - r.top - 18)); [L, R].forEach((b) => { b.firstChild.style.top = y + 'px'; }); };
    const sync = () => { const max = w.scrollWidth - w.clientWidth; L.hidden = !(max > 2 && w.scrollLeft > 2); R.hidden = !(max > 2 && w.scrollLeft < max - 2); place(); };
    w.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('scroll', () => { if (host.isConnected) place(); }, { passive: true });
    if (window.ResizeObserver) { const ro = new ResizeObserver(sync); ro.observe(w); if (w.firstElementChild) ro.observe(w.firstElementChild); }
    sync();
  }
  // new wide areas, as screens and windows are drawn
  { let queued = false;
    const scan = () => { queued = false; document.querySelectorAll(ES_SEL).forEach(edgeScroll); };
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(scan); } }).observe(document.documentElement, { childList: true, subtree: true }); }
