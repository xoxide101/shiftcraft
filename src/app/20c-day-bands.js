  // ===================================================================
  // The day's bands on the Schedule (the same as on the Calendar): header, events, time off, the whole store; the
  // people for the day in groups; the events with a time on the timeline
  // ===================================================================
  // what is on a day, by band: head (signs), top (events), mid (time off), bot (holidays, special hours, closed)
  function dayBandItems(d) {
    const its = calItems(d, d).filter((it) => it.from <= d && d <= it.to && !(it.kind === 'timeoff' && it.status === 'denied')).sort(calOrder);
    const isHol = (it) => (it.kind === 'special' ? holSpecial(it.x) : it.kind === 'event' ? holEvent(it.x) : false);
    const out = { head: [], top: [], mid: [], bot: [] };
    its.forEach((it) => { const b = it.kind === 'timeoff' ? 'mid' : it.kind === 'special' || isHol(it) ? 'bot' : markOf(it.x) ? 'head' : 'top'; out[b].push(it); });
    const sp = specialOn(d), named = [...eventsOn(d).flatMap((x) => [[x.title], ...(x.replaces ? [[x.replaces]] : [])]), ...(sp ? [[sp.name, true]] : [])];
    builtinOn(d).filter((b) => !named.some(([nm, loose]) => holLike(nm, b.name, loose))).forEach((b) => out.bot.push({ kind: 'builtin', b, from: d, to: d, title: b.name }));
    if (!sp && usualOn(d) && usualOn(d).closed) out.bot.unshift({ kind: 'usualshut', from: d, to: d, title: 'Closed (usual)' });
    return out;
  }
  // the day's bands, one line each (only the ones with something), as on the Calendar; double-click or right-click
  // for the Day details and more
  function dayBandsEl(d) {
    const b = dayBandItems(d), look = dayLook(d), st = storeHoursOn(d), sp = specialOn(d);
    const open = (it) => (e) => { e.stopPropagation(); if (it.kind === 'builtin') eventDialog(null, { from: d, to: d, title: it.b.name, holiday: it.b.type, replaces: it.b.name }); else if (it.kind === 'usualshut') { calGo(); } else calOpen(it); };
    const pill = (it) => {
      const multi = it.from !== it.to, when = multi ? ` · ${datesOnly(it)}` : '';
      const cls = it.kind === 'timeoff' ? `cal-span ${it.status}` : it.kind === 'event' && !(holEvent(it.x)) ? `cal-span ev${it.x.movedFrom ? ' urgent' : ''}`
        : `cal-hol ${it.kind === 'builtin' ? it.b.type : it.kind === 'usualshut' ? 'sp shut' : it.kind === 'special' ? (holSpecial(it.x) ? holSpecialType(it.x) : 'sp' + (it.x.closed ? ' shut' : '')) : holEventType(it.x)}`;
      const text = it.kind === 'timeoff' ? `${it.status === 'requested' ? '? ' : ''}${it.who} · ${it.title}${it.hours ? ` ${clockShort(it.hours[0])}–${clockShort(it.hours[1])}` : ''}${when}`
        : it.kind === 'special' ? `${it.x.name || 'Special hours'} · ${specialShort(it.x)}${when}` : it.kind === 'builtin' || it.kind === 'usualshut' ? it.title : `${it.hours ? clockShort(it.hours[0]) + ' ' : ''}${it.title}${when}`;
      return h('button', { type: 'button', class: 'db-pill ' + cls, title: it.kind === 'builtin' ? `${it.b.name}: click to change its name or add details` : it.kind === 'usualshut' ? 'The store is usually closed this day' : calTip(it), onclick: open(it) }, text);
    };
    const row = (key, label, items) => (items.length ? h('div', { class: 'db-row ' + key }, h('span', { class: 'db-lab' }, label), h('div', { class: 'db-items' }, items.map(pill))) : null);
    const head = h('div', { class: 'db-row head' }, h('span', { class: 'db-lab' }, 'Day'),
      h('div', { class: 'db-items' },
        h('span', { class: 'db-hours' + (st && st.closed ? ' shut' : sp ? ' special' : '') }, !st ? 'Store hours not set' : st.closed ? 'Store closed' : `Store open ${clockShort(st.open)}–${clockShort(st.close)}${sp ? ' (special)' : ''}`),
        b.head.map((it) => { const k = markOf(it.x); return h('button', { type: 'button', class: 'cal-sign' + (it.x.movedFrom ? ' urgent' : ''), title: calTip(it), onclick: open(it) }, k === 'period' ? h('span', { class: 'cal-eop-key' }, String(parseIso(d).getDate())) : markSvg(k), ` ${it.title}${it.hours ? ' ' + clockShort(it.hours[0]) : ''}`); }),
        look && look.pics ? h('span', { class: 'db-pics' }, look.pics.map((p) => picEl(p, 'cal-dpic'))) : null,
        look && look.note ? h('span', { class: 'db-note', title: look.note }, '✎ ' + look.note) : null));
    return h('div', { class: 'db', style: lookStyle(d), title: 'Double-click for this day’s details; right-click for more',
      ondblclick: (e) => { if (!e.target.closest('button')) dayDialog(d); }, oncontextmenu: (e) => { if (!e.target.closest('button')) { calPick.days.clear(); dayMenu(d, e); } } },
      head, row('top', 'Events', b.top), row('mid', 'Time off', b.mid), row('bot', 'Store', b.bot));
  }
  // under each day's button: a thin line for each band with something in it (and the day's colour)
  function dayBandLines(d) {
    const b = dayBandItems(d), has = (k) => b[k].length, names = { top: 'events', mid: 'time off', bot: 'holiday or store hours' };
    const on = ['top', 'mid', 'bot'].filter(has);
    return on.length ? h('span', { class: 'day-blines', title: on.map((k) => `${names[k]}: ${b[k].map((it) => (it.kind === 'timeoff' ? it.who : it.title)).join(', ')}`).join('\n') }, on.map((k) => h('i', { class: k }))) : null;
  }
  // the events with a time today: a dashed line on the timeline and a flag over the hours
  const timedEvents = (d) => dayBandItems(d).top.concat(dayBandItems(d).head).filter((it) => it.hours && it.hours[0] >= DAY_START && it.hours[0] <= DAY_END);

  // ---------- the people for the day, in groups ----------
  function peopleCard(d) {
    const week = weekOf(d), onSched = new Set(shiftsOn(d).map((s) => s.staffId));
    const groups = { sched: [], can: [], asked: [], off: [], cant: [] };
    sortStaff(plan.staff.filter((p) => p.active || onSched.has(p.id))).forEach((p) => {
      if (onSched.has(p.id)) { groups.sched.push(p); return; }
      const allDay = timeOffOn(p, d).filter((t) => !t.hours), st0 = setFor(p, d), wh = personWeekHours(p.id, week);
      const len = st0.start != null && st0.end != null && st0.end > st0.start ? (st0.end - st0.start) / 60 : 0;
      if (allDay.some((t) => t.status === 'approved')) groups.off.push(p);
      else if (allDay.some((t) => t.status === 'requested')) groups.asked.push(p);
      else if (offOn(p, d) || (st0.start != null && st0.end != null && availIssue(p, d, { start: st0.start, end: st0.end })) || (p.maxHours > 0 && wh + len > p.maxHours)) groups.cant.push(p);
      else groups.can.push(p);
    });
    const menuFor = (p) => (e) => { e.preventDefault(); popMenu(e.clientX, e.clientY, `${p.name} · ${dayName(d)}`, [['Add with the usual shift', () => addShift(d, p.id)], ['Add at other times…', () => anotherShiftDialog(d, p.id)], ['Day off request…', () => dayOffRequest(p, d)], ['Not available some hours (appointment)…', () => dayOffRequest(p, d, [540, 660])], ['Time off…', () => timeOffDialog(p)]]); };
    // a person's chip: name, role and hours this week, and why not (in words)
    const chip = (p, kind) => {
      const wh = personWeekHours(p.id, week), st0 = setFor(p, d), allDay = timeOffOn(p, d).filter((t) => !t.hours), away = timeOffOn(p, d);
      const len = st0.start != null && st0.end != null && st0.end > st0.start ? (st0.end - st0.start) / 60 : 0;
      const why = allDay.length ? [...new Set(allDay.map((t) => (TIME_OFF_WHY[t.why] || 'Time off') + (t.status === 'requested' ? ' (asked)' : '')))].join(', ') : offOn(p, d) ? 'OFF day' : '';
      const range = !why && st0.start != null && st0.end != null && !!availIssue(p, d, { start: st0.start, end: st0.end });
      const over = !why && p.maxHours > 0 && wh + len > p.maxHours;
      const mine = shiftsOn(d).filter((s) => s.staffId === p.id);
      const tip = [kind === 'sched' ? `On the schedule ${mine.map((s) => `${clock(s.start)} – ${clock(s.end)}`).join(', ')}` : null, away.length ? timeOffIssue(p, d, null) || '' : null, offOn(p, d) ? availIssue(p, d) : null,
        st0.from != null ? `Available ${clock(st0.from)} – ${clock(st0.to)}` : null, st0.start != null ? `Usual ${isWkend(d) ? 'weekend' : 'weekday'} shift ${clock(st0.start)} – ${clock(st0.end)}` : null, `${hrs(wh)} h this week${p.maxHours ? ` (max ${p.maxHours})` : ''}`, p.notes || null,
        kind === 'sched' ? 'Right-click their shift on the timeline to change it' : kind === 'off' ? 'Click to see the time off' : kind === 'can' ? 'Click to add them with their usual shift; right-click for more' : 'Click to add them anyway; right-click for more'].filter(Boolean).join('\n');
      const click = kind === 'sched' ? null : kind === 'off' ? () => { const t = allDay.find((x) => x.status === 'approved'); if (t) timeOffDialog(p, t); }
        : kind === 'asked' ? () => confirmBox(`Add ${p.name}?`, `${p.name} asked for this day off (${why}). Add them with their usual shift anyway?`, 'Add anyway', () => addShift(d, p.id)) : () => addShift(d, p.id);
      return h('button', { type: 'button', class: 'chip pg-' + kind, title: tip, onclick: click, oncontextmenu: kind === 'sched' ? (e) => e.preventDefault() : menuFor(p) },
        `${p.name} `, h('small', null, `(${ROLES[p.role].label}) · ${kind === 'sched' ? mine.map((s) => `${clockShort(s.start)}–${clockShort(s.end)}`).join(', ') : hrs(wh) + ' h'}${away.some((t) => t.hours) && !allDay.length ? ' · off ' + away.filter((t) => t.hours).map((t) => `${clock(t.hours[0], true)}–${clock(t.hours[1], true)}`).join(', ') : ''}`,
          kind !== 'sched' && why ? h('span', { class: 'na-why' }, ' · ' + why) : kind !== 'sched' && range ? h('span', { class: 'na-range' }, ' · out of range') : null,
          kind !== 'sched' && over ? h('span', { class: wh >= p.maxHours ? 'na-why' : 'na-range', title: `${hrs(wh)} h this week; their usual shift (${hrs(len)} h) would make ${hrs(wh + len)} h, over their ${p.maxHours} h max` }, ` · O${p.maxHours}`) : null));
    };
    const G = [['sched', 'Scheduled', 'On the schedule today, with their hours'], ['can', 'Can work', 'Free today, their usual shift fits: click to add'], ['asked', 'Asked off', 'Asked for the day off, still to approve'],
      ['off', 'Off', 'Approved time off'], ['cant', 'Can’t work', 'Not available, out of their hours, or over their weekly max']];
    return h('div', { class: 'card people-card' },
      h('div', { class: 'inline' }, h('h2', { style: { margin: 0 } }, 'People today'), h('span', { class: 'muted small' }, 'Click a name to add them with their usual shift; right-click for other times or a day off request. Someone already working can get a second (split) shift: right-click their shift.')),
      plan.staff.length ? G.filter(([k]) => groups[k].length).map(([k, label, tip]) => h('div', { class: 'pg pg-row-' + k }, h('span', { class: 'pg-lab', title: tip }, label, h('small', null, String(groups[k].length))), h('div', { class: 'unsched' }, groups[k].map((p) => chip(p, k)))))
        : h('p', { class: 'hint', style: { padding: '10px 0 0' } }, 'No staff yet. Add people on the Staff tab.'),
      h('div', { class: 'legend no-print', style: { marginTop: '8px' } }, 'Tips: drag a shift to move it · drag its left or right edge to change start or finish (15-minute steps) · click for notes · double-click to type exact times · right-click to edit, split, add another shift that day, a day off request, or remove · Ctrl+Z undoes'));
  }
