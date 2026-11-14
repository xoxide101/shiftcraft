  // ===================================================================
  // Tasks and training
  // ===================================================================
  const DEFAULT_CHECKLIST = ['Welcome and store tour', 'Food safety and allergens', 'Register / POS training', 'Opening checklist', 'Closing checklist', 'Line station training', 'Prep station training', 'Dish and cleaning procedures'];
  const tasksOf = (p) => (p.tasks = p.tasks || []);
  const tasksOn = (p, d) => tasksOf(p).filter((t) => t.date === d);
  const openTasks = (p) => tasksOf(p).filter((t) => !t.done).length;
  function tasksDialog(p) {
    snapshot();
    const listEl = h('div', { class: 'task-list' });
    const shiftDates = planDays().filter((d) => hoursOn(p.id, d));
    const dateInput = (value) => h('input', { class: 'input', type: 'date', value: value || '', title: 'Leave empty for anytime', 'aria-label': 'Date' });
    const draw = () => {
      const items = [...tasksOf(p)].sort((a, b) => (a.done - b.done) || String(a.date || '9').localeCompare(String(b.date || '9')));
      listEl.replaceChildren(...(items.length ? items.map((t) => {
        const text = h('input', { class: 'input', value: t.text, 'aria-label': 'Task' });
        text.addEventListener('change', () => { t.text = text.value.trim() || t.text; persist(); });
        const date = dateInput(t.date);
        date.addEventListener('change', () => { t.date = date.value || ''; persist(); draw(); });
        const onShift = t.date && hoursOn(p.id, t.date);
        return h('div', { class: 'task' + (t.done ? ' done' : '') },
          h('input', { type: 'checkbox', checked: !!t.done, 'aria-label': 'Done', onchange: (e) => { t.done = e.target.checked; persist(); draw(); } }),
          text, date,
          h('span', { class: 'small ' + (t.date && !onShift ? 'warn' : 'muted') }, t.date ? (onShift ? 'on shift' : 'not on shift') : 'anytime'),
          h('button', { class: 'btn sm ghost danger-text', 'aria-label': 'Delete task', onclick: () => { p.tasks = tasksOf(p).filter((x) => x !== t); persist(); draw(); } }, '×'));
      }) : [h('p', { class: 'hint' }, 'No tasks yet. Add one below, or add the new-hire checklist.')]));
    };
    const newText = h('input', { class: 'input', placeholder: 'e.g. Shadow Priya on the line', 'aria-label': 'New task' });
    const newDate = h('select', { class: 'input', 'aria-label': 'When' }, h('option', { value: '' }, 'Anytime'), shiftDates.map((d) => h('option', { value: d }, `${dayName(d, 'short')} ${shortDate(d)} (${clock(shiftsOn(d).find((s) => s.staffId === p.id).start, true)})`)));
    const addTask = () => { const t = newText.value.trim(); if (!t) { newText.focus(); return; } tasksOf(p).push({ id: uid(), text: t, date: newDate.value, done: false }); newText.value = ''; persist(); draw(); newText.focus(); };
    newText.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
    const checklist = () => plan.checklist && plan.checklist.length ? plan.checklist : DEFAULT_CHECKLIST;
    draw();
    modal({ title: `Tasks and training · ${p.name}`, wide: true, onClose: render, body: [
      h('p', { class: 'muted' }, `${ROLES[p.role].label}. Tasks with a date show on that day's schedule, the hand-off list and ${p.name.split(' ')[0]}'s printed schedule.`),
      listEl,
      h('div', { class: 'task-add' }, newText, newDate, h('button', { class: 'btn primary', onclick: addTask }, '+ Add task')),
      h('div', { class: 'inline' },
        h('button', { class: 'btn sm', onclick: () => {
          const have = new Set(tasksOf(p).map((t) => t.text.toLowerCase()));
          const add = checklist().filter((x) => !have.has(x.toLowerCase()));
          add.forEach((x, i) => tasksOf(p).push({ id: uid(), text: x, date: shiftDates[i] || '', done: false }));
          persist(); draw(); toast(add.length ? `Added ${add.length} checklist item${add.length === 1 ? '' : 's'}, spread over ${p.name.split(' ')[0]}'s shifts` : 'The checklist is already there');
        } }, 'Add new-hire checklist'),
        h('button', { class: 'btn sm', onclick: editChecklist }, 'Edit checklist…'),
        h('button', { class: 'btn sm', onclick: () => printPeople([p], [weekOf(ui.day)], true) }, 'Print their schedule'))],
    actions: [{ label: 'Done', primary: true }] });
  }
  function editChecklist() {
    const ta = h('textarea', { class: 'input', rows: 10 }, (plan.checklist && plan.checklist.length ? plan.checklist : DEFAULT_CHECKLIST).join('\n'));
    modal({ title: 'New-hire checklist', body: [h('p', { class: 'hint' }, 'One item per line. “Add new-hire checklist” copies these to a person and spreads them across their shifts.'), ta],
      actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => { plan.checklist = ta.value.split('\n').map((x) => x.trim()).filter(Boolean); persist(); toast('Checklist saved'); } }] });
  }

