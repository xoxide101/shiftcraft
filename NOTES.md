# ShiftCraft – development notes

How ShiftCraft is built, why it works the way it does, and what to watch out for when changing it. For what it does and how to use it, see [README.md](README.md).

## What it is for

A planning board for labor schedules: build the schedule here first, then copy it into the real (often locked) scheduling system. That is why there are **no approvals** and why the **Hand-off** tab lists shifts in the order you type them in.

## How it is built

- **One file:** `index.html` holds the HTML, CSS and JavaScript, with no libraries and no build step. It must keep working when double-clicked (`file://`) and fully offline.
- **State:** a single `plan` object, autosaved to `localStorage`:

  ```
  plan = { app, version, company, location, storeNo, address, phone, splh, startDate, weeks (1–8), month 'YYYY-MM',
           midStart, pmStart, staff[], shifts{ 'YYYY-MM-DD': [{ id, staffId, start, end, note? }] },
           forecast{}, history{}, checklist[] }
  staff = { id, name, role (GM | AGM | SM | TM | NH), active, defStart, defEnd, maxHours, notes,
            tasks[{ id, text, date, done }], off[7] (Mon–Sun), parts ['am','mid','pm'] }
  ```

  Times are minutes after midnight. Shifts are stored **by date**, so moving between months never loses anything.
- **localStorage keys:** `shiftcraft-v1` (the plan), `-ui`, `-img`, `-screen`, `-theme`, `-place` (the company and location profile, shared by every plan), `-seen`.
- **Groups:** Manager (GM, AGM), Supervisor (Shift Manager), Team Member, Training (New Hire).

## Decisions worth keeping

- **Months are the weeks whose Monday falls in the month**, so a month is always 4 or 5 weeks, never 3 or 6. "Week out 1–5" jumps between them.
- **Times always read `6:00am – 2:30pm`.** People reading schedules on phones misread short forms like "6a".
- **Clicking a shift opens its notes.** Double-click edits the times, right-click opens a menu, and Ctrl+Z undoes. A single click never deletes anything.
- **Printouts and pictures are always light,** even when editing in dark mode (`@media print` forces the light tokens with `!important`; `snapshotScreen(true)` everywhere).
- **Notes appear under the shift bar** in yellow highlighter with `NOTES:`, and on every printout and export.
- **Example data uses invented names only.** Never put real people in examples or screenshots.

## File kinds

`File › Save…` asks what to save. Every file is JSON with a `kind`:

| kind | Holds |
| --- | --- |
| `location` | Everything: team, every week, forecasts, past sales, settings |
| `team` | The staff list only |
| `weeks` | Shifts for a day (`days: 1`), a week, a month or a range, plus `people` [{ id, name, role }] so shifts can be matched **by name** on another computer |

- **Names** look like `Company - Location - MM-DD-YYYY - MM-DD-YYYY.json`.
- **Opening a file:** `loadFile` runs `validatePlan`, which fixes times out of range, missing ids and unknown roles, then says what it fixed.
- **Older files:** the old `week`, `month` and `staff` kinds still open.

**Emailable file:** `portableHtml` clones the page (minus `#embedded-plan`) and adds the plan as `<script id="embedded-plan" type="application/json">`, so the file opens ShiftCraft with the schedule inside. `checkEmbedded` asks once per `savedAt`. A literal `</script>` inside JavaScript strings must be written `<\/script>`.

## Title bar and ribbon (this app's own copy)

The title bar and ribbon code (`CraftTitlebar`, `CraftRibbon`, `CraftIcons`) started as one file shared by the Craft apps. **Each app now keeps its own copy and changes it on its own**: here it is pasted inside the main script of index.html. Changes are not copied to the other apps, so the apps can be refined separately until it is clear how unified they should be. It provides:

- **`CraftTitlebar`:**
  - logo button that opens every classic menu side by side (F10)
  - quick buttons that people can hide or extend with any command (⌄; right-click a quick button to remove it; kept in localStorage `<app>-quick`)
  - file name and save state
  - **Search commands (Alt+Q)** over menus and ribbon, with recently used commands
  - info chips, theme and help
- **`CraftRibbon`:** tabs of labelled buttons in named groups (or Office-style icon-only buttons: `{ row: [...] }` with `iconOnly: true`, `'|'` for a divider), one color per tab, collapse with ⌃ or a double-click; remembers the last tab.
- **`CraftIcons`:** the shared icon set.

Ribbon buttons reuse the apps' own menu commands (looked up by label), so a button and its menu item always do the same thing. Each app has a matching logo in `docs/logo.svg` (also used as the browser-tab icon).

## Title bar

The Office-style strip at the very top comes from the shared `CraftTitlebar` component (the same code as `craft-titlebar.js` in SiteCraft and DataCraft), pasted **inside** the main script. That matters: the emailable file copies the page as it was at start-up (`SOURCE`), before the title bar exists, and looks for the first `<script>
(function () {` marker, so the component must not add a separate `<script>` tag.

- **Quick buttons:** save week, undo, print the week table, email/share, check the schedule.
- **Info chips:** company and location (click to edit), the week being worked on.
- **Search:** Alt+Q searches every menu command.
- **Layout:** the title bar is sticky; the menu bar sticks just below it (`top: 38px`).

## Pictures and printing

- Week table, visual timeline and calendar are drawn on a canvas at the chosen DPI (150 to 4800).
- **Big images:** browsers cap canvas size (`tooBig`: over 32,000 px on a side or 200 million pixels). Above that, or when SVG is chosen, a recording `svgContext` replaces the canvas (`makeSurface`) and the output is vector SVG.
- **DPI is written into the files:** PNG gets a `pHYs` chunk (with its own crc32), JPG gets a patched JFIF density, and BMP is a hand-written 24-bit encoder.
- **Print screen** clones the visible app, inlines computed styles, and draws it through an SVG `foreignObject` onto a canvas.

## Version history

All built on 2026-10-13.

| Version | Added |
| --- | --- |
| 0.1 | Day timeline 4am–11pm in 15-minute steps; drag, resize, double-click to edit; forecast and hours variance; Week, Forecast, Hand-off and Staff tabs |
| 0.2 | File/Edit/View/Help menus; company and location; save weeks and months; week sheet pictures (PNG/JPG/BMP) |
| 0.3 | New Hire role and Training row; tasks and new-hire checklist; hours by section; copy and clear days, weeks and months from any dates; print per person or group |
| 0.4 | Not-available days and AM/MID/PM availability; visual timeline sheet; emailable .html; plans up to 8 weeks; crash banner; light/dark |
| 0.5 | `6:00am` time format; DPI up to 4800 with automatic SVG; calendar layout |
| 0.6 | Month plans with Week out 1–5; copy and clear week; storage meter |
| 0.7 | Location, team and weeks file kinds; notes per shift; right-click menu |
| 0.8 | "Save what" dialog; day files; global company profile; schedule checks; notes on printouts |
| 0.9 | Notes under the bars in highlighter; Print screen |
| 1.0 | Printing always light |

## Testing approach

- Serve the folder (`python -m http.server`) and drive the real app in a browser.
- Stub `showSaveFilePicker` and wrap `URL.createObjectURL` to capture what would be saved.
- Send pointer events to shift bars to test dragging and resizing.
- Clear localStorage afterwards.
- Not yet tested: real print, save and share dialogs on physical printers and phones.

## Ideas for later

- Adjust the defaults (sales per labor hour, variance rule, AM/MID/PM boundaries) after real use.
- Import past sales from a CSV export.

## Weekdays, weekend and contact (v1.1)

- A person's **weekday set** is `defStart`, `defEnd`, `parts`, `from`, `to` (from/to = the hours they can work, `null` = any time); the **weekend set** is `p.we = { defStart, defEnd, parts, from, to }`. When `p.we` (or one of its fields) is missing, the weekday value is used, so older files work unchanged. `setOf(p, 'wk' | 'we')`, `setFor(p, isoDate)` and `setSet(p, kind, patch)` read and write them; `off[7]` (Mon–Sun) is still one list.
- `addShift` uses the set for the day; `availIssue` checks the day's set (days off, then from–until, then AM / MID / PM); "Make this the usual shift" saves into the weekday or weekend set.
- Contact: `p.email`, `p.phone` (and `p.notes` shown there). All of these travel in team and location files as part of the staff list.
- The Staff tab's section is remembered in `localStorage['shiftcraft-staff-tab']`.

