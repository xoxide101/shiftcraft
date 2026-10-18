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

## Company & Location tab (v1.2)

- `companyView` edits the place profile inline (`PLACE_FIELDS` now include `email` and `website`; each change is checked like the old dialog and written to `localStorage[PLACE_KEY]` and the plan). The File menu item, the store name in the bar and the title-bar chip open this tab; Settings' Edit… still opens the quick dialog.
- `plan.hours = { wk: { open, close }, we: { open, close } }` (minutes; missing = not set) and `plan.placeNotes`.
- `plan.positions = [{ id, name, active }]`, ordered. `validatePlan` gives older plans the standard list (`defaultPositions()`, a function so the start-up check can use it before its definition is reached).

## Trained in (v1.3)

`p.trained = [position ids]`. `trainedGrid()` (below the Contact table on the Staff tab's third section) shows positions that are In use, in the location's order, with vertical headers (`writing-mode: vertical-rl` turned 180°). Removing a position from the location leaves its id in people's lists harmlessly (it simply is not shown).


## Day by day availability and the availability list (v1.4)

- `p.avail[0..6]` (Monday first): `null` (not given) or `{ k: 'any' | 'off' | 'times' | 'note', note, hl, r: [[from, to, '+' | '-'], …] }`. Times are minutes; `OPEN = -1` and `CLOSE = 9999` stand for the location's opening and closing.
- `availIssue` uses the day's entry when there is one: off = not available; Emergency = warning; Mornings / Afternoons / Evenings = a loose window; times = the shift must sit inside a `+` range (any time if there are none) and must not touch a `-` range. Without an entry, the weekday / weekend sets work as before. `avFromSets(p, i)` turns those sets into an entry ("From usual").
- `p.validated` (+ `p.validatedOn`) and `p.pending` (pending training; NH counts as pending on the list).
- `printAvailability()` builds the landscape sheet in `#print-area`: sections by role group (mgr / sup / tm), rotated headers for phone, positions and Validated, version stamp `YYYY.MM.DD.HH.MM` (24-hour).
- Days not set on their own are filled from the weekday / weekend settings, on the list and (lighter, italic) in Day by day. Each position is its own table column on the list, so every name sits over its box.
- Phone numbers have to be listed: Day by day has a phone box (red outline when empty), and printing names anyone without one first (Add numbers, or Print anyway with a line to write it in).
- Tested with made-up people only.

## Saving everything, and team files across browsers (v1.4.3)

- **Save (Ctrl+S, the disk button)** now saves the whole location (`saveFile('location')`, remembering the file), like saving a Word document. It used to save only the current week's schedule, whose file has people as name and role only, so phone numbers, availability and training were left out. "Save this week's schedule only" is still on the File menu and the Print & share ribbon; the Save… dialog starts on Everything.
- Team files (version 5) carry `positions`. Position ids are made per browser, so `remapTrained()` matches a person's trained list by position name when a team file is opened (adding positions the location lacks). Older team files without positions keep their ids as they are.
- Load team › Add now also updates people already on the team with the file's details (phone, availability, training…), not only adds new people.
- Opening a schedule file says that it carries only names and roles.
- Tested: save in one browser, open in a fresh one (different position ids): phones, availability, trained and validated all arrive, for both the location file and the team file.
- Tabs stay in step: a `storage` listener takes the plan another ShiftCraft tab saved (closing any open dialog), so a tab left open never saves or writes back older information. The Save message counts people, phone numbers, day-by-day availability and training, so you can see what went into the file.
- The Print or save window (`exportImageDialog`) has `layout: 'avail'`: only the layout choice is shown, no preview or picture options; Print (and Save, with a hint to use Save as PDF) calls `printAvailability()`.
- `matchOldTraining()` runs after a team is loaded (Replace or Add): trained ids not among this plan's positions are listed in the order of the person with the most ticks (setRow writes them in location order), each with how many people have it, pre-filled with this location's in-use positions in order; Match them rewrites every person's `trained` (unmatched rows can be left out). Tested with a made-up version-4 file: 12 rows, all 6 people matched.
- `availabilitySheet()` builds the availability sheet (used by `printAvailability()` and by the preview in the Print or save window: the sheet on a 1056 × 816 px white page, scaled to the window's width).
- The availability sheet sets `print-color-adjust: exact` on everything in it, so its black OFF boxes (white bold capitals), green days and yellow pending rows print even when the print window's "Background graphics" is off (tested by printing to PDF without backgrounds).
- The availability printout uses `@page { size: letter landscape; margin: 0 }` with the space put back as padding on the sheet, so the browser has no room for its own header and footer (date, title, address, page number); tested by printing to PDF with the header and footer on: none appear, still one page.
- **Former staff**: `p.left = { why: 'resigned' | 'terminated' | 'other', on: 'YYYY-MM-DD', note }` and `p.active = false`. The Staff tab tables, the training grid and Print for a person leave them out (`!p.left`); everything that already uses `p.active` (Unscheduled, the availability list, checks) leaves them out by that. Shifts after the last day can be removed when marking; past shifts stay (week tables still show them for those weeks). Rehire = delete `left`, active again. Tested with made-up people: 1 later shift removed, 1 kept, details kept, off the printout, back after Rehire.
- The availability printout no longer has the Validated column (it was for the hand-written list); `p.validated` is still kept and set on the Day by day tab.
- Availability list paper: `availPaper(key)` → landscape W × H inches and a zoom (the smaller of (W − 0.8) / 10.2 and (H − 0.8) / 7.7, so it grows to fill the paper and stays one page); `@page` uses that size; remembered in `localStorage[KEY + '-avail-paper']`.
- Saving it: `availabilityCanvas(paper, dpi)` draws the page through an SVG foreignObject (as Print screen does) at dpi / 96; PNG/JPG/BMP go through `canvasBlob` (DPI written into the file); `pdfFromCanvas` writes a one-page PDF by hand (catalogue, pages, page, a DCTDecode JPEG image, a content stream drawing it full page, xref, trailer) at the paper's size in points. Over `tooBig` it falls back to 300 DPI. Tested (made-up people): PDF Letter 300 DPI = one 11 × 8.5 in page; PNG Tabloid 150 DPI = 2550 × 1650; JPG Legal 200 DPI = 2800 × 1700; BMP Letter 300 DPI = 3300 × 2550; Print on Letter, Legal and Tabloid each one page of the right size.
- `fitAvailability(sheet, pg)` replaces the fixed zoom: off screen, a bisection finds the largest zoom (up to 1.5 × the paper's) at which the sheet is no taller than the page and no `.al-day` / `.al-dayhead` cell overflows (the day columns narrow as the rest grows); leftover height is shared out as extra height on the day rows. Used by the preview, the printout (padding moved to `#print-area`) and saving. Tested on Letter, Legal and Tabloid: each one full page, nothing spilling.
