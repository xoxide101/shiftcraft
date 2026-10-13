ShiftCraft
==========

Open index.html in Chrome or Edge (double-click it). Everything stays on this computer.
The sun/moon button (top right) switches light and dark.

It starts with EXAMPLE staff and sales (made-up names) so you can try it.
When you're ready: Staff tab > Clear list, then add your team, then Save list…

Tabs
----
Schedule   Day timeline 4:00am - 11:00pm in 15-minute steps.
           Click a name under Unscheduled to add them with their usual shift.
           Drag a shift to move it. Drag its left/right edge to change start/finish.
           Click a shift for that day's notes. Double-click to type exact times.
           Right-click a shift to edit it, add a note, see tasks, or remove it (Ctrl+Z undoes).
Week       Everyone's shifts and weekly hours, with daily totals. Click a cell to open that day.
Forecast   Trend = average of the same weekday over the last 4 weeks of past sales.
           Type a forecast to override. Target hours = forecast / sales-per-labor-hour.
Hand-off   The day's shifts in order, to type into the real scheduler. Copy or print.
Staff      Name, role (GM, AGM, Shift Manager, Team Member, New Hire), usual shift, max hours, notes.
           Tasks: per-person tasks and training (with dates) and a new-hire checklist.
           Print: that person's schedule. Save list / Load list / Clear list (also in the File menu).

Emailing a schedule
-------------------
File > Save emailable file (.html)  One file with ShiftCraft AND the schedule inside.
                                     Double-click it on any computer and it opens. Attach it to an email.
File > Email or share...            Shares the .html (and optional pictures) to Mail/Outlook on Windows,
                                     or saves them and starts an email for you to attach them.
Note: the .json files are data files. Open them from ShiftCraft (File > Open), not by double-clicking.

Months
------
Pick a month at the top (Month: November 2026). A month = the weeks whose Monday falls in it,
so it is always 4 or 5 weeks. "Week out 1 2 3 4 5" jumps between them.
Every month keeps its own shifts (stored by date), so you can switch back and forth.
Save each month with File > Save all weeks. One month is only about 30-60 KB; the browser
holds about 5 MB, so years of months fit. Settings shows how much is used.
(Custom lengths of 1 to 8 weeks are still possible in Settings > Plan length.)

Pictures and printing (File menu)
---------------------------------
Print or save week table       Names x days grid, with notes lines.
Print or save visual timeline  One page per day: bars for every shift and a "People on the floor" chart.
Print or save calendar         Wall-calendar style: Week, 2 weeks, Month (4 weeks) or the whole plan.
Resolution: 300 DPI (default), 600, 1200, 2400, 4800, 200 or 150.
  2400 and 4800 DPI are too big for picture files in a browser, so those are saved as SVG
  (vector: prints sharp at any DPI). You can also pick SVG yourself as the file type.
Printing always sends vector pages, so printouts use your printer's full resolution.
Times are written like 6:00am - 2:30pm everywhere.

Print screen (File > Print screen, or Ctrl+Shift+P)
---------------------------------------------------
A picture of exactly what is on screen, for whichever tab you are on, including parts you
would scroll to. Save as PNG / JPG / BMP / SVG at 150-4800 DPI (very high DPI saves as SVG),
or Print it. Pictures and printouts always use light colors, even when you edit in dark mode.
Works offline.

Note: "localhost" links only work while Claude is testing. Always open index.html directly.

Availability (Staff tab)
------------------------
Not available: click M T W T F S S (red = can't work that day).
Can work: AM / MID / PM (green). AM, MID and PM times are set in Settings.
Shifts outside someone's availability show N/A on the schedule and ! on the week table.

Files (File menu)
-----------------
File > Save... asks "Save what?"
  Everything      team + schedule: every week and month, forecasts, past sales, settings (Location file)
  Team only       the employee list (roles, usual shifts, availability, tasks, checklist)
  Schedule only   Day / Week / Month / Weeks... (shifts, notes, forecasts)
Quick saves: Save day, Save week (Ctrl+S), Save month, Save team only, Save location.
File names: Company - Location - 11-02-2026 - 12-06-2026.json   (a day: ... - 11-02-2026.json)
Open... (Ctrl+O) works out which kind it is, checks it, and fixes small problems
(times out of range, missing ids, unknown roles), telling you what it fixed.
  - day files: put on their own date or any date you pick
  - weeks files: their own dates or any week of the open month; people matched by name
  - team files: replace the team or just add new people
  - location files: replace everything (asks first; offers to switch company & location)

Company & location (File > Company & location, or click the store name at the top)
-------------------------------------------------------------------------------------
Company, location, store number, address, phone. Saved on this computer and used for every
plan, file name and printout. Opening someone else's file never changes it unless you choose.

Check schedule (Edit > Check schedule, or the button on the Week tab)
--------------------------------------------------------------------
Finds: people scheduled twice, shifts outside availability, inactive people scheduled,
shifts over 10 hours, weekly hours over the max, and times with no Manager or
Shift Manager on the floor.

Notes and the right-click menu
------------------------------
A shift with a note gets an extra line under its bar on the schedule:
yellow highlighter, slightly indented, starting with NOTES:  (click it to edit).
Click a shift          notes for that person on that day ("Note" badge appears)
Double-click a shift   edit times (and notes)
Right-click a shift    Edit shift / Add or edit note / Tasks and training / Remove from schedule
Notes show on the Week tab (under the times), the Hand-off list, and every printout:
the week table, visual timeline and calendar mark the shift with * and list all notes
in a Notes section; person printouts, text and CSV exports include them too.

Edit menu: Copy a day / week / month from ANY dates (past ones too) / Move week / Move whole plan /
           Clear day / Clear week / Clear month / New-hire checklist.

Shortcuts: Ctrl+S save week · Ctrl+Shift+S save week as · Ctrl+O open · Ctrl+P print · Ctrl+Z undo · Left/Right arrows change day
