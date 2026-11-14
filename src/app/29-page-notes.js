  // ===================================================================
  // Notes on printed pages
  // ===================================================================
  const notesFor = (days) => days.flatMap((d) => shiftsOn(d).filter((s) => s.note).sort((a, b) => a.start - b.start).map((s) => ({ d, s, p: staffById(s.staffId) })));
  // Writes the notes on ruled lines, then leaves the rest of the lines blank for handwriting.
  function drawNotes(text, line, list, M, CW, y, bottom, inch, pt, gap = 0.3) {
    text('Notes', M, y + pt(10), 'left', 11, '700');
    let ly = y + inch(0.45);
    list.forEach((n) => {
      if (ly > bottom) return;
      text(`${dayName(n.d, 'short')} ${usDate(n.d).slice(0, 5)}  ·  ${n.p.name} (${clock(n.s.start)}–${clock(n.s.end)}):  ${n.s.note}`, M + pt(3), ly - pt(4), 'left', 9, '400', '#000', CW - pt(6));
      line(M, ly, M + CW, ly, 0.5, '#bbb');
      ly += inch(gap);
    });
    for (; ly < bottom; ly += inch(gap)) line(M, ly, M + CW, ly, 0.5, '#bbb');
  }

