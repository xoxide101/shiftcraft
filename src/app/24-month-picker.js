  // ===================================================================
  // Month picker
  // ===================================================================
  function fillMonthSelect() {
    const sel = $('#month-sel'); if (!sel) return;
    const now = new Date(), opts = [];
    for (let k = -6; k <= 14; k++) { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); opts.push(iso(d).slice(0, 7)); }
    const cur = plan.month && monthInfo(plan.month).start === plan.startDate && monthInfo(plan.month).weeks === plan.weeks ? plan.month : '';
    if (cur && !opts.includes(cur)) opts.push(cur);
    opts.sort();
    sel.replaceChildren(
      cur ? null : h('option', { value: '', selected: true }, `Custom: ${shortDate(plan.startDate)} – ${shortDate(addDays(plan.startDate, plan.weeks * 7 - 1))}`),
      ...opts.map((ym) => h('option', { value: ym, selected: ym === cur }, `${monthLabel(ym)} (${monthInfo(ym).weeks} wk)`)));
  }
  $('#month-sel').addEventListener('change', (e) => {
    const ym = e.target.value; if (!ym) return;
    const { start, weeks } = monthInfo(ym);
    change(() => { plan.month = ym; plan.startDate = start; plan.weeks = weeks; plan.example = false; });
    ui.day = start; ui.fileName = ''; persist(); render();
    const n = planDays().reduce((t, d) => t + shiftsOn(d).length, 0);
    toast(`${monthLabel(ym)}: ${weeks} weeks, ${shortDate(start)} – ${shortDate(addDays(start, weeks * 7 - 1))}${n ? ` · ${n} shifts already planned` : ''}`);
  });

