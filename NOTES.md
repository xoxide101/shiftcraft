# ShiftCraft – development notes

How ShiftCraft is built, why it works the way it does, and what to watch out for when changing it. For what it does and how to use it, see [README.md](README.md).

## What it is for

A planning board for labor schedules: build the schedule here first, then copy it into the real (often locked) scheduling system. That is why there are **no approvals** and why the **Hand-off** tab lists shifts in the order you type them in.

## How it is built

- **One file when it runs, many when it is written (2026-11-14):** `index.html` holds the HTML, CSS and JavaScript and must keep working when double-clicked (`file://`) and fully offline, and it saves copies of itself with a plan inside (the emailable file). The source is in `src/`: `index.src.html` (the page, with `<!--@include …-->` and `<!--@app-->` markers), `css/`, `lib/` (qrcode-generator, Craft crypto, Craft account, Craft keys) and `app/NN-name.js`, one file per part of the app, joined in name order. The app parts share one function (00-start.js opens it, 99-start-up.js closes it), so they are pieces, not modules. **Edit `src/`, then run `python build.py`** (`--check` says whether index.html matches). A new part is a new numbered file in its place (time off is 19-time-off.js, after the Staff screens). Names a part uses while a plan loads (02-state.js runs `validatePlan`) must be defined in an earlier part.
- **State:** a single `plan` object, autosaved to `localStorage`:

  ```
  plan = { app, version, company, location, storeNo, address, phone, splh, startDate, weeks (1–8), month 'YYYY-MM',
           midStart, pmStart, staff[], shifts{ 'YYYY-MM-DD': [{ id, staffId, start, end, note? }] },
           forecast{}, history{}, checklist[] }
  staff = { id, name, role (GM | AGM | SM | TM | NH), active, defStart, defEnd, maxHours, notes,
            tasks[{ id, text, date, done }], off[7] (Mon–Sun), parts ['am','mid','pm'],
            empId?, shiftCode?, timeOff?[{ id, from, to, hours: null | [start, end], why, status, note, added }] }
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
- `drawWeekTiles(start, o)`: Visual timeline range `weektile`; the page (paper and orientation as chosen) in a 3 × 3 grid: each day is `drawDaySheet(d, { pageIn: [7, 5], dpi: tile width / 7, numbers })` drawn small; `numbers` (everyone working that week, in the app's groups then by name) makes the day sheet show a number instead of the name and role, the company line is left off the tile (it is the page title) with the day's totals on their own line, and the floor chart is shorter; the legend fills the last two cells. Always raster (also when printing).

## Start (wizard)

The wand in the title bar's quick buttons and the Start button, first on the Schedule tab, open “What do you want to do?”: schedule, week, staff, availability, forecast, print or share, check, company, open, carry on. It shows when ShiftCraft opens; the tick box turns that off (localStorage `shiftcraft-start-show`).

## AI settings (shared)

- js/craft-keys.js (the same file in every Craft app; ShiftCraft and LabelCraft have it inline): where AI runs (local only / both / cloud, localStorage craft-ai-mode) and the cloud keys (craft-ai-keys), shared by every Craft app opened from files; a switch with computer, computer + cloud, cloud, key and bug icons put before the title bar search box and at the end of the status bar by itself. Keys can be saved to craft-ai-keys.json (locked with a password: AES-GCM, PBKDF2 250k) and loaded back. The bug opens Activity (local AI, cloud AI, debug: errors and warnings caught for the session, keys masked).

## After two weeks of real use (2026-11-14)

- **Hours on some days (split shifts)**: the Weekdays and Weekend tabs have "+ Hours on some days" under each person's available hours: a line = the days picked (that tab's days) + from–until; as many lines as needed (two lines on the same day = a split day, e.g. 7am–11am and 4pm–9pm). `p.lines = [{ tab: 'wk' | 'we', days: [0–6, Monday first], from, to }]`. On a day with lines, they are the hours the person can work (in place of the tab's usual available hours); the Day by day entry still wins. `linesOn(p, i)`; `avFromSets` turns them into a times entry (so Day by day and the availability list show "7am - 11am / 4pm - 9pm"); `availIssue` checks each shift against the lines. validatePlan keeps only sensible lines. Tested (made-up people) with real clicks: two lines, Mon + Wed and Mon, saved and shown; a noon Wednesday shift flagged.
- **Split shifts on the reports**: `shiftsOf(p, d)` (a person's shifts that day in time order). The Week tab cell lists each shift; a person's printout has a line per shift; the week table sheet stacks them in the cell; the visual timeline has one row per person with a bar per shift.
- **Printing starts at this week on one page**: the Print or save window always opens on the week of today (when it is in the plan; else the day shown), and on one page: week table = this week, timeline = this week on 1 page (tiles), calendar = this week; the other settings are still remembered.
- **Who is who** (the week-on-one-page legend): under GM / AGM / SM / TM / NH headings, numbered in that order.
- **Your account (AccountCraft)**: a Log in button on the title bar (ShiftCraft's own copies of craft-crypto.js and craft-account.js, as script blocks before the app). From a file or another address the login window asks for the account server once (…/accountcraft/account.php). Logged in, the whole plan is kept in the account too ('shiftcraft' / 'plan <Company · Location>'): each change is sent about 4 s later (only when the plan really changed); on opening, on logging in and when the window comes back (at most once a minute) a newer copy from another computer is taken, or, when this browser changed too, you choose (Undo brings the other back). Example plans are never sent. Tested with two browsers and test accounts: A's change reached B; both changed, A asked and took the account's copy.
- **Contact cards with QR codes** (2026-11-14, the user: the contact sheet pulls QR information, a page of contact QR codes): Print or save › Layout › Contact cards with QR codes; Everyone, or only people with a phone number; cards about 2.6 × 2 in (Letter portrait: 3 × 4 a page, more pages as needed), each with name, role, phone, email and a QR code of a vCard 3.0 (N, FN, ORG company;location, TITLE role, TEL cell, EMAIL) that a phone camera adds to its contacts. QR made by qrcode-generator (Kazuhiko Arase, MIT; the copy BarcodeCraft has, inside the file as a script block) in UTF-8, drawn as rectangles with a 4-module quiet zone, so it is exact in PNG/JPG/BMP/SVG and print. Tested: a 300 DPI Letter page, all 12 codes read back by OpenCV as complete vCards, accents (Zoë Ångström) right.
- **Add to barcode library** (2026-11-14): a button under the Contact cards layout puts each person's contact QR code in the shared Craft barcode library (localStorage `craft-barcodes`; logged in: your account's `craft`/`barcodes` too), one entry per person (id `sc-` + their id, 30 × 30 mm), so sending again updates them. BarcodeCraft shows them, and Insert › Barcode in LabelCraft and PressCraft puts them on a sheet. ShiftCraft keeps drawing its own cards (no 1 MB barcode engine inside the single file).

## Employee ID, shift code and time off (2026-11-14)
- **Employee ID and Shift code** (the user: "employee ID or shiftcode ID"): two boxes per person on Staff › 3 · Contact & training (`p.empId`, `p.shiftCode`, as in the company's own system). The Hand-off page shows them under the name and in the plain-text version (`10234 Name [TM-07]`), for typing into the real scheduler.
- **Time off** (Staff › 5 · Time off, and Time off… on each person): days, weeks or a few hours (the same hours on each day of the range), a reason (Vacation, Sick, Personal, Appointment, Family, School, Bereavement, Jury duty, Other), Requested / Approved / Denied, and a note. Stored on the person (`p.timeOff`), so it goes with team files, the location file and the account copy. Adding it offers to take the person off shifts already scheduled in that time. The list shows Now and coming up / Past / All, with Approve and Deny on requests; the tab label counts requests waiting.

## Split shifts and day off requests (2026-11-14)

- **More than one shift a day** (07-split-shifts.js): right-click a shift › *Split into two* (pick the break; the shift becomes two parts, the note stays on the first) or *Add another shift for … today* (times picked, overlaps refused). Each part is its own shift in `plan.shifts[d]`, so the week view, hand-off, hours and printouts already list them; bars of a split day carry a *split* tag. Check schedule only complains when one person's shifts **overlap** (it used to call any second shift "scheduled twice").
- **Day off requests:** right-click a shift or a name under Unscheduled › *Day off request…*, or **+ Day off request** on Staff › Time off: the time off window set to Requested (reason Personal). A request does not take anyone off shifts; **Approve** does it with one click (the toast offers *Take it off*).
- Names under Unscheduled have a right-click menu too: usual shift, other times, day off request, time off.

## Time off requests in full (2026-11-14)

- The time off window now has: **How long** (All day / Some hours, e.g. an appointment: not available from … until …, the same hours on each day of the range; two separate times on one day = two entries), Reason + **Paid / Unpaid**, Status, **Asked on** + **How they asked** (in person, phone call, text, email, request form, other), **Covered by** (another person), Note. Approving or denying records the date (`decided`). Stored as `asked`, `how`, `cover`, `paid`, `decided` on each `p.timeOff` entry (only when given); validatePlan keeps them clean (TIME_OFF_HOW is in 01-basics.js).
- Ways in: Schedule and Staff ribbon › Time off (Time off request…, Appointment…, Time off list); Edit menu; right-click a shift or a name under Unscheduled (Day off request…, Not available some hours (appointment)…); Staff › 5 · Time off (+ Time off request, + Some hours).
- The Schedule shows **Time off today** under the timeline (everyone off that day, hours, reason, status, cover, note; Approve / Deny on requests). The week table shows *off 9:00am–11:00am* on a day with only some hours off.

## Open next to Save; Save everything keeps your choices (2026-11-14)

- Open (load) is next to Save in the title bar's quick access (Ctrl+O), in Print & share › Save and open, and on the Company & Location tab.
- Save everything (the location file) now also carries this browser's own choices as `prefs`: every `shiftcraft…` localStorage key except the plan itself, `-ui`, `-account`, `-seen` and `-place` (theme, picture and print choices, availability list paper, quick access bar, ribbon, Staff section, Start window). Opening the file puts them back; theme and Staff section at once, the rest after the restart the message offers.
- **On the schedule:** requested and approved time off are checked first in `availIssue` (`timeOffIssue`), so a clashing shift gets the N/A / ! mark everywhere (schedule bars, week table, timeline and calendar sheets, Check schedule). Unscheduled chips show "away" (all day) or "off 9a–1p"; the week table shows "off: vacation". Denied is a record only.
- Tested (real clicks, Example plan): 3 days of vacation took the person off their shift; a requested 9–1 appointment kept the shift with the mark and the note; Approve; reload kept both; IDs on Hand-off.

## Staff table: lined up

- Every person's row has the same layout: Any time and **+ Some days** on top, the hours below (greyed while Any time is ticked), so ticking or adding never makes one row taller than the rest.
- **+ Some days** adds a sub-row under the person (↳ Some days · Mon, Wed): its hours sit under *Hours they can work* and its day buttons (blue) under the *Not available* days, so they read straight down. × Remove takes the line away. Two lines make a split day.
- The buttons at the end of each row stay on one line, so rows are about half as tall as before.

## Row icon buttons

- The buttons at the end of each Staff row are now one matching set of small icon buttons (28 px), with a hover explanation on each: Tasks (a number badge for open tasks), Time off (a dot when time off is now or coming up), Print, Left… and Remove (red on hover).
- The same set is used for + Some days and its Remove, Day by day (From usual, Clear), the Time off list (Approve, Deny, Edit) and Former staff (Edit, Rehire, Delete).
- The row is much narrower, so the table fits on a normal screen with less sideways scrolling.

## Usual shift and hours in one column

- The usual shift now sits on the top line of the *Hours they can work* cell, with the hours they can work (Any time) under it, in three lined-up columns: label · hours · button. One column fewer, so the whole Weekdays table fits a normal wide screen without scrolling sideways.
- Those two lines always stay (no remove button). + on the top line adds a Some days line under the person, lined up the same way, with its days in the label and a trash button; only those lines can be removed.

## School tab

- Staff › **6 · School** is its own permanent tab: tick *In school*, then the school (and grade), the term (first and last day; either can be blank) and the class times (days + hours). + adds a line for days with different class hours; the first line stays, the others have a trash button.
- During the term, class times are hours the person can't work: a shift over them gets the N/A mark with "has school 8:00am – 3:00pm on Mondays". Before or after the term they don't count.
- Unticking *In school* keeps what was set (for next term).

## Day by day shows the hours
- A Day by day cell shows *Any* or *Off* as a word, and hours one range per line: a split day reads 7am–11am over 4pm–9pm. Can't-work hours show as "not …", and class times (while the term is on) as "school 8am–3pm".

## Calendar tab: time off, holiday store hours and events
- A Calendar tab (after Week): a month at a time (Monday first) or a list. Each day shows special store hours, events and
  time off (a dashed line is a request still to approve, ? in front of it too). Click a day's number (or +) for everything
  on that day and to add to it; click an entry to change it.
- Special store hours (`plan.specialHours`): other opening hours, or closed all day, for a holiday or any day. A list of US
  holidays (Thanksgiving, Christmas Eve, Easter… worked out for this year and next) fills in the name and date. They show
  on the Schedule under the date, in the Week heading and on Company & Location; Check schedule points out shifts on a
  closed day and shifts well outside the special hours (over 2 h before opening or 1 h after closing).
- Events (`plan.events`): notes and information for a day (delivery, inspection, meeting), all day or at a time. They
  change nothing else.
- Search and sort: one search box (names, holidays, reasons, notes, "request"), tick boxes for Requests / Approved /
  Denied / Store hours / Events, and in the list: Now and coming up, a month, Past or All; click a heading to sort.
  Requests can be approved or denied right in the list.

## iCal (.ics) in and out
- Export iCal: time off (approved, requests, denied), store hours and events, for everyone or one person, upcoming or
  everything, with an option to leave out notes and reasons. Opens in Outlook, Google Calendar and Apple Calendar. Each
  entry carries X-SHIFTCRAFT-… lines, so a ShiftCraft file comes back exactly.
- Import iCal: any .ics file. Each entry is listed with a guess of what it is (time off for a person whose name is in it,
  the store closed or open other hours, or an event) to change before it goes in. Bringing the same file in again updates
  the entries (matched by id or UID) instead of adding them twice. Times in a time zone are read as local times; an entry
  that repeats weekly or yearly comes in once.

## Availability and contact list: newer details
- Day cells show the hours themselves, one stretch a line (split days stacked), and school class times.
- Employee ID next to each name; a last column with school and time off in the next 8 weeks; under the table, special
  store hours and events coming up.

## Contact QR code for one person
- A QR icon on each Staff row: that person's contact (name, role, company and location, phone, email, Employee ID) as a
  QR code to scan off the screen, print as a card, save as SVG (real millimetres) or .vcf, or put in the barcode library.
  The contact cards printout and its vCards now carry the Employee ID too.

## Usual store hours, Monday to Sunday
- One week of usual hours (`plan.hours.days`, 7 entries Monday first: open/close, closed, or not set), edited in the
  same editor on the Calendar (under the month) and on Company & Location. Older plans' weekdays/weekend hours fill
  the days until the week is changed. "Same as Mon" copies the day above.
- Special store hours on the Calendar (Thanksgiving, Christmas, New Year's Day...) take the place of the usual hours
  on their days. Each month cell shows that day's store hours (bold when special, red when closed).
- A usually closed day shows on the Schedule and Week; Check schedule warns about shifts on it. The availability
  list's footer gives the week in one line (Mon–Sat 7am–9pm · Sun closed).

## Numbered notes on printouts
- On screen, colours and chips tell entries apart. On paper each one gets a small number (¹ ²) and a numbered list
  says what it is: special store hours and events (on the day), time off (on the person's cell, or "off ²"), notes on
  shifts (these used to be a *).
- One choice for every printout, kept in this browser: numbered notes under the sheet, on a separate page after the
  sheets (one list, so a number means the same on every page), or none. It is in the Print or save window and in the
  Calendar tab's print button. The week on 1 page (tiles) has no room under it, so its notes always go on their own page.
- Covers the week table, the visual timeline (day and week tiles), the calendar sheet, the availability list (a second
  PDF page, or a second picture) and the Calendar tab printed from the screen. Code: 29-page-notes.js.

## Contact Cards
- Two separate choices in Print or save › Contact cards, kept in this browser: what is printed on the card, and what
  goes in the QR code (what a phone adds), as a grid: one row an item, two switches, any combination. Title (role),
  Employee ID, shift code, company, location, store number, phone, email, home address, info (their notes); the name
  is always on both. In the code, ID / shift code / store number / info go in the contact's note. The QR window on a Staff row and the barcode library use the same QR choice.
- Each card is centred: name, role · ID, company; the QR code; phone, email and address at the bottom (the phone at
  the same height on every card). Cards per page: standard size (about 2.5 × 3.2 in, as many pages as needed), or
  everyone on 1 page. The window shows the QR size and dot size, and warns when the dots get small.
- QR codes in pictures: every dot is the same whole number of pixels, square, so they scan cleanly.
- Home address per person (Staff › Contact & training, with phone and email, set apart from IDs and notes).
  Company & Location › Contact details we keep: turn the address off when a location does not use it.

## Availability list: details under the table
- No more School · time off column. Under the table, four small tables two by two, for the weeks chosen in Print or
  save (this week, next week, this week and next, the next 2 / 4 / 8 weeks): Store hours (the usual week, alike days
  together, then special hours), Time off (who, when, why, note; requests in italics), Events, Holidays (with the
  store's hours that day). Special and closed days are shaded.
- The details go under the list, on a page of their own (a 2-page PDF, or a second picture), or are left out. Kept in
  this browser. The sheet is fitted to Letter, Legal or Tabloid as before.

### Availability colours

On Staff › Day by day and the printed availability list: green can work, red can't (Off), yellow call or arrange first (the day's Call or arrange first box, or a note like Emergency or If you ask), black not given (the day editor's Not given choice, `{ k: 'unk' }`; Check the schedule warns about shifts on such a day). The printed list has a key under the table.

Changing a day's colour from the cell: on Day by day and in the Weekdays / Weekend tabs' Daily availability column (was Not available), a click goes green › yellow › red › black › green and a right-click menu picks one, edits the hours, or goes back to the weekday / weekend settings (`setAv`, `cycleAv`, `avMenu`). Only that day becomes its own; red and black keep the day's hours in `was`, so going back to green restores them.
