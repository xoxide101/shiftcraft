  // ===================================================================
  // Screens
  // ===================================================================
  const TABS = [['schedule', 'Schedule'], ['week', 'Week'], ['calendar', 'Calendar'], ['forecast', 'Forecast'], ['reports', 'Reports'], ['handoff', 'Hand-off'], ['staff', 'Staff'], ['company', 'Company & Location'], ['border', 'Border designer']];
  function render() {
    if (!planDays().includes(ui.day)) ui.day = plan.startDate;
    $('#tabs').replaceChildren(...TABS.map(([k, l]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(ui.tab === k), onclick: () => { ui.tab = k; persist(); render(); } }, l)));
    $('#store-name').textContent = placeName() + (plan.example ? ' (example data)' : '');
    $('#doc-name').textContent = ui.fileName || '';
    fillMonthSelect();
    const main = $('#main');
    main.replaceChildren();
    ({ schedule: scheduleView, week: weekView, calendar: calendarView, forecast: forecastView, reports: reportsView, handoff: handoffView, staff: staffView, company: companyView, border: borderView })[ui.tab](main);
    document.title = (ui.fileName ? ui.fileName + ' – ' : '') + 'ShiftCraft';
    paintThemeButton();
  }

  function summary(d) {
    const w = weekOf(d);
    const wv = weekDays(w).map(varianceHours);
    const weekVar = wv.every((v) => v == null) ? null : wv.reduce((a, v) => a + (v || 0), 0);
    const f = forecastOf(d), t = targetHours(d), v = varianceHours(d);
    const tile = (label, value, cls, title) => h('div', { class: 'tile' + (cls === 'wk' || /^Week/.test(label) ? ' wk' : ''), title }, h('span', null, label), h('b', { class: cls === 'wk' ? '' : cls || '' }, value));
    return h('div', { class: 'summary' },
      tile('Forecast', money(f), '', plan.forecast[d] != null && plan.forecast[d] !== '' ? 'Your forecast' : 'Trend from past sales'),
      tile('Target hours', t == null ? '—' : hrs(t), '', `Forecast ÷ $${plan.splh} per labor hour`),
      tile('Scheduled hours', hrs(dayHours(d))),
      tile('Hours variance', v == null ? '—' : signed(v), varClass(v), 'Scheduled minus target. Negative = fewer hours than target.'),
      // the week: scheduled so far (Monday to this day), the whole week, and the week against its target
      tile('Week so far', hrs(weekDays(w).filter((x) => x <= d).reduce((t, x) => t + dayHours(x), 0)), 'wk', `Scheduled hours Monday to ${dayName(d)}`),
      tile('Week total', hrs(weekDays(w).reduce((t, x) => t + dayHours(x), 0)), 'wk', 'Scheduled hours, the whole week'),
      tile('Week variance', weekVar == null ? '—' : signed(weekVar), varClass(weekVar == null ? null : weekVar / 3), 'Whole week, scheduled minus target. Days you have not scheduled yet count as 0 hours.'),
      h('button', { type: 'button', class: 'btn sm sum-jump no-print', title: 'The Forecast: sales by day, the trend, and the hours they call for', onclick: () => { ui.tab = 'forecast'; persist(); render(); } }, 'Forecast ›'));
  }

  function dayPicker() {
    const weeks = h('div', { class: 'weekout' }, h('span', null, 'Week out'), Array.from({ length: plan.weeks }, (_, w) => {
      const days = weekDays(w);
      return h('button', { class: 'btn sm', 'aria-pressed': String(weekOf(ui.day) === w), title: `${shortDate(days[0])} – ${shortDate(days[6])}`, onclick: () => { ui.day = days[(parseIso(ui.day).getDay() + 6) % 7]; persist(); render(); } },
        h('b', null, String(w + 1)), h('span', { class: 'muted small' }, ` ${shortDate(days[0])}–${parseIso(days[6]).getMonth() === parseIso(days[0]).getMonth() ? parseIso(days[6]).getDate() : shortDate(days[6])}`));
    }));
    const days = h('div', { class: 'days' }, weekDays(weekOf(ui.day)).map((d) => h('button', { class: 'day', 'aria-current': String(d === ui.day), style: dayLook(d) && dayLook(d).color && d !== ui.day ? { backgroundImage: `linear-gradient(${dayLook(d).color}26, ${dayLook(d).color}26)` } : null, onclick: () => { ui.day = d; persist(); render(); }, ondblclick: () => dayDialog(d), oncontextmenu: (e) => { calPick.days.clear(); dayMenu(d, e); } },
      dayBandLines(d),
      h('b', null, `${dayName(d, 'short')} ${parseIso(d).getDate()}`, ' ', eventsOn(d).filter((x) => markOf(x) && markOf(x) !== 'period' && !holEvent(x)).map((x) => h('span', { class: 'cal-wksign' + (x.movedFrom ? ' urgent' : ''), title: x.title }, markSvg(markOf(x))))), h('small', null, `${hrs(dayHours(d))} h · ${shiftsOn(d).length} ppl`)))); // the day's signs by its name
    return [weeks, days];
  }

