  // ===================================================================
  // Hours by section, and day / week totals
  // ===================================================================
  const hoursOn = (id, d) => shiftsOn(d).filter((s) => s.staffId === id).reduce((a, s) => a + len(s), 0);
  const weekSoFar = (id, d) => weekDays(weekOf(d)).filter((x) => x <= d).reduce((t, x) => t + hoursOn(id, x), 0);
  const PLURAL = { mgr: 'Managers', sup: 'Supervisors', tm: 'Team Members', trn: 'New Hires' };
  function hoursPanel(d) {
    const w = weekOf(d), days = weekDays(w);
    const cols = GROUPS.map(([g, label]) => {
      const people = sortStaff(plan.staff.filter((p) => ROLES[p.role].group === g && (p.active || personWeekHours(p.id, w))));
      if (!people.length) return null;
      const rows = people.map((p) => {
        const today = hoursOn(p.id, d), wk = personWeekHours(p.id, w), over = p.maxHours && wk > p.maxHours;
        return h('tr', { class: today ? '' : 'off' }, h('td', null, p.name),
          h('td', { class: 'num' }, today ? hrs(today) : '—'), h('td', { class: 'num' }, hrs(weekSoFar(p.id, d))),
          h('td', { class: 'num ' + (over ? 'bad' : ''), title: over ? `Over ${p.maxHours} h` : '' }, hrs(wk) + (over ? ' !' : '')));
      });
      const sum = (fn) => people.reduce((t, p) => t + fn(p.id), 0);
      return h('div', { class: 'sec-hours' }, h('h3', null, label),
        h('table', { class: 't compact' },
          h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', { class: 'num' }, 'Today'), h('th', { class: 'num' }, 'Week so far'), h('th', { class: 'num' }, 'Week total'))),
          h('tbody', null, rows),
          h('tfoot', null, h('tr', null, h('td', null, `${label} total`), h('td', { class: 'num' }, hrs(sum((id) => hoursOn(id, d)))), h('td', { class: 'num' }, hrs(sum((id) => weekSoFar(id, d)))), h('td', { class: 'num' }, hrs(sum((id) => personWeekHours(id, w))))))));
    }).filter(Boolean);
    const soFar = days.filter((x) => x <= d).reduce((t, x) => t + dayHours(x), 0), whole = days.reduce((t, x) => t + dayHours(x), 0);
    const tDay = targetHours(d), tWeek = days.reduce((t, x) => t + (targetHours(x) || 0), 0);
    const tile = (label, value, cls) => h('div', { class: 'tile' }, h('span', null, label), h('b', { class: cls || '' }, value));
    return h('div', { class: 'card' },
      h('div', { class: 'inline' }, h('h2', { style: { margin: 0 } }, 'Hours by section'), h('span', { class: 'muted small' }, `Today is ${dayName(d)}. Week so far counts Monday to ${dayName(d)}.`)),
      cols.length ? h('div', { class: 'sec-grid' }, cols) : h('p', { class: 'hint', style: { marginTop: '8px' } }, 'Nobody is scheduled this week yet.'),
      h('div', { class: 'summary totals' },
        tile('Total hours today', hrs(dayHours(d))),
        tile('Target today', tDay == null ? '—' : hrs(tDay)),
        tile('Total week so far', hrs(soFar)),
        tile('Total whole week', hrs(whole)),
        tile('Target week', hrs(tWeek)),
        tile('Week variance', signed(whole - tWeek), varClass((whole - tWeek) / 3))));
  }

