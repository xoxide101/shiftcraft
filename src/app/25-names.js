  // ===================================================================
  // Names and file helpers
  // ===================================================================
  const fileDate = (s) => { const d = parseIso(s); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`; };
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  const baseName = (from, to) => [plan.company, plan.location, fileDate(from), fileDate(to)].map(safe).filter(Boolean).join(' - ');
  const weekRange = (w) => { const d = weekDays(w); return [d[0], d[6]]; };
  const planRange = () => [plan.startDate, addDays(plan.startDate, plan.weeks * 7 - 1)];
  const JSON_TYPE = { description: 'ShiftCraft schedule', accept: { 'application/json': ['.json'] } };
  const jsonBlob = (o) => new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' });
  ui.handles = {};

  function blockedHere() {
    if (!inFrame) return false;
    modal({ title: 'Saving files is not available here', body: h('p', null, 'Open ShiftCraft from index.html on your computer to save and open files.'), actions: [{ label: 'Close', primary: true }] });
    return true;
  }
  // every file saved or exported has a name of its own: the moment it was made goes before the extension
  // (… v2026.11.18.14.05.33.pdf); a name that has one already keeps it. A batch (pages) shares one stamp.
  const stampNow = () => { const n = new Date(), p = (x) => String(x).padStart(2, '0'); return `${n.getFullYear()}.${p(n.getMonth() + 1)}.${p(n.getDate())}.${p(n.getHours())}.${p(n.getMinutes())}.${p(n.getSeconds())}`; };
  const uniqueName = (name, stamp = stampNow()) => (/ v\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{2}(\.|$)/.test(name) ? name : name.replace(/(\.[a-z0-9]{1,5})?$/i, (ext) => ` v${stamp}${ext}`));
  // Save one file: reuses the remembered file for handleKey when there is one, otherwise asks where.
  async function saveBlob(name, blob, type, handleKey) {
    if (blockedHere()) return null;
    name = uniqueName(name);
    if (window.showSaveFilePicker) {
      try {
        const handle = (handleKey && ui.handles[handleKey]) || await window.showSaveFilePicker({ suggestedName: name, types: [type] });
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        if (handleKey) ui.handles[handleKey] = handle;
        return handle.name;
      } catch (e) { if (e.name === 'AbortError') return null; }
    }
    downloadBlob(name, blob);
    return name;
  }
  function downloadBlob(name, blob) {
    name = uniqueName(name);
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  // Save several files: one folder pick (Chrome/Edge), or one download each.
  async function saveMany(files) {
    if (blockedHere()) return 0;
    { const st = stampNow(); files = files.map((f) => ({ ...f, name: uniqueName(f.name, st) })); }
    if (files.length === 1) return (await saveBlob(files[0].name, files[0].blob, files[0].type)) ? 1 : 0;
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ id: 'shiftcraft-out', mode: 'readwrite' });
        for (const f of files) { const w = await (await dir.getFileHandle(f.name, { create: true })).createWritable(); await w.write(f.blob); await w.close(); }
        return files.length;
      } catch (e) { if (e.name === 'AbortError') return 0; }
    }
    for (const f of files) { downloadBlob(f.name, f.blob); await new Promise((r) => setTimeout(r, 400)); }
    return files.length;
  }

