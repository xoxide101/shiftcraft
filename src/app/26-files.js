  // ===================================================================
  // Files: Location (everything), Team only, Weeks only
  // ===================================================================
  const FILE_KINDS = {
    location: { label: 'Location', desc: 'everything: the team, every week and month you have planned, forecasts, past sales and settings' },
    team: { label: 'Team only', desc: 'the employee list with roles, usual shifts, availability, tasks and the new-hire checklist' },
    day: { label: 'Day', desc: 'one day of the schedule' },
    weeks: { label: 'Weeks only', desc: 'the schedule (shifts, notes and forecasts) for the weeks you pick; people are matched by name when it is opened' },
  };
  const fileStem = (...extra) => [plan.company, plan.location].map(safe).filter(Boolean).concat(extra).join(' - ') || 'ShiftCraft';
  const teamOnly = () => ({ app: 'ShiftCraft', kind: 'team', version: 5, company: plan.company, location: plan.location, checklist: plan.checklist || null, positions: plan.positions || [], staff: plan.staff });
  // Positions have their own ids in each browser, so a person's "trained in" list from a file is matched by the
  // position's name; positions the location doesn't have yet are added to it.
  function remapTrained(staff, filePositions) {
    if (!Array.isArray(filePositions) || !filePositions.length) return staff;
    plan.positions = plan.positions || [];
    const idOf = {};
    filePositions.forEach((fp) => {
      const nm = String(fp.name || '').trim(); if (!nm) return;
      let here = plan.positions.find((x) => x.id === fp.id) || plan.positions.find((x) => x.name.toLowerCase() === nm.toLowerCase());
      if (!here) { here = { id: uid(), name: nm, active: fp.active !== false }; plan.positions.push(here); }
      idOf[fp.id] = here.id;
    });
    return staff.map((p) => (Array.isArray(p.trained) ? { ...p, trained: [...new Set(p.trained.map((id) => idOf[id] || id))] } : p));
  }
  const weeksOnly = (first, count) => scheduleRange(weekDays(first)[0], count * 7, first === 0 && count === plan.weeks ? plan.month : null);
  const locationAll = () => ({ ...plan, app: 'ShiftCraft', kind: 'location', version: 4 });

  async function saveFile(kind, { first = 0, count = 1, as = false } = {}) {
    let data, name, key;
    if (kind === 'team') { data = teamOnly(); name = fileStem('team') + '.json'; key = 'team'; }
    else if (kind === 'day') { const d = ui.day; data = scheduleRange(d, 1); name = fileStem(fileDate(d)) + '.json'; key = 'day:' + d; }
    else if (kind === 'location') { const [a, b] = planRange(); data = locationAll(); name = fileStem('location', fileDate(a), fileDate(b)) + '.json'; key = 'location'; }
    else {
      count = Math.max(1, Math.min(count, plan.weeks - first));
      const a = weekDays(first)[0], b = weekDays(first + count - 1)[6];
      data = weeksOnly(first, count); name = fileStem(fileDate(a), fileDate(b)) + '.json'; key = `weeks:${a}:${count}`;
    }
    const saved = await saveBlob(name, jsonBlob(data), JSON_TYPE, as ? null : key);
    if (saved) {
      ui.fileName = saved; render();
      const st = data.staff || [], n = (f) => st.filter(f).length;
      const what = data.staff ? ` · ${st.length} people, ${n((x) => (x.phone || '').trim())} with a phone number, ${n((x) => Array.isArray(x.avail) && x.avail.some(Boolean))} with day-by-day availability, ${n((x) => (x.trained || []).length)} with training` : '';
      toast(`Saved (${FILE_KINDS[kind].label.toLowerCase()}) as ${saved}${what}`);
    }
  }
  const saveWeek = (as) => saveFile('weeks', { first: weekOf(ui.day), count: 1, as });
  const saveMonth = (as) => saveFile('weeks', { first: 0, count: plan.weeks, as });
  const saveStaff = () => saveFile('team', { as: true });
  async function openFile() {
    if (blockedHere()) return;
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({ types: [JSON_TYPE] });
        return loadFile(await (await handle.getFile()).text(), handle.name, handle);
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    $('#file-in').click();
  }
  $('#file-in').onchange = async () => { const f = $('#file-in').files[0]; $('#file-in').value = ''; if (f) loadFile(await f.text(), f.name, null); };

  // Adds people from a file who aren't on the team yet; returns a map of file id -> team id.
  function mergeStaff(list) {
    const map = {};
    (list || []).forEach((p) => {
      const same = plan.staff.find((x) => x.id === p.id) || plan.staff.find((x) => x.name.toLowerCase() === String(p.name).toLowerCase());
      if (same) { map[p.id] = same.id; return; }
      const defaults = { GM: [360, 900], AGM: [600, 1140], SM: [480, 1020], TM: [600, 960], NH: [600, 900] }[p.role] || [540, 1020];
      const np = { active: true, maxHours: 0, notes: '', defStart: defaults[0], defEnd: defaults[1], tasks: [], ...p, role: ROLES[p.role] ? p.role : 'TM', name: String(p.name || 'Unnamed').trim(), id: plan.staff.some((x) => x.id === p.id) ? uid() : p.id };
      plan.staff.push(np); map[p.id] = np.id;
    });
    return map;
  }
  const dropExample = () => { if (plan.example) { plan.staff = []; plan.shifts = {}; plan.forecast = {}; plan.history = {}; plan.example = false; } };
  function loadFile(text, name, handle) {
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('That file is not a ShiftCraft file.'); return; }
    if (!data || data.app !== 'ShiftCraft') { toast('That file is not a ShiftCraft file.'); return; }
    const tmp = { staff: data.staff || data.people || [], shifts: data.shifts || {} };
    const fixes = validatePlan(tmp);
    if (data.staff) data.staff = tmp.staff; else if (data.people) data.people = tmp.staff;
    data.shifts = tmp.shifts;
    if (fixes) setTimeout(() => toast(`Checked ${name}: fixed ${fixes} small problem${fixes === 1 ? '' : 's'} (times out of range or missing ids).`), 1500);
    if (data.kind === 'weeks' && data.days && data.days % 7 !== 0) return placeDaysDialog(data, name);
    const kind = data.kind === 'staff' ? 'team' : data.kind === 'week' ? 'weeks' : (data.kind === 'month' || !data.kind) ? 'location' : data.kind;
    if (kind === 'team') return openTeam(data, name);
    if (kind === 'weeks') return placeWeeksDialog(data, name, handle);
    return openLocation(data, name, handle);
  }
  function openLocation(data, name, handle) {
    const replace = () => {
      snapshot();
      plan = data; delete plan.kind; normalize(plan); ui.day = plan.startDate; ui.fileName = name;
      if (handle) ui.handles.location = handle;
      persist(); render(); toast(`Opened location file ${name}`);
      offerFilePlace(data);
    };
    if (plan.example || !Object.values(plan.shifts).some((l) => l.length)) { replace(); return; }
    modal({ title: `Open ${name}?`, body: [h('p', null, `This is a location file for ${[data.company, data.location].filter(Boolean).join(' · ') || 'a store'}: team, schedules, forecasts and settings.`), h('p', { class: 'hint' }, 'It replaces everything open now. Save first if you need it. You can undo this.')],
      actions: [{ label: 'Cancel' }, { label: 'Open', primary: true, onClick: replace }] });
  }
  function openTeam(data, name) {
    if (!Array.isArray(data.staff)) { toast('No team list in that file.'); return; }
    const replace = () => {
      change(() => {
        dropExample();
        const byName = new Map(plan.staff.map((p) => [p.name.toLowerCase(), p.id]));
        const remap = {};
        data.staff.forEach((p) => { const old = byName.get(String(p.name).toLowerCase()); if (old && old !== p.id) remap[old] = p.id; });
        Object.keys(plan.shifts).forEach((d) => { plan.shifts[d] = plan.shifts[d].map((s) => ({ ...s, staffId: remap[s.staffId] || s.staffId })); });
        plan.staff = remapTrained(data.staff, data.positions).map((p) => ({ active: true, maxHours: 0, notes: '', defStart: 540, defEnd: 1020, tasks: [], ...p }));
        if (data.checklist && data.checklist.length) plan.checklist = data.checklist;
      });
      toast(`Team loaded: ${data.staff.length} people from ${name}`);
      matchOldTraining();
    };
    const merge = () => {
      let before = plan.staff.length;
      let updated = 0;
      change(() => {
        dropExample(); before = plan.staff.length;
        const list = remapTrained(data.staff, data.positions);
        // people already on the team take the file's details (phone, availability, training…), keeping their own id
        list.forEach((fp) => { const same = plan.staff.find((x) => x.id === fp.id) || plan.staff.find((x) => x.name.toLowerCase() === String(fp.name).toLowerCase()); if (same) { const { id, ...rest } = fp; Object.assign(same, rest); updated++; } });
        mergeStaff(list);
      });
      toast(`From ${name}: ${plan.staff.length - before} new, ${updated} updated`);
      matchOldTraining();
    };
    if (!plan.staff.length || plan.example) { replace(); return; }
    modal({ title: `Load team from ${name}?`, body: [h('p', null, `The file has ${data.staff.length} people. Your team has ${plan.staff.length}.`),
      h('p', { class: 'hint' }, 'Replace: the file becomes your team (shifts stay with people whose names match). Add: keeps your team and only adds people who aren’t on it yet. You can undo either.')],
    actions: [{ label: 'Cancel' }, { label: 'Add new people only', onClick: merge }, { label: 'Replace team', primary: true, onClick: replace }] });
  }
  // Older team files (before version 5) did not carry the positions, and each browser gives positions its own ids, so
  // their "trained in" ticks match nothing here. This asks which position each of the file's ids is: one row per id,
  // with how many people are trained in it, filled in with a guess (the order of the person trained in the most, which
  // is the location's order where the file came from), so usually only a few need changing.
  function matchOldTraining() {
    const here = new Set((plan.positions || []).map((x) => x.id));
    const unknown = [], count = {};
    const byMost = [...plan.staff].sort((a, b) => (b.trained || []).length - (a.trained || []).length);
    byMost.forEach((p) => (p.trained || []).forEach((t) => { if (here.has(t)) return; if (!(t in count)) { count[t] = 0; unknown.push(t); } count[t]++; }));
    if (!unknown.length) return;
    const inUse = (plan.positions || []).filter((x) => x.active), sels = {};
    const rows = unknown.map((t, i) => {
      const sel = h('select', { class: 'input' }, h('option', { value: '' }, '(leave out)'), (plan.positions || []).map((pos) => h('option', { value: pos.id, selected: inUse[i] && inUse[i].id === pos.id }, pos.name)));
      sels[t] = sel;
      return h('tr', null, h('td', null, `Position ${i + 1} in the file`), h('td', { class: 'num' }, `${count[t]} trained`), h('td', null, sel));
    });
    modal({ title: 'Match the training from the file', wide: true, body: [
      h('p', null, `This team file was saved by an older ShiftCraft, so its “trained in” ticks (${unknown.length} positions) do not match the positions here yet. Choose which position each one is. They are filled in with a guess in your location's order; the number trained helps tell them apart.`),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, h('tbody', null, rows))),
      h('p', { class: 'hint' }, 'Files saved from now on carry the positions, so this is only needed once. You can undo it.')],
      actions: [{ label: 'Not now' }, { label: 'Match them', primary: true, onClick: () => {
        const map = {}; unknown.forEach((t) => { map[t] = sels[t].value || null; });
        change(() => { plan.staff.forEach((p) => { if (!Array.isArray(p.trained)) return; p.trained = [...new Set(p.trained.map((t) => (t in map ? map[t] : t)).filter(Boolean))]; }); });
        toast('Training matched to this location’s positions.');
      } }] });
  }
  // A weeks file can go into any weeks of the open month, or open on its own dates.
  function placeWeeksDialog(data, name, handle) {
    const count = Math.max(1, +data.weeks || 1), fileDays = daysFrom(data.startDate, count * 7);
    const people = data.people || data.staff || [];
    const fits = Array.from({ length: Math.max(0, plan.weeks - count + 1) }, (_, k) => k);
    const ownLabel = data.month ? `Its own month: ${monthLabel(data.month)}` : `Its own dates: ${shortDate(fileDays[0])} – ${shortDate(fileDays[fileDays.length - 1])}`;
    const sel = h('select', { class: 'input' },
      h('option', { value: 'own', selected: !planDays().includes(data.startDate) }, ownLabel),
      fits.map((k) => h('option', { value: k, selected: weekDays(k)[0] === data.startDate }, `Week ${k + 1}${count > 1 ? `–${k + count}` : ''} of this plan (${shortDate(weekDays(k)[0])})${daysFrom(weekDays(k)[0], count * 7).some((d) => shiftsOn(d).length) ? ' · replaces shifts there' : ''}`)));
    const known = people.filter((p) => plan.staff.some((x) => x.id === p.id || x.name.toLowerCase() === String(p.name).toLowerCase())).length;
    modal({ title: `Open ${count} week${count > 1 ? 's' : ''}: ${shortDate(fileDays[0])} – ${shortDate(fileDays[fileDays.length - 1])}`, body: [
      h('p', { class: 'muted' }, `From ${name}${data.company || data.location ? ` (${[data.company, data.location].filter(Boolean).join(' · ')})` : ''}. ${people.length} people: ${plan.example ? 'they become your team' : `${known} already on your team${people.length - known ? `, ${people.length - known} will be added` : ''}`}.`),
      h('p', { class: 'hint' }, 'This is a schedule file: shifts, notes and forecasts, with only names and roles for people. Phone numbers, availability and training travel in a team file or a whole-location file (Save, Ctrl+S).'),
      h('label', { class: 'field' }, h('span', null, 'Put the weeks into'), sel),
      h('p', { class: 'hint' }, 'Shifts keep their weekdays and times. You can undo this.')],
    actions: [{ label: 'Cancel' }, { label: 'Open', primary: true, onClick: () => {
      change(() => {
        dropExample();
        if (sel.value === 'own') { plan.startDate = data.startDate; plan.weeks = count; plan.month = data.month || null; }
        if (data.company && !plan.company) plan.company = data.company;
        if (data.location && !plan.location) plan.location = data.location;
        const map = mergeStaff(people);
        const target = sel.value === 'own' ? fileDays : daysFrom(weekDays(+sel.value)[0], count * 7);
        fileDays.forEach((fd, i) => {
          plan.shifts[target[i]] = (data.shifts[fd] || []).map((s) => ({ ...s, id: uid(), staffId: map[s.staffId] || s.staffId }));
          if (data.forecast && data.forecast[fd] != null) plan.forecast[target[i]] = data.forecast[fd]; else delete plan.forecast[target[i]];
        });
        Object.assign(plan.history, data.history || {});
        ui.day = target[0];
      });
      if (handle && (sel.value === 'own' || weekDays(+sel.value)[0] === data.startDate)) ui.handles[`weeks:${data.startDate}:${count}`] = handle;
      ui.fileName = name; render(); toast(`Opened ${name}`);
    } }] });
  }

