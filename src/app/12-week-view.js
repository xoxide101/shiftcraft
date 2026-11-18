  // ---------- Week overview ----------
  // the week looked at: any week, before or after the plan too (for looking back or ahead); it follows the day picked
  // elsewhere, and the arrows move it a week (‹ ›) or a set of five (« »)
  const weekBrowse = { w: null, day: null };
  function weekView(main) {
    if (weekBrowse.day !== ui.day || weekBrowse.w == null) { weekBrowse.w = weekOf(ui.day); weekBrowse.day = ui.day; }
    const w = weekBrowse.w, days = weekDays(w), inPlan = (k) => k >= 0 && k < plan.weeks;
    const go = (k) => () => { weekBrowse.w = k; if (inPlan(k)) { ui.day = weekDays(k)[0]; weekBrowse.day = ui.day; persist(); } render(); };
    // the five tabs: the set the week is in (plan weeks keep their numbers; others show their Monday)
    const set0 = inPlan(w) && plan.weeks <= 7 ? 0 : Math.floor(w / 5) * 5, set = inPlan(w) && plan.weeks <= 7 ? Array.from({ length: plan.weeks }, (_, k) => k) : Array.from({ length: 5 }, (_, k) => set0 + k);
    const label = (k) => (inPlan(k) ? `Week ${k + 1}` : shortDate(weekDays(k)[0]));
    const nav = (txt, k, title) => h('button', { class: 'btn sm wk-nav', title, 'aria-label': title, onclick: go(k) }, txt);
    const thisWeek = weekOf(iso(new Date()));
    const weeks = h('div', { class: 'wk-browse no-print' },
      nav('«', w - 5, 'Back five weeks'), nav('‹', w - 1, 'The week before'),
      h('div', { class: 'weeks' }, set.map((k) => h('button', { class: 'btn sm' + (inPlan(k) ? '' : ' out'), 'aria-pressed': String(k === w), title: `${shortDate(weekDays(k)[0])} – ${shortDate(weekDays(k)[6])}${inPlan(k) ? '' : k < 0 ? ' (before the plan)' : ' (after the plan)'}`, onclick: go(k) }, label(k)))),
      nav('›', w + 1, 'The week after'), nav('»', w + 5, 'Ahead five weeks'),
      w !== thisWeek ? h('button', { class: 'btn sm ghost', title: 'Back to this week', onclick: go(thisWeek) }, 'This week') : null);
    const staff = sortStaff(plan.staff.filter((p) => p.active || days.some((d) => shiftsOn(d).some((s) => s.staffId === p.id))));
    let lastGroup = null;
    const rows = [];
    staff.forEach((p) => {
      const g = ROLES[p.role].group;
      if (g !== lastGroup) { rows.push(h('tr', { class: 'grp' }, h('td', { colspan: 9 }, GROUPS.find((x) => x[0] === g)[1]))); lastGroup = g; }
      const total = personWeekHours(p.id, w);
      const over = p.maxHours && total > p.maxHours;
      rows.push(h('tr', null, h('td', null, h('b', null, p.name), h('span', { class: 'muted small' }, ` ${ROLES[p.role].short}`)),
        days.map((d) => { const ss = shiftsOf(p, d), s = ss[0], iss = ss.map((x) => availIssue(p, d, x)).filter(Boolean)[0] || (s ? '' : availIssue(p, d, null)); return h('td', { class: 'cellbtn c' + (s && iss ? ' bad' : !s && (offOn(p, d) || offAllDay(p, d)) ? ' muted' : ''), title: [iss, ...ss.filter((x) => x.note).map((x) => 'Note: ' + x.note), 'Open this day'].filter(Boolean).join('\n'), onclick: () => { ui.day = d; ui.tab = 'schedule'; persist(); render(); } }, s ? ss.map((x, j) => [j ? h('br') : null, `${clock(x.start, true)}–${clock(x.end, true)}${availIssue(p, d, x) ? ' !' : ''}`, x.note ? h('div', { class: 'cell-note' }, x.note) : null]) : offAllDay(p, d) ? 'off: ' + (TIME_OFF_WHY[timeOffOn(p, d).find((t) => !t.hours).why] || 'time off').toLowerCase() : offOn(p, d) ? 'n/a' : timeOffOn(p, d).length ? 'off ' + timeOffOn(p, d).map((t) => `${clock(t.hours[0], true)}–${clock(t.hours[1], true)}`).join(', ') : ''); }),
        h('td', { class: 'num ' + (over ? 'bad' : '') }, hrs(total), over ? ` (max ${p.maxHours})` : '')));
    });
    const foot = (label, fn, cls) => h('tr', null, h('td', null, label), days.map((d) => { const v = fn(d); return h('td', { class: 'num ' + (cls ? cls(d) : '') }, v); }), h('td', null, ''));
    main.append(h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h1', { style: { textAlign: 'left', minWidth: 0 } }, `${placeName()} · ${inPlan(w) ? `Week ${w + 1}: ` : 'Week of '}${shortDate(days[0])} – ${shortDate(days[6])}${inPlan(w) ? '' : w < 0 ? ' (before the plan)' : ' (after the plan)'}`), h('span', { class: 'spacer' }), weeks,
        h('button', { class: 'btn sm no-print', onclick: () => copyWeekDialog(w) }, 'Copy week to…'),
        h('button', { class: 'btn sm no-print', onclick: checkDialog }, 'Check schedule…'),
        h('button', { class: 'btn sm no-print', onclick: () => printPageDialog() }, 'Print…')),
      h('div', { class: 'table-wrap', style: { marginTop: '12px' } }, h('table', { class: 't' },
        h('thead', null, h('tr', null, h('th', null, 'Name'), days.map((d) => h('th', { class: 'c' }, `${dayName(d, 'short')} ${parseIso(d).getDate()}`, calMark(d))), h('th', { class: 'num' }, 'Hours'))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 9, class: 'muted' }, 'No staff yet.'))),
        h('tfoot', null,
          foot('Scheduled hours', (d) => hrs(dayHours(d))),
          foot('Forecast', (d) => money(forecastOf(d))),
          foot('Target hours', (d) => (targetHours(d) == null ? '—' : hrs(targetHours(d)))),
          foot('Hours variance', (d) => (varianceHours(d) == null ? '—' : signed(varianceHours(d))), (d) => varClass(varianceHours(d))))))));
  }
  function copyWeekDialog(w) {
    const others = Array.from({ length: plan.weeks }, (_, k) => k).filter((k) => k !== w);
    if (!others.length) { toast('Set the plan to 2 or more weeks in Settings first.'); return; }
    const boxes = others.map((k) => ({ k, el: h('input', { type: 'checkbox', checked: k === w + 1 }) }));
    modal({ title: `Copy week ${w + 1} to…`, body: [h('p', { class: 'hint' }, 'Each chosen week is replaced, day by day. You can undo this.'), boxes.map((b) => h('label', { class: 'check' }, b.el, ` Week ${b.k + 1} (${shortDate(weekDays(b.k)[0])})`))],
      actions: [{ label: 'Cancel' }, { label: 'Copy', primary: true, onClick: () => {
        const ks = boxes.filter((b) => b.el.checked).map((b) => b.k); if (!ks.length) return false;
        change(() => ks.forEach((k) => weekDays(k).forEach((d, i) => { plan.shifts[d] = shiftsOn(weekDays(w)[i]).map((s) => ({ ...s, id: uid() })); })));
        toast('Week copied');
      } }] });
  }

