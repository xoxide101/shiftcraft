  // ===================================================================
  // Copy and clear: day, week, month (any dates, including past ones)
  // ===================================================================
  const daysFrom = (a, n) => Array.from({ length: n }, (_, i) => addDays(a, i));
  const rangeText = (a, n) => (n === 1 ? longDate(a) : `${shortDate(a)} – ${shortDate(addDays(a, n - 1))}, ${parseIso(addDays(a, n - 1)).getFullYear()}`);
  function copyAnyDialog(kind) {
    const n = kind === 'day' ? 1 : kind === 'week' ? 7 : plan.weeks * 7;
    const norm = (v) => (kind === 'day' ? v : mondayOf(v));
    const cur = kind === 'day' ? ui.day : kind === 'week' ? weekDays(weekOf(ui.day))[0] : plan.startDate;
    const src = h('input', { class: 'input', type: 'date', value: addDays(cur, kind === 'day' ? -7 : -n) });
    const dst = h('input', { class: 'input', type: 'date', value: cur });
    const fc = h('input', { type: 'checkbox' });
    const info = h('p', { class: 'hint' });
    const what = { day: 'day', week: 'week', month: `month (${plan.weeks} week${plan.weeks > 1 ? 's' : ''})` }[kind];
    const upd = () => {
      if (!src.value || !dst.value) { info.textContent = 'Pick both dates.'; return; }
      const a = norm(src.value), b = norm(dst.value);
      const sc = daysFrom(a, n).reduce((t, d) => t + shiftsOn(d).length, 0), dc = daysFrom(b, n).reduce((t, d) => t + shiftsOn(d).length, 0);
      info.textContent = a === b ? 'Pick two different dates.' : `${rangeText(a, n)} has ${sc} shift${sc === 1 ? '' : 's'}. ${sc ? 'They' : 'Nothing'} will be copied to ${rangeText(b, n)}${dc ? `, replacing the ${dc} shift${dc === 1 ? '' : 's'} there` : ''}.${kind === 'day' ? '' : ' Weeks always start on Monday.'}`;
      info.className = sc ? 'hint' : 'hint warn';
    };
    src.addEventListener('change', upd); dst.addEventListener('change', upd); dst.addEventListener('input', upd); src.addEventListener('input', upd);
    const preset = (label, off) => h('button', { class: 'btn sm', onclick: () => { src.value = addDays(norm(dst.value || cur), off); upd(); } }, label);
    const presets = kind === 'day' ? [preset('Same day last week', -7), preset('Same day 4 weeks ago', -28), preset('Day before', -1)]
      : kind === 'week' ? [preset('Last week', -7), preset('2 weeks ago', -14), preset('4 weeks ago', -28)]
        : [preset(`Previous ${plan.weeks} weeks`, -n), preset('A year ago (52 weeks)', -364)];
    upd();
    modal({ title: `Copy a ${what}`, body: [
      h('label', { class: 'field' }, h('span', null, `Copy from the ${kind} ${kind === 'day' ? 'on' : 'starting'}`), src),
      h('div', { class: 'inline' }, presets),
      h('label', { class: 'field' }, h('span', null, `Paste into the ${kind} ${kind === 'day' ? 'on' : 'starting'}`), dst),
      h('label', { class: 'check' }, fc, ' Also copy forecasts'),
      info,
      h('p', { class: 'hint' }, 'Any dates work, including past ones you planned before. Shifts keep their weekday and times. You can undo this.')],
    actions: [{ label: 'Cancel' }, { label: 'Copy', primary: true, onClick: () => {
      if (!src.value || !dst.value) return false;
      const a = norm(src.value), b = norm(dst.value); if (a === b) return false;
      const from = daysFrom(a, n), to = daysFrom(b, n);
      const count = from.reduce((t, d) => t + shiftsOn(d).length, 0);
      change(() => to.forEach((d, i) => {
        plan.shifts[d] = shiftsOn(from[i]).map((s) => ({ ...s, id: uid() }));
        if (fc.checked) { if (plan.forecast[from[i]] != null) plan.forecast[d] = plan.forecast[from[i]]; else delete plan.forecast[d]; }
      }));
      const inPlan = planDays().includes(to[0]);
      if (inPlan) { ui.day = to[0]; render(); }
      toast(`Copied ${count} shift${count === 1 ? '' : 's'} to ${rangeText(b, n)}${inPlan ? '' : ' (outside the weeks shown; change the plan dates in Settings to see it)'}`);
    } }] });
  }
  function clearRange(kind) {
    const days = kind === 'day' ? [ui.day] : kind === 'week' ? weekDays(weekOf(ui.day)) : planDays();
    const n = days.reduce((t, d) => t + shiftsOn(d).length, 0);
    const what = kind === 'day' ? `${dayName(ui.day)} ${shortDate(ui.day)}` : kind === 'week' ? `week ${weekOf(ui.day) + 1}` : `all ${plan.weeks} weeks`;
    if (!n) { toast(`Nothing is scheduled in ${what}.`); return; }
    confirmBox(`Clear ${what}?`, `${n} shift${n === 1 ? '' : 's'} will be removed and everyone goes back to Unscheduled. Forecasts and past sales are kept. You can undo this.`, 'Clear', () => change(() => days.forEach((d) => { plan.shifts[d] = []; })));
  }

