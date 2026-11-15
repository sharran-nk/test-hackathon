# Demo and manual checks

Things that need a real browser or the real host, so they have no automated test (reasons in `docs/REQUIREMENTS.md` section 4). Tick a box only after doing it and seeing the result. **Nothing below has been ticked yet: no human has run it in a browser.**

## Run it locally

```
cd app && npm install && cd client && npm install && npm run build && cd ..
ACCESS_KEY=<a temporary value> node server/server.js     # then open http://localhost:3000
```

For development with hot reload: run the server as above on port 3000, then `npm run dev` in `app/client` and open the address Vite prints. Vite forwards `/api` to port 3000.

## A. Dashboard checklist (FR-14, FR-21, NFR-S5, NFR-S6)

Status: **not yet run by a human.** The components were rendered to HTML in Node and the API replay was run (see the commit notes), which is not a browser check.

**Page and notice**
- [ ] The header shows "Roster Checker" and the line "Demo over unencrypted HTTP. Use fictional data only."
- [ ] The key box hides what is typed (password field).
- [ ] The History section is there and says it is not available yet (milestone 4).

**Errors (each message is plain English and nothing crashes)**
- [ ] Click "Check roster" with no key: "Enter the access key first."
- [ ] Type a key, click "Check roster" with no files: "Load the employees and shifts files first..."
- [ ] Wrong key + sample data: "The access key was not accepted..." and the key box is empty again.
- [ ] Pick an empty `.csv` as the employees file: "... is empty ...".
- [ ] Pick a file over 1 MB: "... is larger than 1 MB ...".
- [ ] Pick a CSV with the wrong header as the shifts file, then check: "The server could not use these files: shifts.csv is missing column(s) ...".
- [ ] Stop the server, click "Check roster": "Could not reach the server ...".
- [ ] While a check runs the button reads "Checking..." and cannot be clicked twice.

**Sample data, the main flow**
- [ ] Right key, click "Load sample data": the three file lines say "Loaded: sample ... .csv".
- [ ] Click "Check roster": the banner is **red** and says "Not clear to publish", "6 finding(s): 5 error(s), 1 warning(s)".
- [ ] Counts: 2 Double-booked, 1 Short rest, 1 On approved leave, 1 Unreadable row, 1 Duplicate row, 0 Unknown ID. "Shifts received: 156. Checked: 154. Rows skipped: 1."
- [ ] Roster problems table shows 4 rows with Error badges: E003 SH013/SH021 (8h 0m), E007 SH024/SH025, E012 SH033/SH041 (names S01 and S02), E015 SH098 (leave L001).
- [ ] Data quality box lists the duplicate (SH091, lines 92 and 93, Warning badge) and the unreadable date (line 87, `31/11/2026`).
- [ ] Each of the 6 matches the answer key in `case/seed/README.md`.

**Green and truncated**
- [ ] Load your own small CSVs with no problems: banner is **green**, "Clear to publish", the table says no problems were found, and the Data quality box says all rows were read.
- [ ] (Optional) Start the server with `MAX_FINDINGS=2` and check the sample: the amber "cut off" warning appears.

**Key handling (NFR-S6)**
- [ ] After a successful check, reload the page: the key box is empty and the results are gone.
- [ ] In the browser dev tools, Application tab: Local storage, Session storage and Cookies are empty for this site.
- [ ] The address bar never shows the key.
- [ ] Network tab: the only requests go to this same address (`/`, the JS and CSS files, `/api/check`). No outside hosts.

**Text, not HTML (NFR-S5)**
- [ ] A shifts file with a row such as `<b>x</b>,E001,S01,2026-11-16,09:00,17:00` shows the row as plain text in Data quality, with no bold text.

## B. Deployment checklist (milestone 3, not done yet)
- [ ] `http://<EC2 public IP>:3000/health` returns `{"status":"ok"}`.
- [ ] The dashboard works from another machine with the sample data.
- [ ] Only port 3000 answers from outside. Ports 22 (from other IPs) and 27017 do not.
- [ ] `docker kill` the app container: it comes back by itself.

## C. History and database checklist (milestone 4, not done yet)
- [ ] A check appears in the History list and can be reopened after a reload.
- [ ] Stop the database container: a check still returns findings with `saved: false`, and History says it is unavailable.
