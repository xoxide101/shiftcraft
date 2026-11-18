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
      const menu = it.kind === 'timeoff' ? (e) => { e.preventDefault(); e.stopPropagation(); popMenu(e.clientX, e.clientY, `${it.who} · ${it.title}`, [...(it.status !== 'approved' ? [['Approve', () => approveTimeOff(it.p, it.t)]] : []), ...(it.status !== 'denied' ? [['Deny', () => denyTimeOff(it.t)]] : []), ['See or change it…', () => calOpen(it)]]); } : null;
      return h('button', { type: 'button', class: 'db-pill ' + cls, title: (it.kind === 'builtin' ? `${it.b.name}: click to change its name or add details` : it.kind === 'usualshut' ? 'The store is usually closed this day' : calTip(it)) + (it.kind === 'timeoff' ? '\nRight-click to approve or deny' : ''), onclick: open(it), oncontextmenu: menu }, text);
    };
    const row = (key, label, items) => (items.length ? h('div', { class: 'db-row ' + key }, h('span', { class: 'db-lab' }, label), h('div', { class: 'db-items' }, items.map(pill))) : null);
    const adds = h('div', { class: 'ibs db-adds' },
      ib('timeoff', 'Add a time off request for this day', () => timeOffDialog(null, null, { from: d, to: d, status: 'requested', why: 'personal' }), { disabled: !plan.staff.some((p) => !p.left) }),
      ib('appt', 'Add an appointment (not available some hours this day)', () => timeOffDialog(null, null, { from: d, to: d, status: 'requested', why: 'appointment', hours: [540, 660] }), { disabled: !plan.staff.some((p) => !p.left) }),
      ib('event', 'Add an event for the store this day', () => eventDialog(null, { from: d, to: d })),
      ib('store', sp ? 'Change this day’s special store hours' : 'Add special store hours (a holiday, closed, open late…)', () => (sp ? specialDialog(sp) : specialDialog(null, { from: d, to: d }))));
    const head = h('div', { class: 'db-row head' }, h('span', { class: 'db-lab' }, 'Day'),
      h('div', { class: 'db-items' },
        h('span', { class: 'db-hours' + (st && st.closed ? ' shut' : sp ? ' special' : '') }, !st ? 'Store hours not set' : st.closed ? 'Store closed' : `Store open ${clockShort(st.open)}–${clockShort(st.close)}${sp ? ' (special)' : ''}`),
        b.head.map((it) => { const k = markOf(it.x); return h('button', { type: 'button', class: 'cal-sign' + (it.x.movedFrom ? ' urgent' : ''), title: calTip(it), onclick: open(it) }, k === 'period' ? h('span', { class: 'cal-eop-key' }, String(parseIso(d).getDate())) : markSvg(k), ` ${it.title}${it.hours ? ' ' + clockShort(it.hours[0]) : ''}`); }),
        look && look.pics ? h('span', { class: 'db-pics' }, look.pics.map((p) => picEl(p, 'cal-dpic'))) : null,
        look && look.note ? h('span', { class: 'db-note', title: look.note }, '✎ ' + look.note) : null), adds);
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
    const menuFor = (p) => (e) => { e.preventDefault(); const asked = timeOffOn(p, d).filter((t) => t.status === 'requested');
      popMenu(e.clientX, e.clientY, `${p.name} · ${dayName(d)}`, [...asked.flatMap((t) => [[`Approve: ${TIME_OFF_WHY[t.why] || 'time off'}`, () => approveTimeOff(p, t)], [`Deny: ${TIME_OFF_WHY[t.why] || 'time off'}`, () => denyTimeOff(t)]]), ['Add with the usual shift', () => addShift(d, p.id)], ['Add at other times…', () => anotherShiftDialog(d, p.id)], ['Day off request…', () => dayOffRequest(p, d)], ['Not available some hours (appointment)…', () => dayOffRequest(p, d, [540, 660])], ['Time off…', () => timeOffDialog(p)]]); };
    // a person's chip: name, role and hours this week, and why not (in words)
    const chip = (p, kind) => {
      const wh = personWeekHours(p.id, week), st0 = setFor(p, d), allDay = timeOffOn(p, d).filter((t) => !t.hours), away = timeOffOn(p, d);
      const len = st0.start != null && st0.end != null && st0.end > st0.start ? (st0.end - st0.start) / 60 : 0;
      const why = allDay.length ? [...new Set(allDay.map((t) => (TIME_OFF_WHY[t.why] || 'Time off') + (t.status === 'requested' ? ' (asked)' : '')))].join(', ') : offOn(p, d) ? 'OFF day' : '';
      const range = !why && st0.start != null && st0.end != null && availIssue(p, d, { start: st0.start, end: st0.end }) ? naShort(p, d, { start: st0.start, end: st0.end }) : '';
      const over = !why && p.maxHours > 0 && wh + len > p.maxHours;
      const mine = shiftsOn(d).filter((s) => s.staffId === p.id);
      const tip = [kind === 'sched' ? `On the schedule ${mine.map((s) => `${clock(s.start)} – ${clock(s.end)}`).join(', ')}` : null, away.length ? timeOffIssue(p, d, null) || '' : null, offOn(p, d) ? availIssue(p, d) : null,
        st0.from != null ? `Available ${clock(st0.from)} – ${clock(st0.to)}` : null, st0.start != null ? `Usual ${isWkend(d) ? 'weekend' : 'weekday'} shift ${clock(st0.start)} – ${clock(st0.end)}` : null, `${hrs(wh)} h this week${p.maxHours ? ` (max ${p.maxHours})` : ''}`, p.notes || null,
        kind === 'sched' ? 'Right-click their shift on the timeline to change it' : kind === 'off' ? 'Click to see the time off' : kind === 'can' ? 'Click to add them with their usual shift; right-click for more' : 'Click to add them anyway; right-click for more'].filter(Boolean).join('\n');
      const click = kind === 'sched' ? null : kind === 'off' ? () => { const t = allDay.find((x) => x.status === 'approved'); if (t) timeOffDialog(p, t); }
        : kind === 'asked' ? () => confirmBox(`Add ${p.name}?`, `${p.name} asked for this day off (${why}). Add them with their usual shift anyway?`, 'Add anyway', () => addShift(d, p.id)) : () => addShift(d, p.id);
      return h('button', { type: 'button', class: 'chip pg-' + kind, title: tip, onclick: click, oncontextmenu: kind === 'sched' ? (e) => e.preventDefault() : menuFor(p) },
        `${p.name} `, h('small', null, `(${ROLES[p.role].label}) · ${kind === 'sched' ? mine.map((s) => `${clockShort(s.start)}–${clockShort(s.end)}`).join(', ') : hrs(wh) + ' h'}${away.some((t) => t.hours) && !allDay.length ? ' · off ' + away.filter((t) => t.hours).map((t) => `${clock(t.hours[0], true)}–${clock(t.hours[1], true)}`).join(', ') : ''}`,
          kind !== 'sched' && why ? h('span', { class: 'na-why' }, ' · ' + why) : kind !== 'sched' && range ? h('span', { class: 'na-range', title: availIssue(p, d, { start: st0.start, end: st0.end }) }, ' · ' + range) : null,
          callFirst(p, d) && kind !== 'off' && kind !== 'asked' ? h('span', { class: 'na-cf', title: callFirstText(p, d) }, ' · call first') : null,
          kind !== 'sched' && over ? h('span', { class: wh >= p.maxHours ? 'na-why' : 'na-range', title: `${hrs(wh)} h this week; their usual shift (${hrs(len)} h) would make ${hrs(wh + len)} h, over their ${p.maxHours} h max` }, ` · O${p.maxHours}`) : null));
    };
    const G = [['sched', 'Scheduled', 'On the schedule today, with their hours'], ['can', 'Can work', 'Free today, their usual shift fits: click to add'], ['asked', 'Asked off', 'Asked for the day off, still to approve'],
      ['off', 'Off', 'Approved time off'], ['cant', 'Can’t work', 'Not available, out of their hours, or over their weekly max']];
    return h('div', { class: 'card people-card' },
      h('div', { class: 'inline' }, h('h2', { style: { margin: 0 } }, 'People today'), h('span', { class: 'muted small' }, 'Click a name to add them with their usual shift; right-click for other times, a day off request, or to approve or deny one.')),
      plan.staff.length ? G.filter(([k]) => groups[k].length).map(([k, label, tip]) => h('div', { class: 'pg pg-row-' + k }, h('span', { class: 'pg-lab', title: tip }, label, h('small', null, String(groups[k].length))), h('div', { class: 'unsched' }, groups[k].map((p) => chip(p, k)))))
        : h('p', { class: 'hint', style: { padding: '10px 0 0' } }, 'No staff yet. Add people on the Staff tab.'),
      h('div', { class: 'legend no-print', style: { marginTop: '8px' } }, 'Tips: drag a shift to move it · drag its left or right edge to change start or finish (15-minute steps) · click for notes · double-click to type exact times · right-click to edit, split, add another shift that day, a day off request, or remove · Ctrl+Z undoes'));
  }

  // ---------- under the timeline: tabs (People today, Hours by section, Time off), and a jump to the Forecast ----------
  let schedTab = 'people'; try { schedTab = localStorage.getItem(KEY + '-schedtab') || 'people'; } catch (e) { /* blocked */ }
  function schedTabs(d) {
    const off = timeOffToday(d), nOff = plan.staff.filter((p) => !p.left).reduce((n, p) => n + (p.timeOff || []).filter((t) => t.from <= d && d <= t.to && t.status !== 'denied').length, 0);
    const people = plan.staff.filter((p) => p.active).length;
    const trainees = traineesOf(d);
    const TABS = [['people', 'People today', String(people)], ['hours', 'Hours by section', hrs(dayHours(d)) + ' h'], ...(off ? [['off', 'Time off', String(nOff)]] : []),
      ['training', 'Training', String(trainees.length)], ['forecast', 'Forecast', money(forecastOf(d))]];
    if (!TABS.some(([k]) => k === schedTab)) schedTab = 'people';
    const body = schedTab === 'hours' ? hoursPanel(d) : schedTab === 'off' ? off : schedTab === 'training' ? trainingPanel(d) : schedTab === 'forecast' ? forecastPanel(d) : peopleCard(d);
    const pick = (k) => () => { schedTab = k; try { localStorage.setItem(KEY + '-schedtab', k); } catch (e) { /* blocked */ } render(); };
    return h('div', { class: 'card sched-tabs' },
      h('div', { class: 'st-bar', role: 'tablist' }, TABS.map(([k, label, n]) => h('button', { type: 'button', role: 'tab', class: 'st-tab', 'aria-selected': String(schedTab === k), onclick: pick(k) }, label, h('span', { class: 'st-n' }, n))),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'st-jump', title: 'The Forecast: sales by day, the trend, and the hours they call for', onclick: () => { ui.tab = 'forecast'; persist(); render(); } }, 'Forecast ›')),
      h('div', { class: 'st-body', role: 'tabpanel' }, body));
  }

  // the week's trainees: the Training group (new hires), and anyone with a training task this week
  const traineesOf = (d) => { const days = weekDays(weekOf(d));
    return sortStaff(plan.staff.filter((p) => !p.left && (ROLES[p.role].group === 'trn' || (p.tasks || []).some((t) => days.includes(t.date))))); };
  // Training: who trains this week, their shifts day by day (who else is on with them), hours, and their tasks
  function trainingPanel(d) {
    const days = weekDays(weekOf(d)), list = traineesOf(d), go = (x) => () => { ui.day = x; persist(); render(); };
    if (!list.length) return h('p', { class: 'hint' }, 'Nobody is in training this week. New hires (the Training group) and anyone with a training task this week show here.');
    const lead = (x, s) => sortStaff(shiftsOn(x).filter((o) => o.staffId !== s.staffId && o.start < s.end && o.end > s.start).map((o) => staffById(o.staffId)).filter((q) => q && ROLES[q.role].group !== 'trn')).slice(0, 2).map((q) => q.name.split(' ')[0]);
    return h('div', { class: 'tr-wrap' }, h('table', { class: 't compact tr-tab' },
      h('thead', null, h('tr', null, h('th', null, 'Trainee'), days.map((x) => h('th', { class: x === d ? 'cur' : '' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); go(x)(); } }, `${dayName(x, 'short')} ${parseIso(x).getDate()}`))), h('th', { class: 'num' }, 'Week'), h('th', null, 'Training tasks this week'))),
      h('tbody', null, list.map((p) => { const ts = (p.tasks || []).filter((t) => days.includes(t.date)).sort((a, b) => a.date.localeCompare(b.date));
        return h('tr', null, h('td', null, h('b', null, p.name), ' ', h('span', { class: 'muted small' }, ROLES[p.role].short)),
          days.map((x) => { const ss = shiftsOn(x).filter((s) => s.staffId === p.id), off = timeOffOn(p, x).some((t) => !t.hours);
            return h('td', { class: (x === d ? 'cur' : '') + (ss.length ? ' on' : ''), title: ss.length ? ss.map((s) => `${clock(s.start)} – ${clock(s.end)}${lead(x, s).length ? ' · with ' + lead(x, s).join(', ') : ''}`).join('\n') : off ? 'Time off' : 'Not on the schedule' },
              ss.length ? ss.map((s) => h('div', null, `${clockShort(s.start)}–${clockShort(s.end)}`, lead(x, s).length ? h('div', { class: 'muted small' }, 'with ' + lead(x, s).join(', ')) : null)) : off ? h('span', { class: 'muted small' }, 'off') : h('span', { class: 'muted' }, '—')); }),
          h('td', { class: 'num' }, hrs(personWeekHours(p.id, weekOf(d)))),
          h('td', null, ts.length ? ts.map((t) => h('div', { class: 'small' }, `${t.done ? '☑' : '☐'} ${dayName(t.date, 'short')}: ${t.text}`)) : h('span', { class: 'muted small' }, 'none'), ' ',
            h('button', { class: 'btn sm ghost', type: 'button', onclick: () => tasksDialog(p) }, 'Tasks…'))); }))));
  }
  // Forecast: this week's days: forecast, target hours, scheduled hours, the difference; the day being worked on marked
  function forecastPanel(d) {
    const days = weekDays(weekOf(d)), go = (x) => (e) => { e.preventDefault(); ui.day = x; persist(); render(); };
    const sum = (fn) => days.reduce((a, x) => a + (fn(x) || 0), 0), anyT = days.some((x) => targetHours(x) != null);
    const row = (label, fn, fmt, tot, cls) => h('tr', null, h('th', null, label), days.map((x) => { const v = fn(x); return h('td', { class: 'num' + (x === d ? ' cur' : '') + (cls ? ' ' + cls(v) : '') }, v == null ? '—' : fmt(v)); }), h('td', { class: 'num tot' + (cls ? ' ' + cls(tot) : '') }, tot == null ? '—' : fmt(tot)));
    return h('div', null, h('table', { class: 't compact fc-tab' },
      h('thead', null, h('tr', null, h('th', null, ''), days.map((x) => h('th', { class: 'num' + (x === d ? ' cur' : '') }, h('a', { href: '#', onclick: go(x) }, `${dayName(x, 'short')} ${parseIso(x).getDate()}`))), h('th', { class: 'num' }, 'Week'))),
      h('tbody', null,
        row('Forecast sales', forecastOf, money, sum(forecastOf)),
        row('Target hours', targetHours, hrs, anyT ? sum(targetHours) : null),
        row('Scheduled hours', dayHours, hrs, sum(dayHours)),
        row('Difference', varianceHours, signed, anyT ? sum(varianceHours) : null, (v) => varClass(v == null ? null : v)))),
      h('p', { class: 'muted small', style: { margin: '6px 0 0' } }, `Target hours = forecast sales ÷ $${plan.splh} per labor hour. Difference = scheduled minus target (negative: fewer hours than the target). `,
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); ui.tab = 'forecast'; persist(); render(); } }, 'Change the forecast on the Forecast tab ›')));
  }
