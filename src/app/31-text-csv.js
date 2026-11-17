  // ===================================================================
  // Text and CSV export
  // ===================================================================
  // on paper: a closed day has nobody on it (onPaper, 04-calculations.js)
  const weekText = onPaper(weekTextBody);
  function weekTextBody(w) {
    const days = weekDays(w);
    const out = [`${[plan.company, plan.location].filter(Boolean).join(' - ')}`, `Week of ${longDate(days[0])} - ${longDate(days[6])}`, ''];
    days.forEach((d) => {
      out.push(`${longDate(d).toUpperCase()}   (${hrs(dayHours(d))} h scheduled, forecast ${money(forecastOf(d))}, target ${targetHours(d) == null ? '-' : hrs(targetHours(d))} h)`);
      const list = shiftsOn(d).map((s) => ({ s, p: staffById(s.staffId) }))
        .sort((a, b) => GROUPS.findIndex((g) => g[0] === ROLES[a.p.role].group) - GROUPS.findIndex((g) => g[0] === ROLES[b.p.role].group) || a.s.start - b.s.start);
      if (!list.length) out.push('  (nobody scheduled)');
      list.forEach((x) => out.push(`  ${GROUPS.find((g) => g[0] === ROLES[x.p.role].group)[1].padEnd(12)} ${x.p.name.padEnd(24)} ${ROLES[x.p.role].short.padEnd(4)} ${clock(x.s.start).padStart(8)} - ${clock(x.s.end).padStart(8)}  ${hrs(len(x.s)).padStart(5)} h${x.s.note ? '   Note: ' + x.s.note : ''}`));
      out.push('');
    });
    out.push('HOURS THIS WEEK');
    sortStaff(plan.staff).forEach((p) => { const t = personWeekHours(p.id, w); if (t) out.push(`  ${p.name.padEnd(24)} ${hrs(t).padStart(5)} h${p.maxHours && t > p.maxHours ? `  OVER MAX (${p.maxHours})` : ''}`); });
    return out.join('\r\n');
  }
  // on paper: a closed day has nobody on it (onPaper, 04-calculations.js)
  const csvRows = onPaper(csvRowsBody);
  function csvRowsBody(weeks) {
    const cell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['Date', 'Day', 'Job group', 'Name', 'Role', 'Start', 'Finish', 'Hours', 'Note']];
    weeks.forEach((w) => weekDays(w).forEach((d) => shiftsOn(d).map((s) => ({ s, p: staffById(s.staffId) }))
      .sort((a, b) => a.s.start - b.s.start)
      .forEach((x) => rows.push([usDate(d), dayName(d), GROUPS.find((g) => g[0] === ROLES[x.p.role].group)[1], x.p.name, ROLES[x.p.role].label, clock(x.s.start), clock(x.s.end), hrs(len(x.s)), x.s.note || '']))));
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  function exportTextDialog() {
    const range = h('select', { class: 'input' }, h('option', { value: 'week' }, `This week (week ${weekOf(ui.day) + 1})`), h('option', { value: 'all' }, `All ${plan.weeks} week${plan.weeks > 1 ? 's' : ''}`));
    const fmt = h('select', { class: 'input' }, h('option', { value: 'txt' }, 'Text (.txt) – easy to read and print'), h('option', { value: 'csv' }, 'CSV (.csv) – opens in Excel'));
    modal({ title: 'Save as text or CSV', body: [h('label', { class: 'field' }, h('span', null, 'What'), range), h('label', { class: 'field' }, h('span', null, 'Format'), fmt)],
      actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
        const weeks = range.value === 'week' ? [weekOf(ui.day)] : Array.from({ length: plan.weeks }, (_, k) => k);
        const [a] = weekRange(weeks[0]), [, b] = weekRange(weeks[weeks.length - 1]);
        const name = baseName(a, b) + '.' + fmt.value;
        const blob = fmt.value === 'csv' ? new Blob([csvRows(weeks)], { type: 'text/csv' }) : new Blob([weeks.map(weekText).join('\r\n\r\n')], { type: 'text/plain' });
        saveBlob(name, blob, { description: fmt.value === 'csv' ? 'CSV file' : 'Text file', accept: { [blob.type]: ['.' + fmt.value] } }).then((n) => n && toast('Saved ' + n));
      } }] });
  }

