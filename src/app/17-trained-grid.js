  // Trained in: a grid of people (rows) and the location's positions (columns, titles written upwards). Click a box: Yes / No.
  // Stored as p.trained = [position ids]. Positions not in use at the location are left out.
  function trainedGrid() {
    const positions = (plan.positions || []).filter((x) => x.active);
    const people = sortStaff(plan.staff.filter((p) => !p.left));
    const isOn = (p, pos) => Array.isArray(p.trained) && p.trained.includes(pos.id);
    const toggle = (p, pos) => change(() => { const t = new Set(p.trained || []); t.has(pos.id) ? t.delete(pos.id) : t.add(pos.id); p.trained = [...t]; });
    const setColumn = (pos, on) => change(() => { people.forEach((p) => { const t = new Set(p.trained || []); on ? t.add(pos.id) : t.delete(pos.id); p.trained = [...t]; }); });
    const setRow = (p, on) => change(() => { p.trained = on ? positions.map((x) => x.id) : (p.trained || []).filter((id) => !positions.some((x) => x.id === id)); });
    const card = h('div', { class: 'card' },
      h('div', { class: 'daynav' }, h('h2', { style: { margin: 0 } }, 'Trained in'), h('span', { class: 'muted small' }, `${positions.length} positions in use at this location`), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: () => { ui.tab = 'company'; persist(); render(); } }, 'Change the positions…')),
      h('p', { class: 'hint', style: { margin: '6px 0 12px' } }, 'Click a box to switch between Yes (trained) and No. Click a position’s name to mark everyone, or a person’s count to mark all positions for them (click again to clear).'));
    if (!positions.length) { card.append(h('p', { class: 'muted' }, 'This location has no positions in use. Add them on the Company & Location tab.')); return card; }
    if (!people.length) { card.append(h('p', { class: 'muted' }, 'No one yet. Add your team above.')); return card; }
    card.append(h('div', { class: 'table-wrap' }, h('table', { class: 't trained' },
      h('thead', null, h('tr', null, h('th', { class: 'tn' }, 'Name'), h('th', { class: 'tn' }, 'Role'),
        positions.map((pos) => { const all = people.every((p) => isOn(p, pos)); return h('th', { class: 'vert', title: `${pos.name}: click to mark ${all ? 'no one' : 'everyone'} as trained` }, h('button', { type: 'button', onclick: () => setColumn(pos, !all) }, h('span', null, pos.name))); }),
        h('th', { class: 'num' }, 'Trained'))),
      h('tbody', null, people.map((p) => {
        const n = positions.filter((pos) => isOn(p, pos)).length;
        return h('tr', { style: { opacity: p.active ? 1 : 0.55 } },
          h('td', { class: 'nowrap' }, h('b', null, p.name)), h('td', { class: 'nowrap muted small' }, ROLES[p.role].short),
          positions.map((pos) => { const on = isOn(p, pos); return h('td', { class: 'c tcell' }, h('button', { type: 'button', class: 'tbox' + (on ? ' on' : ''), 'aria-pressed': String(on), 'aria-label': `${p.name} trained in ${pos.name}: ${on ? 'Yes' : 'No'}`, title: `${p.name} · ${pos.name}: ${on ? 'Yes, trained' : 'No'} (click to change)`, onclick: () => toggle(p, pos) }, on ? '✓' : '')); }),
          h('td', { class: 'num' }, h('button', { type: 'button', class: 'btn sm ghost', title: n === positions.length ? 'Clear all positions for ' + p.name : 'Mark ' + p.name + ' as trained in every position', onclick: () => setRow(p, n !== positions.length) }, `${n} / ${positions.length}`)));
      })),
      h('tfoot', null, h('tr', null, h('td', { colspan: 2 }, 'People trained'), positions.map((pos) => h('td', { class: 'c' }, String(people.filter((p) => p.active && isOn(p, pos)).length))), h('td', null, ''))))));
    return card;
  }

