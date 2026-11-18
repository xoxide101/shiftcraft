  // ===================================================================
  // A day's details, and its own look (Calendar; the Schedule uses the same window)
  // ===================================================================
  // plan.days['YYYY-MM-DD'] = { color: '#rrggbb', hatch: 'diag' | 'diagl' | 'cross' | 'lines' | 'dots' | 'dither',
  //   pics: [{ icon: 'id' } | { img: 'data:image/…' }, pos: 'corner' | 'behind'], note: '' }: the day's own colour,
  // hatching, pictures and note (not an event; nothing to do with shifts). Kept in the schedule file (28-checking.js).
  const DAY_COLORS = [['#e5484d', 'Red'], ['#f76b15', 'Orange'], ['#ffc53d', 'Yellow'], ['#46a758', 'Green'], ['#12a594', 'Teal'], ['#3e63dd', 'Blue'], ['#8e4ec6', 'Purple'], ['#d6409f', 'Pink'], ['#8d6e63', 'Brown'], ['#8b8d98', 'Grey']];
  const DAY_HATCH = [['', 'None'], ['diag', 'Diagonal ／'], ['diagl', 'Diagonal ＼'], ['cross', 'Cross-hatch'], ['lines', 'Lines'], ['dots', 'Dots'], ['dither', 'Dither (light)']];
  const dayLook = (d) => (plan.days && plan.days[d]) || null;
  const lookEmpty = (x) => !x || (!x.color && !x.hatch && !(x.pics && x.pics.length) && !x.note);
  // change the look of one or more days (fn gets each day's own, made if need be); empty ones are dropped
  function setLook(days, fn) {
    change(() => { plan.days = plan.days || {}; days.forEach((d) => { const x = plan.days[d] || {}; fn(x, d); if (lookEmpty(x)) delete plan.days[d]; else plan.days[d] = x; }); if (!Object.keys(plan.days).length) delete plan.days; });
  }
  // the hatching as a CSS background (in the day's colour, or grey)
  const hatchCss = (k, c) => {
    c = c || '#6b7280';
    return { diag: `repeating-linear-gradient(45deg, ${c}55 0 1.5px, transparent 1.5px 8px)`, diagl: `repeating-linear-gradient(-45deg, ${c}55 0 1.5px, transparent 1.5px 8px)`,
      cross: `repeating-linear-gradient(45deg, ${c}44 0 1.2px, transparent 1.2px 8px), repeating-linear-gradient(-45deg, ${c}44 0 1.2px, transparent 1.2px 8px)`,
      lines: `repeating-linear-gradient(0deg, ${c}44 0 1.2px, transparent 1.2px 7px)`, dots: `radial-gradient(${c}66 1.3px, transparent 1.7px) 0 0 / 8px 8px`,
      dither: `radial-gradient(${c}55 0.8px, transparent 1.1px) 0 0 / 3px 3px` }[k] || '';
  };
  // the day's colour and hatching, as the cell's style
  function lookStyle(d) {
    const x = dayLook(d); if (!x) return null;
    const bg = [x.hatch ? hatchCss(x.hatch, x.color) : '', x.color ? `linear-gradient(${x.color}26, ${x.color}26)` : ''].filter(Boolean).join(', ');
    return bg ? { background: bg } : null;
  }
  // the pictures: the Border designer's (its drawing part has them all), or your own
  const dayIcons = () => { const en = typeof bEng === 'function' ? bEng() : null; return en && en.icons ? en.icons : {}; };
  const picEl = (p, cls) => {
    if (p.img) return h('img', { class: cls, src: p.img, alt: '' });
    const ic = dayIcons()[p.icon]; const s = h('span', { class: cls }); if (ic) s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ic[1]}</svg>`; return s;
  };
  const picName = (p) => (p.img ? 'Your picture' : (dayIcons()[p.icon] || [p.icon])[0]);
  // on the Calendar's day: small pictures by the date, big faded ones behind
  function dayPicsEl(d) {
    const x = dayLook(d); if (!x || !x.pics || !x.pics.length) return null;
    const corner = x.pics.filter((p) => p.pos !== 'behind'), behind = x.pics.filter((p) => p.pos === 'behind');
    return [behind.length ? h('div', { class: 'cal-behind' }, behind.slice(0, 2).map((p) => picEl(p, 'cal-bpic'))) : null,
      corner.length ? h('div', { class: 'cal-dpics', title: corner.map(picName).join(', ') }, corner.slice(0, 3).map((p) => picEl(p, 'cal-dpic'))) : null];
  }

  // ---------- choosing a picture: the Border designer's, by group and search, or a picture file ----------
  function picturePicker(pick) {
    const ic = dayIcons(), en = typeof bEng === 'function' ? bEng() : null, cat = (en && en.cat) || {};
    const groups = [...new Set(Object.keys(ic).map((k) => cat[k] || 'Other'))];
    const q = h('input', { class: 'input', type: 'search', placeholder: 'Search pictures: cake, car, pumpkin…', 'aria-label': 'Search pictures' });
    const g = h('select', { class: 'input', 'aria-label': 'Group', style: { width: 'auto' } }, h('option', { value: '' }, `All groups (${Object.keys(ic).length})`), groups.map((x) => h('option', { value: x }, x)));
    const grid = h('div', { class: 'pic-grid' });
    let m;
    const fill = () => { const w = q.value.trim().toLowerCase();
      grid.replaceChildren(...Object.entries(ic).filter(([k, v]) => (!g.value || (cat[k] || 'Other') === g.value) && (!w || (v[0] + ' ' + k + ' ' + (cat[k] || '')).toLowerCase().includes(w))).slice(0, 400)
        .map(([k, v]) => { const b = h('button', { type: 'button', class: 'pic-tile', title: v[0], onclick: () => { m.close(); pick({ icon: k }); } }); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${v[1]}</svg>`; return b; })); };
    q.addEventListener('input', fill); g.addEventListener('change', fill);
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => { const f = file.files[0]; if (!f) return;
      try { const url = await smallPicture(f); m.close(); pick({ img: url }); } catch (e) { toast('Could not read that picture: ' + e.message); } } });
    m = modal({ title: 'Add a picture', wide: true, body: [h('div', { class: 'inline', style: { gap: '8px', marginBottom: '8px' } }, q, g, h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, 'From a picture file…'), file), grid],
      actions: [{ label: 'Cancel' }] });
    fill();
  }
  // your own picture, made small enough to keep in the schedule file (at most 360 pixels across)
  async function smallPicture(f) {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('not readable')); r.readAsDataURL(f); });
    const img = new Image(); img.src = url; await img.decode();
    const k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return /png|gif|svg|webp/.test(f.type) ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
  }

  // ---------- the look of one day or several: colour, hatching, pictures, note (each change is kept at once; Ctrl+Z undoes) ----------
  function lookEditor(days, redraw) {
    const one = days.length === 1, first = dayLook(days[0]) || {};
    const same = (k) => days.every((d) => ((dayLook(d) || {})[k] || '') === (first[k] || ''));
    const color = same('color') ? first.color || '' : null, hatch = same('hatch') ? first.hatch || '' : null;
    const sw = (c, l) => h('button', { type: 'button', class: 'day-sw' + (color === c ? ' on' : ''), title: l, 'aria-label': l, style: c ? { background: c } : null, onclick: () => { setLook(days, (x) => { if (c) x.color = c; else delete x.color; }); redraw(); } }, c ? '' : '∅');
    const custom = h('input', { type: 'color', value: color || '#3e63dd', title: 'Another colour', 'aria-label': 'Another colour', onchange: () => { setLook(days, (x) => { x.color = custom.value; }); redraw(); } });
    const hat = (k, l) => { const b = h('button', { type: 'button', class: 'day-hat' + (hatch === k ? ' on' : ''), title: l, 'aria-label': l, onclick: () => { setLook(days, (x) => { if (k) x.hatch = k; else delete x.hatch; }); redraw(); } });
      b.style.background = k ? hatchCss(k, color || '') : '#fff'; if (!k) b.textContent = '∅'; return b; };
    const pics = one ? (first.pics || []) : [];
    const picRow = (p, i) => h('div', { class: 'day-picrow' }, picEl(p, 'day-picbig'), h('span', { class: 'day-picname' }, picName(p)),
      calSeg('Where', [['corner', 'By the date'], ['behind', 'Behind, faded']], p.pos === 'behind' ? 'behind' : 'corner', (v) => { setLook(days, (x) => { x.pics[i].pos = v; }); redraw(); }),
      h('button', { type: 'button', class: 'btn sm ghost', title: 'Take this picture off the day', onclick: () => { setLook(days, (x) => { x.pics.splice(i, 1); if (!x.pics.length) delete x.pics; }); redraw(); } }, 'Remove'));
    const note = h('textarea', { class: 'input', rows: 2, maxlength: 300, placeholder: one ? 'A note for this day (shows on the day, not an event)' : 'A note for all these days (empty: each keeps its own)', 'aria-label': 'Note for the day' }, one ? first.note || '' : '');
    note.addEventListener('change', () => { const v = note.value.trim(); if (!one && !v) return; setLook(days, (x) => { if (v) x.note = v; else delete x.note; }); redraw(); });
    const anyPics = days.some((d) => (dayLook(d) || {}).pics);
    return h('div', { class: 'day-look' },
      h('div', { class: 'day-lrow' }, h('span', { class: 'day-lab' }, 'Colour'), h('div', { class: 'day-sws' }, sw('', 'No colour'), DAY_COLORS.map(([c, l]) => sw(c, l)), custom)),
      h('div', { class: 'day-lrow' }, h('span', { class: 'day-lab' }, 'Hatching'), h('div', { class: 'day-sws' }, DAY_HATCH.map(([k, l]) => hat(k, l)))),
      h('div', { class: 'day-lrow top' }, h('span', { class: 'day-lab' }, 'Pictures'), h('div', { class: 'day-pics' },
        pics.map(picRow), !one && anyPics ? h('p', { class: 'muted small', style: { margin: 0 } }, 'Pictures already on these days stay; one you add goes on every day picked.') : null,
        h('div', { class: 'inline' }, h('button', { type: 'button', class: 'btn sm', onclick: () => picturePicker((p) => { setLook(days, (x) => { x.pics = [...(x.pics || []), { ...p, pos: 'corner' }].slice(0, 6); }); redraw(); }) }, '+ Picture…'),
          !one && anyPics ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { setLook(days, (x) => { delete x.pics; }); redraw(); } }, 'Remove all pictures') : null))),
      h('div', { class: 'day-lrow top' }, h('span', { class: 'day-lab' }, 'Note'), note));
  }
  // the look of several days (picked on the Calendar)
  function daysLookDialog(days) {
    let m; const body = h('div');
    const redraw = () => body.replaceChildren(lookEditor(days, redraw));
    redraw();
    m = modal({ title: `${days.length} days: colour, hatching, pictures`, body: [h('p', { class: 'muted small', style: { marginTop: 0 } }, daysText(days)), body],
      actions: [{ label: 'Clear all of it', left: true, onClick: () => { setLook(days, (x) => { Object.keys(x).forEach((k) => delete x[k]); }); redraw(); return false; } }, { label: 'Done', primary: true }] });
  }
  const daysText = (days) => { const s = [...days].sort(); return s.length > 6 ? `${dayName(s[0], 'short')} ${shortDate(s[0])} … ${dayName(s[s.length - 1], 'short')} ${shortDate(s[s.length - 1])}` : s.map((d) => `${dayName(d, 'short')} ${shortDate(d)}`).join(', '); };

  // ---------- One day: everything on it, in sections, and adding to it ----------
  function dayDialog(d) {
    const its = calItems(d, d).filter((it) => it.from <= d && d <= it.to).sort(calOrder);
    const r = regularHours(d), sp = specialOn(d), inPlan = planDays().includes(d);
    let m;
    const add = (fn) => () => { m.close(); fn(); };
    const open = (it) => (e) => { e.preventDefault(); m.close(); calOpen(it); };
    const line = (it, text) => h('li', { class: it.status === 'denied' ? 'muted' : '' }, h('a', { href: '#', onclick: open(it) }, h('b', null, text || calWhat(it))), ` · ${calHours(it)}`,
      it.kind === 'timeoff' ? [' · ', h('span', { class: it.status === 'requested' ? 'warn' : it.status === 'approved' ? 'good' : 'muted' }, calStatus(it))] : '', it.note ? h('span', { class: 'muted' }, ` — ${it.note}`) : null);
    const sect = (title, body, btns) => h('section', { class: 'dd-sect' }, h('div', { class: 'dd-head' }, h('h3', null, title), btns ? h('div', { class: 'inline' }, btns) : null), body);
    const list = (arr, none, fn) => (arr.length ? h('ul', { class: 'dd-list' }, arr.map(fn || ((it) => line(it)))) : h('p', { class: 'muted small dd-none' }, none));
    // holidays: special hours or events that are one, and the built-in list's (unless an entry that day has its name)
    const holIts = its.filter((it) => (it.kind === 'special' ? holSpecial(it.x) : it.kind === 'event' ? holEvent(it.x) : false));
    const named = [...eventsOn(d).flatMap((x) => [[x.title], ...(x.replaces ? [[x.replaces]] : [])]), ...(sp ? [[sp.name, true]] : [])];
    const builtins = builtinOn(d).filter((b) => !named.some(([n, loose]) => holLike(n, b.name, loose)));
    const evs = its.filter((it) => it.kind === 'event' && !holIts.includes(it)), offs = its.filter((it) => it.kind === 'timeoff');
    const on = inPlan ? sortStaff(shiftsOn(d).map((s) => staffById(s.staffId)).filter(Boolean)).filter((p, i, a) => a.indexOf(p) === i) : [];
    const lookBox = h('div'), redraw = () => lookBox.replaceChildren(lookEditor([d], redraw)); redraw();
    m = modal({ title: longDate(d), wide: true, body: h('div', { class: 'dd' },
      sect('Store hours', h('p', { class: 'dd-p' }, sp ? [h('b', null, specialText(sp)), ` (${sp.name || 'special hours'})`, h('span', { class: 'muted' }, ` · instead of the usual ${usualText(usualOn(d))}`)]
        : r ? [h('b', null, `${clock(r.open)} – ${clock(r.close)}`), h('span', { class: 'muted' }, ' (usual)')] : usualOn(d) ? h('span', { class: 'bad' }, 'Closed (usual)') : h('span', { class: 'muted' }, 'Usual hours not set')),
        [h('button', { class: 'btn sm', onclick: add(() => (sp ? specialDialog(sp) : specialDialog(null, { from: d, to: d }))) }, sp ? 'Change special hours…' : '+ Special hours')]),
      sect('Holidays', holIts.length || builtins.length ? h('ul', { class: 'dd-list' }, holIts.map((it) => line(it, it.kind === 'special' ? it.x.name || 'Holiday' : it.title)),
        builtins.map((b) => h('li', null, h('a', { href: '#', onclick: (e) => { e.preventDefault(); m.close(); eventDialog(null, { from: d, to: d, title: b.name, holiday: b.type, replaces: b.name }); } }, h('b', null, b.name)), h('span', { class: 'muted' }, b.type === 'national' ? ' · national holiday' : ' · business or local day')))) : h('p', { class: 'muted small dd-none' }, 'No holiday.')),
      sect('Events', list(evs, 'No events.'), [h('button', { class: 'btn sm', onclick: add(() => eventDialog(null, { from: d, to: d })) }, '+ Event')]),
      sect('Time off', list(offs, 'Nobody has time off.'), [h('button', { class: 'btn sm', disabled: !plan.staff.some((p) => !p.left), onclick: add(() => timeOffDialog(null, null, { from: d, to: d, status: 'requested', why: 'personal' })) }, '+ Time off request')]),
      sect('On the schedule', inPlan ? list(on, storeShut(d) ? 'The store is closed.' : 'Nobody is on the schedule yet.', (p) => h('li', null, h('b', null, p.name), ' ', h('span', { class: 'muted' }, ROLES[p.role].short), ' · ',
        shiftsOn(d).filter((s) => s.staffId === p.id).map((s) => `${clockShort(s.start)}–${clockShort(s.end)}`).join(', '))) : h('p', { class: 'muted small dd-none' }, 'This day is not in the schedule being worked on.'),
        inPlan ? [h('button', { class: 'btn sm', onclick: add(() => { ui.day = d; ui.tab = 'schedule'; persist(); render(); }) }, 'Open on the Schedule')] : null),
      sect('This day’s look', lookBox)),
    actions: [{ label: 'Close', primary: true }] });
  }

  // ---------- picking days on the Calendar: click, Shift+click a range, Ctrl+click one more (or one less) ----------
  const calPick = { days: new Set(), anchor: '' };
  function paintPicks() {
    document.querySelectorAll('td.cal-day[data-d]').forEach((td) => td.classList.toggle('cal-sel', calPick.days.has(td.dataset.d)));
    const bar = $('#cal-selbar'); if (!bar) return;
    const n = calPick.days.size; bar.hidden = n < 1;
    bar.replaceChildren(...(n ? [h('b', null, n === 1 ? `${dayName([...calPick.days][0], 'short')} ${shortDate([...calPick.days][0])}` : `${n} days picked`), h('span', { class: 'muted small' }, daysText([...calPick.days])),
      h('button', { class: 'btn sm primary', onclick: () => pickLook() }, 'Colour, hatching, pictures…'),
      n === 1 ? h('button', { class: 'btn sm', onclick: () => dayDialog([...calPick.days][0]) }, 'Day details…') : null,
      h('button', { class: 'btn sm ghost', onclick: () => { calPick.days.clear(); paintPicks(); } }, 'Clear picks')] : []));
  }
  const pickLook = () => { const s = [...calPick.days].sort(); if (s.length === 1) dayDialog(s[0]); else if (s.length) daysLookDialog(s); };
  function pickDay(d, e) {
    if (e.shiftKey && calPick.anchor) { const [a, b] = [calPick.anchor, d].sort(); if (!(e.ctrlKey || e.metaKey)) calPick.days.clear(); for (let x = a; x <= b; x = addDays(x, 1)) calPick.days.add(x); }
    else if (e.ctrlKey || e.metaKey) { if (calPick.days.has(d)) calPick.days.delete(d); else calPick.days.add(d); calPick.anchor = d; }
    else { calPick.days.clear(); calPick.days.add(d); calPick.anchor = d; } // (a double-click's second click keeps it picked)
    paintPicks();
  }
  // Esc clears the picks (when no window is open)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && calPick.days.size && !document.querySelector('.backdrop, .ctx-menu')) { calPick.days.clear(); paintPicks(); } });
  // right-click a day: for it, or for all the days picked when it is one of them
  function dayMenu(d, e) {
    e.preventDefault();
    if (!calPick.days.has(d)) { calPick.days.clear(); calPick.days.add(d); calPick.anchor = d; paintPicks(); }
    const days = [...calPick.days].sort(), n = days.length;
    if (n > 1) {
      popMenu(e.clientX, e.clientY, `${n} days picked`, [
        [`Colour, hatching, pictures for the ${n} days…`, () => daysLookDialog(days)],
        ['Add a picture to all of them…', () => picturePicker((p) => setLook(days, (x) => { x.pics = [...(x.pics || []), { ...p, pos: 'corner' }].slice(0, 6); }))],
        [`Add an event from ${shortDate(days[0])} to ${shortDate(days[n - 1])}…`, () => eventDialog(null, { from: days[0], to: days[n - 1] })],
        [`Special store hours from ${shortDate(days[0])} to ${shortDate(days[n - 1])}…`, () => specialDialog(null, { from: days[0], to: days[n - 1] })],
        [`Time off request from ${shortDate(days[0])} to ${shortDate(days[n - 1])}…`, () => timeOffDialog(null, null, { from: days[0], to: days[n - 1], status: 'requested', why: 'personal' })],
        ['Clear colour, hatching, pictures and notes', () => setLook(days, (x) => { Object.keys(x).forEach((k) => delete x[k]); })],
        ['Clear picks', () => { calPick.days.clear(); paintPicks(); }]]);
      return;
    }
    const has = !lookEmpty(dayLook(d)), inPlan = planDays().includes(d);
    popMenu(e.clientX, e.clientY, longDate(d), [
      ['Day details…', () => dayDialog(d)],
      ['Add an event…', () => eventDialog(null, { from: d, to: d })],
      ['Add special store hours…', () => (specialOn(d) ? specialDialog(specialOn(d)) : specialDialog(null, { from: d, to: d }))],
      ['Add a time off request…', () => timeOffDialog(null, null, { from: d, to: d, status: 'requested', why: 'personal' })],
      ['Add a picture…', () => picturePicker((p) => setLook([d], (x) => { x.pics = [...(x.pics || []), { ...p, pos: 'corner' }].slice(0, 6); }))],
      ['Colour, hatching, pictures, note…', () => dayDialog(d)],
      ...(has ? [['Clear this day’s look', () => setLook([d], (x) => { Object.keys(x).forEach((k) => delete x[k]); })]] : []),
      ...(inPlan ? [['Open on the Schedule', () => { ui.day = d; ui.tab = 'schedule'; persist(); render(); }]] : [])]);
  }
