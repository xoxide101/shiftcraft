  // ===================================================================
  // Schedule files for any span of days (a day, a week, weeks, a month)
  // ===================================================================
  function scheduleRange(start, nDays, month) {
    const days = daysFrom(start, nDays);
    const used = new Set();
    days.forEach((d) => shiftsOn(d).forEach((s) => used.add(s.staffId)));
    return { app: 'ShiftCraft', kind: 'weeks', version: 5, company: plan.company, location: plan.location, splh: plan.splh,
      startDate: start, days: nDays, weeks: nDays % 7 === 0 ? nDays / 7 : 0, month: month || null,
      people: plan.staff.filter((p) => used.has(p.id)).map((p) => ({ id: p.id, name: p.name, role: p.role })),
      shifts: Object.fromEntries(days.map((d) => [d, shiftsOn(d)])),
      forecast: Object.fromEntries(days.filter((d) => plan.forecast[d] != null && plan.forecast[d] !== '').map((d) => [d, plan.forecast[d]])),
      history: Object.fromEntries(Object.entries(plan.history).filter(([d]) => d >= addDays(start, -28) && d <= days[days.length - 1])) };
  }
  // A day file goes onto the day you pick.
  function placeDaysDialog(data, name) {
    const n = Math.max(1, +data.days || 1), fileDays = daysFrom(data.startDate, n);
    const people = data.people || data.staff || [];
    const when = h('select', { class: 'input' }, h('option', { value: data.startDate }, `Its own date: ${dayName(data.startDate)} ${shortDate(data.startDate)}`), data.startDate !== ui.day ? h('option', { value: ui.day }, `The day you are viewing: ${dayName(ui.day)} ${shortDate(ui.day)}`) : null, h('option', { value: 'pick' }, 'Another date…'));
    const pick = h('input', { class: 'input', type: 'date', value: ui.day, hidden: true });
    when.addEventListener('change', () => { pick.hidden = when.value !== 'pick'; });
    modal({ title: `Open ${n === 1 ? 'a day' : n + ' days'}: ${shortDate(fileDays[0])}${n > 1 ? ' – ' + shortDate(fileDays[n - 1]) : ''}`, body: [
      h('p', { class: 'muted' }, `From ${name}. ${people.length} people; anyone not on your team is added.`),
      h('label', { class: 'field' }, h('span', null, 'Put it on'), when), pick,
      h('p', { class: 'hint' }, 'Shifts already on that day are replaced. You can undo this.')],
    actions: [{ label: 'Cancel' }, { label: 'Open', primary: true, onClick: () => {
      const start = when.value === 'pick' ? pick.value : when.value;
      if (!start) return false;
      const target = daysFrom(start, n);
      change(() => {
        dropExample();
        const map = mergeStaff(people);
        fileDays.forEach((fd, i) => {
          plan.shifts[target[i]] = (data.shifts[fd] || []).map((s) => ({ ...s, id: uid(), staffId: map[s.staffId] || s.staffId }));
          if (data.forecast && data.forecast[fd] != null) plan.forecast[target[i]] = data.forecast[fd];
        });
        Object.assign(plan.history, data.history || {});
        if (planDays().includes(target[0])) ui.day = target[0];
      });
      ui.fileName = name; render(); toast(planDays().includes(target[0]) ? `Opened ${name}` : `Opened ${name} onto ${shortDate(target[0])} (outside the weeks shown; pick that month at the top to see it)`);
    } }] });
  }
  // The one Save dialog: what, then (for schedules) how much.
  function saveAsDialog(preset = {}) {
    const c = { what: preset.what || 'all', range: preset.range || 'week' };
    const wkFrom = h('select', { class: 'input' }, Array.from({ length: plan.weeks }, (_, k) => h('option', { value: k, selected: k === weekOf(ui.day) }, `Week ${k + 1} (${shortDate(weekDays(k)[0])})`)));
    const wkCount = h('select', { class: 'input' }, Array.from({ length: plan.weeks }, (_, k) => h('option', { value: k + 1, selected: k === 1 }, `${k + 1} week${k ? 's' : ''}`)));
    const custom = h('div', { class: 'inline', hidden: c.range !== 'weeks' }, h('label', { class: 'field' }, h('span', null, 'Starting'), wkFrom), h('label', { class: 'field' }, h('span', null, 'How many'), wkCount));
    const ranges = [['day', `Day (${dayName(ui.day, 'short')} ${shortDate(ui.day)})`], ['week', `Week (week ${weekOf(ui.day) + 1})`], ['month', `Month (all ${plan.weeks} weeks)`], ['weeks', 'Weeks…']];
    const seg = h('div', { class: 'seg' }, ranges.map(([v, l]) => h('button', { type: 'button', class: 'btn sm', 'aria-pressed': String(c.range === v), onclick: (e) => { c.range = v; seg.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); custom.hidden = v !== 'weeks'; } }, l)));
    const schedBox = h('div', { class: 'stack', hidden: c.what !== 'schedule' }, h('span', { class: 'muted small' }, 'How much schedule'), seg, custom);
    const opts = [['all', 'Everything', 'team + schedule: every week and month planned, forecasts, past sales and settings (a Location file)'], ['team', 'Team only', 'the employee list with roles, usual shifts, availability, tasks and checklist'], ['schedule', 'Schedule only', 'shifts, notes and forecasts for a day, week, month or weeks you pick']];
    const radios = h('div', { class: 'stack' }, opts.map(([v, l, desc]) => h('label', { class: 'check', style: { alignItems: 'flex-start' } },
      h('input', { type: 'radio', name: 'savewhat', value: v, checked: c.what === v, onchange: () => { c.what = v; schedBox.hidden = v !== 'schedule'; } }), h('span', null, h('b', null, l), ` – ${desc}`))));
    modal({ title: 'Save', wide: true, body: [h('span', { class: 'muted small' }, 'Save what'), radios, schedBox, h('p', { class: 'hint' }, 'Files are small .json files you can keep, copy or email. Open them with File › Open.')],
      actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
        if (c.what === 'all') saveFile('location', { as: true });
        else if (c.what === 'team') saveFile('team', { as: true });
        else if (c.range === 'day') saveFile('day', { as: true });
        else if (c.range === 'week') saveFile('weeks', { first: weekOf(ui.day), count: 1, as: true });
        else if (c.range === 'month') saveFile('weeks', { first: 0, count: plan.weeks, as: true });
        else saveFile('weeks', { first: +wkFrom.value, count: +wkCount.value, as: true });
      } }] });
  }

