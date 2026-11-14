  // ===================================================================
  // Moving weeks
  // ===================================================================
  function moveWeekDialog() {
    if (plan.weeks < 2) { toast('Set the plan to 2 or more weeks in Settings first.'); return; }
    const opts = Array.from({ length: plan.weeks }, (_, k) => { const [a, b] = weekRange(k); return [k, `Week ${k + 1}: ${shortDate(a)} – ${shortDate(b)}`]; });
    const from = h('select', { class: 'input' }, opts.map(([v, l]) => h('option', { value: v, selected: v === weekOf(ui.day) }, l)));
    const to = h('select', { class: 'input' }, opts.map(([v, l]) => h('option', { value: v, selected: v === (weekOf(ui.day) + 1) % plan.weeks }, l)));
    const how = h('select', { class: 'input' }, h('option', { value: 'swap' }, 'Swap the two weeks'), h('option', { value: 'move' }, 'Move it there and shift the weeks in between'));
    modal({ title: 'Move a week', body: [h('label', { class: 'field' }, h('span', null, 'Week to move'), from), h('label', { class: 'field' }, h('span', null, 'Move it to'), to), h('label', { class: 'field' }, h('span', null, 'How'), how),
      h('p', { class: 'hint' }, 'Shifts and forecasts move to the same weekdays of the new week. Past sales stay on their real dates. You can undo this.')],
    actions: [{ label: 'Cancel' }, { label: 'Move', primary: true, onClick: () => {
      const a = +from.value, b = +to.value; if (a === b) return;
      change(() => {
        const blocks = Array.from({ length: plan.weeks }, (_, k) => weekDays(k).map((d) => ({ shifts: plan.shifts[d] || [], fc: plan.forecast[d] })));
        if (how.value === 'swap') [blocks[a], blocks[b]] = [blocks[b], blocks[a]];
        else { const [blk] = blocks.splice(a, 1); blocks.splice(b, 0, blk); }
        blocks.forEach((blk, k) => weekDays(k).forEach((d, i) => { plan.shifts[d] = blk[i].shifts; if (blk[i].fc == null || blk[i].fc === '') delete plan.forecast[d]; else plan.forecast[d] = blk[i].fc; }));
        ui.day = weekDays(b)[0];
      });
      toast('Week moved');
    } }] });
  }
  function movePlanDialog() {
    const start = h('input', { class: 'input', type: 'date', value: plan.startDate });
    modal({ title: 'Move the whole plan to new dates', body: [h('label', { class: 'field' }, h('span', null, 'New first week starts on (moved to that week’s Monday)'), start),
      h('p', { class: 'hint' }, 'Every shift and forecast moves with the plan, keeping its weekday. Past sales stay on their real dates. Use this to reuse last month’s schedule for next month.')],
    actions: [{ label: 'Cancel' }, { label: 'Move plan', primary: true, onClick: () => {
      if (!start.value) return false;
      const ns = mondayOf(start.value), off = Math.round((parseIso(ns) - parseIso(plan.startDate)) / 864e5);
      if (!off) return;
      change(() => {
        const days = planDays(), shifts = {}, fc = {};
        days.forEach((d) => { if (plan.shifts[d]) shifts[addDays(d, off)] = plan.shifts[d]; if (plan.forecast[d] != null) fc[addDays(d, off)] = plan.forecast[d]; delete plan.shifts[d]; delete plan.forecast[d]; });
        Object.assign(plan.shifts, shifts); Object.assign(plan.forecast, fc);
        plan.startDate = ns; ui.day = ns;
      });
      toast(`Plan moved to start ${shortDate(ns)}`);
    } }] });
  }
  function clearWeek() {
    const w = weekOf(ui.day);
    confirmBox(`Clear week ${w + 1}?`, 'Everyone goes back to Unscheduled for all 7 days. Forecasts are kept. You can undo this.', 'Clear week', () => change(() => weekDays(w).forEach((d) => { plan.shifts[d] = []; })));
  }

