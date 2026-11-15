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

1. **Landing.** Two cards, Employee Login and Manager Login, and the amber footer "Demo over unencrypted HTTP. Use fictional data only." on every screen.
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
5. **Logout**, then **Employee Login** as `E003`. "My schedule" shows E003's own shifts and the one finding (Short rest). Nobody else's data appears. Log out.
6. **Wrong role.** On Employee Login try `manager` and its password: it is refused ("That is a manager account. Use Manager Login instead.").
7. **Outage (optional, shows fail closed).** `docker compose stop mongo`. Reload and try to log in: "Sign-in is unavailable ... database". A manager already signed in who runs a check gets the same kind of message, **not** findings. `docker compose start mongo` and it works again without restarting the app.

## A. Portal checklist

Try it on a wide window and at about 360 px.

**Landing and sign-in**
- [ ] A small logo and "FreshMart" sit above two cards, "Employee Login" and "Manager Login". The amber footer is on every screen below.
- [ ] Manager Login opens "Manager sign-in" with a Username field (pre-filled `manager`) and a masked Password field. Employee Login opens "Employee sign-in" with an Employee ID field (empty).
- [ ] Empty fields: "Enter your username and password."
- [ ] Wrong password: "Invalid username or password." and the password box is empty again. An unknown username gives the same message.
- [ ] Correct manager login opens the manager portal. Correct employee login opens the employee portal.
- [ ] A manager account on Employee Login (and the reverse) is refused with a message naming the other login.
- [ ] Stop the server and sign in: "Could not reach the server...". Stop only `mongo`: "Sign-in is unavailable ... database ...".

**Manager portal shell**
- [ ] Header shows the logo, "FreshMart" and "Manager portal". The sidebar lists Dashboard, Upload Roster, Validation Results, Roster History and Logout, with the current page marked. Under about 760 px it becomes a sideways-scrolling row.

**Dashboard**
- [ ] Before any upload: four tiles with dashes and a "Go to Upload Roster" button. After choosing the sample files: Total employees 25 and Total shifts 156. After validating the sample: "Not clear", Conflicts detected 4 "plus 2 data issues".

**Upload Roster**
- [ ] Three rows with "Choose file". "Use sample data" fills them (25, 156 and 5 rows) and says "Ready to validate."
- [ ] An empty employees or shifts file, or a file over 1 MB, shows a red message next to that row. A shifts CSV with the wrong header then "Run validation": "The server could not use these files: shifts.csv is missing column(s) ...".
- [ ] Stop the server and run validation: "Could not reach the server..." with "Try again", keeping the files. While validating the button reads "Validating…" and cannot be pressed twice.

**Validation Results**
- [ ] With the sample, the result opens by itself: red bar "Not clear to publish: 4 problems and 2 data issues", count pills (Overlap 2, Rest 1, Leave 1, Data 2), tabs and all 6 rows without scrolling on a normal laptop screen. Match each of the 6 to `case/seed/README.md`.
- [ ] Each row has an icon and the word "Error" or "Warning". The amber "Data quality" line expands to file and line.
- [ ] Your own small CSVs with no problems: a green "Clear to publish".
- [ ] If the check could not be saved (for example the database dropped during the save), an amber note says the result was not saved to history and the findings are still shown.

**Roster History (manager)**
- [ ] Empty history: "No saved checks yet". After a check: a row with date (UTC), Clear or Not clear, number of findings and shifts checked. 10 per page; Previous and Next work and are disabled at the ends ("Page 1 of 2").
- [ ] View shows "Checked <date> · N employees, N shifts, N leave rows" and the findings. Delete asks "Delete this saved check and its roster?"; Cancel keeps it; confirming returns to the list without it.
- [ ] With `mongo` stopped, the list shows an error with "Try again".

**Employee portal**
- [ ] Header "Employee portal · E003" and a Logout button, no manager menu. "Loading your schedule…" appears briefly.
- [ ] "My shifts" (date, start, end, store, shift ID), "My leave" and "Problems with my shifts" show only this employee's rows. For E003 the problem is "Short rest: E003 has only 8h 0m rest between SH013 and SH021...". For E001 "No problems were found".
- [ ] With no roster saved: "No roster yet". An employee not in the roster: empty tables with plain messages.
- [ ] With `mongo` stopped: an error with "Try again".

**Logout and token handling**
- [ ] Logout returns to the landing page; signing in again shows an empty Dashboard (files and results are gone).
- [ ] After a successful sign-in, reload the page: you are on the landing page, signed out.
- [ ] Browser dev tools, Application tab: Local storage, Session storage and Cookies are empty for this site. The address bar never shows a token or password.
- [ ] Network tab: the only requests go to this same address (`/`, the JS and CSS, `/api/...`). No outside hosts. The token is only in the `Authorization` header.
- [ ] In a second tab, log out; in the first tab click History: you are returned to sign-in with "Your session has ended. Sign in again."

**Text, not HTML**
- [ ] A shifts file with a row such as `<b>x</b>,E001,S01,2026-11-16,09:00,17:00` shows the row as plain text, with no bold text.

**Look and feel**
- [ ] Body text 14px, table text 13px. Tab through every screen: every control shows a focus ring, and file buttons work with Enter or Space.
- [ ] At about 360 px nothing scrolls the page sideways (tables scroll inside their own box). With "reduce motion" on, nothing changes except colour.

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
