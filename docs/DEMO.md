# Demo and manual checks

Things that need a real browser or the real host, so they have no automated test (reasons in `docs/REQUIREMENTS.md` section 4). Tick a box only after doing it and seeing the result. **Nothing below has been ticked: no human has run this list in a browser.** What was verified without a browser is listed in the README and in `docs/DEPLOY.md` ("Verified locally").

## Start the demo

```bash
cp .env.example .env     # set JWT_SECRET (32+ chars), MANAGER_PASSWORD (manager123 for the demo), MONGO_ROOT_PASSWORD
docker compose up -d --build && docker compose ps       # both healthy
# create the employee accounts (Git Bash on Windows: prefix with MSYS_NO_PATHCONV=1)
mkdir -p secrets
docker compose run --rm --no-deps -e CREDENTIALS_FILE=/out/credentials.txt \
  -v "$PWD/case/seed:/seed:ro" -v "$PWD/secrets:/out" app node server/seed.js /seed/employees.csv
grep '^E003,' secrets/credentials.txt          # E003's password for the employee part of the demo
```

Open `http://localhost:3000` (or `APP_PORT`). For development with hot reload, see the README (Vite forwards `/api` to port 3000).

## Credentials

| Role | Username | Password |
|---|---|---|
| Manager | `manager` | `MANAGER_PASSWORD` (demo value `manager123`) |
| Employee | `E001` to `E025` | random, in `secrets/credentials.txt` |

## Five-minute walkthrough

1. **Sign-in.** A split screen: the GroceryOps panel on the left, the Manager Login and Employee Login cards on the right, and the amber footer "Demo over unencrypted HTTP. Use fictional data only." on every screen.
2. **Manager login.** Manager Login, username `manager`, the password. The manager portal opens on the Dashboard.
3. **Upload and validate.** Upload Roster, **Use sample data**, **Run validation**. The result shows "Not clear to publish" and exactly six findings:

   | Rule | Employee | Shifts |
   |---|---|---|
   | SHORT_REST | E003 | SH013 + SH021 |
   | DUPLICATE_ROW | E005 | SH091 |
   | OVERLAP | E007 | SH024 + SH025 |
   | DATA_BAD_ROW | E010 | SH086 |
   | OVERLAP | E012 | SH033 + SH041 |
   | ON_LEAVE | E015 | SH098 |

   The tabs show All 6, Overlap 2, Rest 1, Leave 1, Data 2 (the duplicate and the bad row are data findings).
4. **History.** Roster History lists the check. View opens it again with the same six findings. (Delete asks for confirmation.)
5. **Logout**, then **Employee Login** as `E003`. "My schedule" shows E003's tiles, next shift, own shifts and the one finding (Short rest) under Needs attention. Nobody else's data appears. Log out.
6. **Wrong role.** On Employee Login try `manager` and its password: it is refused ("That is a manager account. Use Manager Login instead.").
7. **Outage (optional, shows fail closed).** `docker compose stop mongo`. Reload and try to log in: "Sign-in is unavailable ... database". A manager already signed in who runs a check gets the same kind of message, **not** findings. `docker compose start mongo` and it works again without restarting the app.

## A. Portal checklist (GroceryOps redesign)

Try it on a wide window, at about 800 px (tablet) and at about 360 px (phone). The screens were rendered to HTML and the API calls replayed in Node; **nobody has clicked through them in a browser yet.**

**Sign-in (split screen)**
- [ ] Left: a green GroceryOps panel with the tagline, a store floor-plan drawing and three points. Right: "Sign in to GroceryOps" with two cards, Manager Login and Employee Login. Under about 860 px the left panel shrinks to the brand line and the cards stack.
- [ ] Manager Login opens "Manager sign-in" with Username (pre-filled `manager`) and a masked Password with an eye button that shows and hides it. Employee Login opens "Employee sign-in" with Employee ID (empty). "All sign-in options" goes back.
- [ ] Empty fields: "Enter your username and password." Wrong password: "Invalid username or password." in a red notice; the password box is empty again.
- [ ] A manager account on Employee Login (and the reverse) is refused with a message naming the other login.
- [ ] Stop the server and sign in: "Could not reach the server…". Stop only `mongo`: "Sign-in is unavailable … database …".
- [ ] The amber footer "Demo over unencrypted HTTP. Use fictional data only." is at the bottom of every screen.

**Manager shell**
- [ ] A white sidebar with GroceryOps / FreshMart, "Manager portal", and Dashboard, Upload Roster, Validation Results, Roster History, Logout. The current page has a green tint. The top bar has the profile button (initials, name) which opens a menu with the role and Logout; Escape or a click outside closes it.
- [ ] Under about 900 px the sidebar disappears, a menu button appears in the top bar, and it opens a drawer with the same items; choosing one closes the drawer.

**Dashboard**
- [ ] Greeting by time of day, "Validate a roster" button. Before any upload: Employees and Shifts show "–", Findings and Critical show "–" with "Run a check to see", "No roster checked yet" with a button to Upload Roster, "Stores appear once the employees file is loaded", and "Recent validation activity" lists saved checks from the server (or "No saved checks yet").
- [ ] After "Use sample data": Employees 25 with "2 stores", Shifts 156 with the date range, and the Stores card lists S01 and S02 with staff and shift counts.
- [ ] After validating the sample: Findings 6 "4 roster, 2 data", Critical 4, a "Latest check" card with four bars (Overlap 2, Rest 1, Leave 1, Data quality 2), "Open the findings", and the new check at the top of Recent validation activity.

**Upload Roster (the centre of the product)**
- [ ] Three drop zones: Employees file *, Shifts file *, Leave file (optional), each "Not added". Drag a CSV onto one: it turns green while hovering and shows a tick with the row count and file name. Clicking a zone opens the file picker; Tab to it and Enter also works.
- [ ] "Use sample data" fills all three (25, 156, 5 rows). "Clear files" empties them. "CSV format reference" expands to the three column lists.
- [ ] Empty employees or shifts file, or a file over 1 MB: a red message inside that zone and a red border. Wrong shifts header then Run validation: "The server could not use these files: shifts.csv is missing column(s) …".
- [ ] While validating, the run bar shows the step list with "Reading files" lit and the button reads "Validating…" (cannot be pressed twice). After a check a toast says "Roster checked: 6 findings to fix." and the page jumps to Validation Results.
- [ ] Stop the server and run validation: "Could not reach the server…" with "Try again" that keeps the files.

**Validation Results**
- [ ] A red verdict strip "Not clear to publish: 4 problems and 2 data issues" with four count chips (zero counts dimmed). With a clean roster the strip is green "Clear to publish".
- [ ] Tabs All 6 / Overlap 2 / Rest 1 / Leave 1 / Data 2 filter the table. The search box narrows by employee, shift, text or date (try `E007`, then `SH0`, then `leave`). "No findings match your search." when nothing matches.
- [ ] Columns Issue, Severity, Employee, Shifts, Date, What happened. Issue, Severity, Employee and Date sort when their header is clicked (arrow flips on a second click). Every row has a severity badge.
- [ ] "Fix" on a row opens a detail panel with the server's sentence and a "Recommended action"; "Hide" closes it. Match the six rows to `case/seed/README.md`.
- [ ] The amber "Data quality" line expands to file and line. A result that was not saved shows an amber notice "not saved to history".

**Roster History**
- [ ] Loading shows grey placeholder bars with "Loading saved checks…". Empty: "No saved checks yet". Rows: date (UTC), a Clear / Not clear badge, finding count, shifts checked, a Saved badge and View. The search box on the page narrows the rows shown. Previous / Next with "Page 1 of N · N saved", disabled at the ends.
- [ ] View shows "Saved check" with the counts in the lead, the verdict strip and the table (date column shows "–", description is the server's sentence). "Delete" opens a dialog "Delete this saved check?"; Escape, the X, the backdrop or Cancel close it; "Delete check" removes it, returns to the list and shows a toast "Saved check deleted."
- [ ] With `mongo` stopped, the list shows a red notice with "Try again".

**Employee portal**
- [ ] Sidebar with "Employee portal" and "My schedule" only, the profile button with the employee ID, Logout. No manager items anywhere.
- [ ] Four tiles: Shifts in this roster (with total hours), Upcoming (with the next date), Leave days, Needs attention (red when above zero). A "Next shift" line with the day, time, store and shift ID when a shift is on or after today.
- [ ] "My shifts" lists only this employee's shifts; a shift involved in a finding has a red "Check" badge and past shifts are greyed with "Done". "My leave" shows the range and status. "Needs attention" lists each finding with the shift IDs, the sentence and "Speak to your manager…". For E003: Short rest; for E001: "No problems were found with your shifts."
- [ ] With no roster saved: "No roster yet". With `mongo` stopped: a red notice with "Try again".

**Logout and token handling**
- [ ] Logout (sidebar or profile menu) returns to the sign-in choice with a toast "You are signed out." Signing in again shows an empty Dashboard (files and results are gone).
- [ ] After a successful sign-in, reload the page: you are on the sign-in choice, signed out.
- [ ] Browser dev tools, Application tab: Local storage, Session storage and Cookies are empty for this site. The address bar never shows a token or password. Network tab: only this address is called; the token is only in the `Authorization` header.
- [ ] In a second tab, log out; in the first tab open History: you are returned to sign-in with "Your session has ended. Sign in again."

**Text, not HTML**
- [ ] A shifts file with a row such as `<b>x</b>,E001,S01,2026-11-16,09:00,17:00` shows the row as plain text, with no bold text.

**Look and feel**
- [ ] Body text 14px, table text 13px. Tab through every screen: every control shows a green focus ring; the drop zones and the password eye button work from the keyboard. At 360 px nothing scrolls the page sideways (tables scroll inside their box; KPI tiles stack). With "reduce motion" on, the skeleton shimmer and the progress pulse stop.

## B. Deployment checklist (Milestone 8, not done)
- [ ] `http://<EC2 public IP>:3000/health` returns `{"status":"ok"}`, and a login works from another machine (this proves the database too, `/health` does not).
- [ ] Only port 3000 answers from outside. 27017 never does. 22 only from your IP.
- [ ] Crash recovery with `kill -9` on the app process (not `docker kill`, which is a manual stop).
- [ ] Data survives `docker compose down` then `up -d` (never `-v`).

## Known limitations of the portal

- **No browser test.** `app/tests/ui.test.js` renders the real components to HTML and tests the decision logic, but it cannot click, type or follow a login. This list covers that gap and has not been run.
- **Descriptions of old results.** A result opened from History has no CSV files in the browser, so the table shows the server's sentence and a dash for the date.
- **Demo passwords are public** and there is one shared manager account, no password change, no rate limiting.
- **Employees see the latest saved check** whoever saved it, including checks with problems (no publish step).
- **Everything is plain HTTP.** Use fictional data only.
