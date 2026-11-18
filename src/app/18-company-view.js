  // ---------- Company & Location ----------
  // the page in tabs: the store's details, its hours, its positions (the last one picked is kept)
  let coTab = 'details'; try { coTab = localStorage.getItem(KEY + '-cotab') || 'details'; } catch (e) { /* blocked */ }
  function companyView(main) {
    const err = h('p', { class: 'error bad', hidden: true });
    const savePlace = (k, v) => {
      v = v.replace(/\s+/g, ' ').trim();
      const problem = (k === 'company' || k === 'location') && /[\\/:*?"<>|]/.test(v) ? 'Company and location names can’t contain \\ / : * ? " < > | (they are used in file names).'
        : k === 'phone' && v && !/^[\d\s()+.\-x]{7,}$/i.test(v) ? 'The phone number has characters that don’t look like a phone number.'
          : k === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'That email address doesn’t look right (like name@example.com).' : '';
      if (problem) { err.textContent = problem; err.hidden = false; render(); return; }
      err.hidden = true;
      const pl = { ...(loadPlace() || {}), ...Object.fromEntries(PLACE_FIELDS.map(([f]) => [f, plan[f] || ''])), [k]: v };
      try { localStorage.setItem(PLACE_KEY, JSON.stringify(pl)); } catch (e) { /* ignore */ }
      change(() => applyPlace(pl));
    };
    const field = (k, label, ph, wide) => {
      const inp = h('input', { class: 'input', id: 'co-' + k, value: plan[k] || '', placeholder: ph, maxLength: k === 'address' ? 160 : 80, type: k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text' });
      inp.addEventListener('change', () => savePlace(k, inp.value));
      return h('label', { class: 'field' + (wide ? ' wide' : '') }, h('span', null, label), inp);
    };
    const notes = h('textarea', { class: 'input', rows: 3, placeholder: 'e.g. Delivery Tuesdays 7am · Parking behind the building' }, plan.placeNotes || '');
    notes.addEventListener('change', () => change(() => { plan.placeNotes = notes.value; }));
    const details = h('div', null,
      h('p', { class: 'hint', style: { margin: '0 0 12px' } }, 'Used on every plan, printout and file name on this computer, and saved inside Location files. Changes save as you go.'),
      h('div', { class: 'co-grid' },
        field('company', 'Company name', 'e.g. Sunny Bowl Cafe'), field('location', 'Location name', 'e.g. Main & 5th'), field('storeNo', 'Store number', 'e.g. 0042'),
        field('address', 'Address', 'e.g. 1234 Main St, Denver CO 80202', true),
        field('phone', 'Phone', 'e.g. (303) 555-0142'), field('email', 'Email', 'e.g. manager@example.com'), field('website', 'Website', 'e.g. www.example.com')),
      err,
      h('h3', { class: 'co-h3' }, 'Contact details we keep'),
      h('p', { class: 'muted small', style: { margin: '0 0 4px' } }, 'Phone and email are always kept. Turn the home address off if this location does not use it: it leaves Staff › Contact & training, the contact cards and the QR codes.'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: addrInUse(), onchange: (e) => change(() => { plan.contactUse = { ...(plan.contactUse || {}), address: e.target.checked }; }) }), ' Home address in use'),
      h('label', { class: 'field', style: { marginTop: '10px' } }, h('span', null, 'Notes about this location'), notes));
    const hoursTab = h('div', null,
      h('h3', { class: 'co-h3', id: 'co-hours', style: { marginTop: 0 } }, 'Opening hours (Monday – Sunday)'),
      usualHoursEditor(),
      h('h3', { class: 'co-h3' }, 'Special hours (holidays and other days)'),
      (() => { const up = (plan.specialHours || []).filter((x) => x.to >= iso(new Date()));
        return up.length ? up.map((x) => h('div', { class: 'co-hours' }, h('b', null, x.name || 'Special hours'), h('span', { class: x.closed ? 'bad' : '' }, `${datesOnly(x)} · ${specialText(x)}`), ibs(ib('edit', 'Change or delete these special hours', () => specialDialog(x)))))
          : h('p', { class: 'muted small', style: { margin: '2px 0' } }, 'None coming up. Holidays and other days with their own opening hours (or closed) go here.'); })(),
      h('div', { class: 'inline', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', onclick: () => specialDialog(null) }, '+ Special hours…'), h('button', { class: 'btn sm', onclick: () => { const m = mondayOf(ui.day); specialDialog(null, { from: m, to: addDays(m, 6) }); } }, '+ Special hours for a week…'), h('button', { class: 'btn sm', onclick: calGo }, 'Open the Calendar')));

    // positions at this location
    const list = plan.positions || (plan.positions = defaultPositions());
    const move = (i, d) => change(() => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; });
    const rows = list.map((pos, i) => {
      const name = h('input', { class: 'input', value: pos.name, 'aria-label': 'Position name', style: { width: '100%' } });
      name.addEventListener('change', () => { const v = name.value.replace(/\s+/g, ' ').trim(); if (v) change(() => { pos.name = v; }); else name.value = pos.name; });
      return h('tr', { style: { opacity: pos.active ? 1 : 0.55 } },
        h('td', { class: 'num muted' }, String(i + 1)),
        h('td', { style: { minWidth: '240px' } }, name),
        h('td', { class: 'c' }, h('input', { type: 'checkbox', checked: pos.active, 'aria-label': 'In use at this location', onchange: (e) => change(() => { pos.active = e.target.checked; }) })),
        h('td', { class: 'nowrap' },
          h('button', { class: 'btn sm ghost', title: 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '▲'),
          h('button', { class: 'btn sm ghost', title: 'Move down', disabled: i === list.length - 1, onclick: () => move(i, 1) }, '▼'), ' ',
          h('button', { class: 'btn sm ghost danger-text', onclick: () => confirmBox(`Remove ${pos.name}?`, 'It is taken off this location’s list. You can undo this, or untick In use to keep it for later.', 'Remove', () => change(() => { plan.positions = list.filter((x) => x !== pos); })) }, 'Remove')));
    });
    const newPos = h('input', { class: 'input', id: 'co-newpos', placeholder: 'New position, e.g. Drive-thru', 'aria-label': 'New position name', style: { width: '100%' } });
    const addPos = () => { const v = newPos.value.replace(/\s+/g, ' ').trim(); if (!v) { newPos.focus(); return; } if (list.some((x) => x.name.toLowerCase() === v.toLowerCase())) { toast(`${v} is already on the list.`); return; } change(() => { list.push({ id: uid(), name: v, active: true }); }); setTimeout(() => { const x = document.querySelector('#co-newpos'); x && x.focus(); }); };
    newPos.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPos(); });
    const inUse = list.filter((x) => x.active).length;
    const posTab = h('div', null,
      h('div', { class: 'daynav' }, h('span', { class: 'muted small' }, list.length !== inUse ? `${list.length - inUse} not in use` : ''), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: () => confirmBox('Go back to the standard list?', 'The list goes back to the 14 standard positions. You can undo this.', 'Use the standard list', () => change(() => { plan.positions = defaultPositions(); })) }, 'Standard list')),
      h('p', { class: 'hint', style: { margin: '6px 0 12px' } }, 'The stations and jobs at this location. Rename any of them, put them in the order you use, untick In use for ones this location doesn’t have, or add your own. The list is saved with the location.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 't compact co-pos' },
        h('thead', null, h('tr', null, h('th', { class: 'num' }, '#'), h('th', null, 'Position'), h('th', { class: 'c' }, 'In use'), h('th', null, ''))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 4, class: 'muted' }, 'No positions yet. Add them below, or use the standard list.'))),
        h('tfoot', null, h('tr', null, h('td', null, ''), h('td', null, newPos), h('td', { colspan: 2 }, h('button', { class: 'btn primary', onclick: addPos }, '+ Add position')))))));
    const up = (plan.specialHours || []).filter((x) => x.to >= iso(new Date())).length;
    const TABS = [['details', 'Company & location', plan.location || plan.company || ''], ['hours', 'Store hours', up ? `${up} special` : ''], ['positions', 'Positions', `${inUse} in use`]];
    if (!TABS.some(([k]) => k === coTab)) coTab = 'details';
    const pick = (k) => () => { coTab = k; try { localStorage.setItem(KEY + '-cotab', k); } catch (e) { /* blocked */ } render(); };
    main.append(h('div', { class: 'card sched-tabs' },
      h('div', { class: 'st-bar', role: 'tablist' }, TABS.map(([k, label, n]) => h('button', { type: 'button', role: 'tab', class: 'st-tab', 'aria-selected': String(coTab === k), onclick: pick(k) }, label, n ? h('span', { class: 'st-n' }, n) : null))),
      h('div', { class: 'st-body', role: 'tabpanel' }, coTab === 'hours' ? hoursTab : coTab === 'positions' ? posTab : details)));
  }

