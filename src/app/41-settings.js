  // ===================================================================
  // Settings
  // ===================================================================
  function settingsDialog() {
    const start = h('input', { class: 'input', type: 'date', value: plan.startDate });
    const weeks = h('select', { class: 'input' }, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('option', { value: n, selected: n === plan.weeks }, `${n} week${n > 1 ? 's' : ''}${n === 4 ? ' (about a month)' : n === 8 ? ' (about two months)' : ''}`)));
    const splh = h('input', { class: 'input', type: 'number', min: 1, value: plan.splh });
    const theme = h('select', { class: 'input' }, [['', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('option', { value: v, selected: (document.documentElement.dataset.theme || '') === v }, l)));
    const midT = timePicker(plan.midStart, 'MID starts'), pmT = timePicker(plan.pmStart, 'PM starts');
    modal({ title: 'Settings', body: [
      h('div', { class: 'inline' }, h('span', null, 'Company & location: ', h('b', null, placeName())), h('button', { class: 'btn sm', type: 'button', onclick: placeDialog }, 'Edit…')),
      h('label', { class: 'field' }, h('span', null, 'Plan shows weeks starting (moved to that week’s Monday)'), start),
      h('label', { class: 'field' }, h('span', null, 'Plan length'), weeks),
      h('label', { class: 'field' }, h('span', null, 'Sales per labor hour target ($)'), splh, h('small', { class: 'hint' }, 'Target hours = forecast ÷ this number.')),
      h('div', { class: 'inline' }, h('label', { class: 'field' }, h('span', null, 'MID starts'), midT), h('label', { class: 'field' }, h('span', null, 'PM starts'), pmT)),
      h('small', { class: 'hint' }, 'AM runs from opening to MID, MID until PM, and PM until close. Used for the AM / MID / PM availability on the Staff tab.'),
      h('label', { class: 'field' }, h('span', null, 'Appearance'), theme),
      h('p', { class: 'hint' }, `Saved in this browser: ${storageKB()} KB of about 5,000 KB. One month uses roughly 30–60 KB, so there is room for years of schedules.`),
      h('button', { class: 'btn sm', type: 'button', onclick: clearOldDialog }, 'Clear old weeks…')],
    actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      if (pmT.value <= midT.value) { toast('PM must start after MID.'); return false; }
      change(() => {
        plan.midStart = midT.value; plan.pmStart = pmT.value;
        if (start.value) plan.startDate = mondayOf(start.value);
        plan.weeks = +weeks.value; plan.splh = Math.max(1, +splh.value || plan.splh);
      });
      setTheme(theme.value);
    } }] });
  }
  function clearOldDialog() {
    const before = h('input', { class: 'input', type: 'date', value: addDays(plan.startDate, -182) });
    modal({ title: 'Clear old weeks', body: [h('label', { class: 'field' }, h('span', null, 'Remove shifts before'), before),
      h('p', { class: 'hint' }, 'Only needed if the browser’s storage fills up. Save those months to files first (File › Save all weeks) if you may want them again. Past sales and forecasts are kept (they are small) for the trend and the reports.')],
    actions: [{ label: 'Cancel' }, { label: 'Clear', danger: true, onClick: () => {
      if (!before.value) return false;
      let n = 0;
      change(() => { Object.keys(plan.shifts).forEach((d) => { if (d < before.value) { n += plan.shifts[d].length; delete plan.shifts[d]; } }); });
      toast(`Removed ${n} old shift${n === 1 ? '' : 's'}. You can undo this.`);
    } }] });
  }
  function setTheme(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(KEY + '-theme', t); } catch (e) { /* ignore */ }
    render();
  }
  try { const t = localStorage.getItem(KEY + '-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
  function newPlan() {
    const start = h('input', { class: 'input', type: 'date', value: mondayOf(addDays(iso(new Date()), 7)) });
    const weeks = h('select', { class: 'input' }, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => h('option', { value: n, selected: n === plan.weeks }, `${n} week${n > 1 ? 's' : ''}${n === 4 ? ' (about a month)' : n === 8 ? ' (about two months)' : ''}`)));
    modal({ title: 'Start a new plan', body: [
      h('label', { class: 'field' }, h('span', null, 'First week starts (moved to that week’s Monday)'), start),
      h('label', { class: 'field' }, h('span', null, 'Length'), weeks),
      h('p', { class: 'hint' }, 'Earlier weeks are kept by date, so you can copy from them later (Edit › Copy a week). Your staff list, company and location stay the same.')],
    actions: [{ label: 'Cancel' }, { label: 'Start plan', primary: true, onClick: () => {
      if (!start.value) return false;
      change(() => { plan.example = false; plan.startDate = mondayOf(start.value); plan.weeks = +weeks.value; });
      ui.fileName = ''; ui.day = plan.startDate; render();
    } }] });
  }

