# Demo and manual checks

Things that need a real browser or the real host, so they have no automated test (reasons in `docs/REQUIREMENTS.md` section 4). Tick a box only after doing it and seeing the result. **Nothing below has been ticked yet: no human has run it in a browser.**

## Run it locally

```
cd app && npm install && cd client && npm install && npm run build && cd ..
ACCESS_KEY=<a temporary value> node server/server.js     # then open http://localhost:3000
```

For development with hot reload: run the server as above on port 3000, then `npm run dev` in `app/client` and open the address Vite prints. Vite forwards `/api` to port 3000.

## A. Portal checklist (FR-14, FR-21, NFR-S5, NFR-S6)

Status: **not yet run by a human.** The screens were rendered to HTML in Node and the API calls were replayed, which is not a browser check. Try it on a wide window and at about 360 px.

**Landing and sign-in**
- [ ] A small logo and "FreshMart" sit above two separate cards, "Employee Login" and "Manager Login". A thin amber footer line says "Demo over unencrypted HTTP. Use fictional data only." on every screen.
- [ ] "Employee Login" opens a plain notice that the portal opens once a manager has published a roster. There is no sign-in. "Back" returns.
- [ ] "Manager Login" opens a small password form with the cursor in the field.
- [ ] Empty password: "Enter the password to sign in."
- [ ] Wrong password: "That password was not accepted. Try again." and the field is empty again.
- [ ] Right password: the manager portal opens on Dashboard.
- [ ] Stop the server and sign in: "Could not reach the server..."

**Portal shell**
- [ ] Header shows the logo, "FreshMart" and "Manager portal". The sidebar lists Dashboard, Upload Roster, Validation Results, Roster History and Logout. The current page is marked by a green bar, bold text and a tint.
- [ ] Under about 760 px the sidebar becomes a single row of menu buttons that scrolls sideways.
- [ ] Roster History says "Available after the database is added".

**Dashboard**
- [ ] Before any upload: four tiles with dashes ("Total employees", "Total shifts", "Validation status: Not run", "Conflicts detected") and an empty state with a "Go to Upload Roster" button.
- [ ] After choosing files (before validating): Total employees 25 and Total shifts 156 fill in.
- [ ] After validating the sample: "Not clear" with an icon, Conflicts detected 4 "plus 2 data issues", and a line with a "View validation results" button.

**Upload Roster**
- [ ] Three rows with "Choose file" buttons and "No file chosen". "Still needed: the employees file and the shifts file."
- [ ] "Use sample data": every row shows a tick with a row count (25, 156 and 5 rows) and "Ready to validate."
- [ ] Choose a real CSV: its row count and file name show, and the button says "Replace file".
- [ ] An empty file for employees or shifts: a red message next to that row. A file over 1 MB: "... larger than 1 MB ...".
- [ ] A shifts CSV with the wrong header, then "Run validation": "The server could not use these files: shifts.csv is missing column(s) ...".
- [ ] Stop the server and run validation: "Could not reach the server..." with a "Try again" button that keeps the files.
- [ ] While validating the button reads "Validating…" and cannot be pressed twice.

**Validation Results (the 5-second test)**
- [ ] With the sample, the result opens by itself. Without scrolling on a normal laptop screen you see: a slim red bar "Not clear to publish: 4 problems and 2 data issues", count pills (Overlap 2, Rest 1, Leave 1, Data 2), the tabs and all 6 table rows.
- [ ] Tabs All 6, Overlap 2, Rest 1, Leave 1, Data 2 filter the table.
- [ ] Table columns are Rule, Employee, Shift IDs, Date, Description. Every row has an icon and a word for severity ("Error" or "Warning"). The two data rows use the file icon.
- [ ] Each description is one short line, for example "Only 8h rest: ends 22:00, next starts 06:00 (needs 11h)".
- [ ] The amber line "Data quality: 1 row skipped (1 unreadable), 1 duplicate row counted once" expands to the file and line.
- [ ] Match each of the 6 to `case/seed/README.md`.
- [ ] Load your own small CSVs with no problems: a slim green bar "Clear to publish".
- [ ] (Optional) Start the server with `MAX_FINDINGS=2` and validate the sample: an amber note says the list was cut off.

**Logout and key handling (NFR-S6)**
- [ ] "Logout" returns to the landing page. Signing in again shows an empty Dashboard (files and results are gone) and the password box is empty.
- [ ] After a successful check, reload the page: you are on the landing page, signed out.
- [ ] In the browser dev tools, Application tab: Local storage, Session storage and Cookies are empty for this site.
- [ ] The address bar never shows the key.
- [ ] Network tab: the only requests go to this same address (`/`, the JS and CSS files, `/api/check`). No outside hosts.

**Text, not HTML (NFR-S5)**
- [ ] A shifts file with a row such as `<b>x</b>,E001,S01,2026-11-16,09:00,17:00` shows the row as plain text in the table and the data line, with no bold text.

**Look and feel**
- [ ] Body text is 14px and table text 13px, readable on a laptop. Tab through every screen: each control shows a visible focus ring, and the file buttons work with Enter or Space.
- [ ] At about 360 px nothing scrolls the whole page sideways (the table scrolls inside its own box).
- [ ] With "reduce motion" turned on in the operating system, nothing changes except colour.

## Known limitations of the portal

- **Manager sign-in is a temporary workaround.** The API has no sign-in endpoint, so the page checks the password by sending an empty `POST /api/check` and reading the status: 401 means a wrong key, 400 means a right key (the empty body is invalid). It works only because the server checks the key before it looks at the body, and `app/tests/api.test.js` ("sign-in key check does not depend on the body") fails if that order ever changes. It will be replaced by a proper manager sign-in endpoint. Until then the password is the shared `ACCESS_KEY`, there are no personal accounts, and it travels over unencrypted HTTP.
- **Employee login is not built.** The Employee card only leads to a notice.
- **Descriptions use the files the page holds.** The shift date, times and stores in each table row come from the CSV text loaded in this browser tab. A result opened later from History (milestone 4) would show the server's own sentence and a dash for the date until the API sends those fields.
- **No UI tests.** The screens are checked by this list and by source scans, not by browser tests.

## B. Deployment checklist (milestone 3, not done yet)
- [ ] `http://<EC2 public IP>:3000/health` returns `{"status":"ok"}`.
- [ ] The dashboard works from another machine with the sample data.
- [ ] Only port 3000 answers from outside. Ports 22 (from other IPs) and 27017 do not.
- [ ] `docker kill` the app container: it comes back by itself.

## C. History and database checklist (milestone 4, not done yet)
- [ ] A check appears in the History list and can be reopened after a reload.
- [ ] Stop the database container: a check still returns findings with `saved: false`, and History says it is unavailable.
