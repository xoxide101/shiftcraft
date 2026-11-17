  // ===================================================================
  // Keyboard
  // ===================================================================
  document.addEventListener('keydown', (e) => {
    if ($('.backdrop')) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); if (e.shiftKey) saveAsDialog(); else saveFile('location'); return; }
    if (mod && k === 'o') { e.preventDefault(); openFile(); return; }
    if (mod && k === 'p' && e.shiftKey) { e.preventDefault(); printScreenDialog(); return; }
    if (mod && k === 'p') { e.preventDefault(); if (inFrame) blockedHere(); else if (ui.tab === 'calendar') calPrintDialog(); else printPageDialog(); return; }
    if (mod && k === 'z' && !typing) { e.preventDefault(); undo(); return; }
    if (!typing && ui.tab === 'schedule' && !mod && !e.target.classList.contains('shift')) {
      const days = planDays(), i = days.indexOf(ui.day);
      if (e.key === 'ArrowLeft' && i > 0) { ui.day = days[i - 1]; persist(); render(); }
      if (e.key === 'ArrowRight' && i < days.length - 1) { ui.day = days[i + 1]; persist(); render(); }
    }
  });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (ui.tab === 'schedule') render(); }, 150); });
  { const pl = loadPlace(); if (pl) applyPlace(pl); else if (plan.company || plan.location) { try { localStorage.setItem(PLACE_KEY, JSON.stringify(Object.fromEntries(PLACE_FIELDS.map(([k]) => [k, plan[k] || ''])))); } catch (e) { /* ignore */ } } }
  $('#store-name').onclick = () => { ui.tab = 'company'; persist(); render(); };
  $('#store-name').title = 'Company & location (click to edit)';
