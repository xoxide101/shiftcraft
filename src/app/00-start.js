(function () {
  'use strict';
  // The page as it was loaded, used to build the emailable .html file.
  const SOURCE = (() => { const root = document.documentElement.cloneNode(true); const old = root.querySelector('#embedded-plan'); if (old) old.remove(); return '<!doctype html>\n' + root.outerHTML; })();
  // If something goes wrong while starting, show a way out instead of a broken page.
  let started = false;
  window.addEventListener('error', (e) => {
    if (started || document.getElementById('crash')) return;
    const box = document.createElement('div');
    box.id = 'crash'; box.className = 'crash';
    box.innerHTML = '<b>ShiftCraft could not start.</b> <span></span><div><button type="button" id="crash-backup">Download my saved data</button> <button type="button" id="crash-reset">Back up and start fresh</button></div>';
    box.querySelector('span').textContent = e.message || 'Unknown error';
    document.body.prepend(box);
    const backup = () => {
      const data = {}; Object.keys(localStorage).filter((k) => k.startsWith('shiftcraft')).forEach((k) => { data[k] = localStorage.getItem(k); });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = 'ShiftCraft backup.json'; document.body.append(a); a.click(); a.remove();
    };
    box.querySelector('#crash-backup').onclick = backup;
    box.querySelector('#crash-reset').onclick = () => { backup(); setTimeout(() => { Object.keys(localStorage).filter((k) => k.startsWith('shiftcraft')).forEach((k) => localStorage.removeItem(k)); location.reload(); }, 600); };
  });

