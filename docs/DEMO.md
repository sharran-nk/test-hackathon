# Demo and manual checks

Things that need a real browser or the real host, so they have no automated test (reasons in `docs/REQUIREMENTS.md` section 4). Tick a box only after doing it and seeing the result. **Nothing below has been ticked yet: no human has run it in a browser.**

## Run it locally

```
cd app && npm install && cd client && npm install && npm run build && cd ..
ACCESS_KEY=<a temporary value> node server/server.js     # then open http://localhost:3000
```

For development with hot reload: run the server as above on port 3000, then `npm run dev` in `app/client` and open the address Vite prints. Vite forwards `/api` to port 3000.

## A. Dashboard checklist (FR-14, FR-21, NFR-S5, NFR-S6)

Status: **not yet run by a human.** The components were rendered to HTML in Node and the API replay was run, which is not a browser check. Look at this on a projector-sized screen and on a phone-width window.

**First screen (before any check)**
- [ ] A thin amber strip at the very top says "Demo over unencrypted HTTP. Use fictional data only."
- [ ] Three numbered steps are visible: 1 Access key, 2 Roster files (three drop zones and a "Try with sample data" button), 3 Check roster. "Still needed: ..." lists what is missing.
- [ ] Below them an empty state says "No roster checked yet".
- [ ] The key box hides what is typed, and pressing Enter in it starts a check.
- [ ] A one-line "History: not available yet" is at the bottom (milestone 4).

**The 5-second test (sample data)**
- [ ] Type the key, click "Try with sample data": all three zones show a green tick and a row count (25, 156, 5), and step 2 gets a tick.
- [ ] Click "Check roster": a skeleton shows briefly, then the inputs collapse to one bar ("Checked 156 shifts") with "Check another roster".
- [ ] A large **red** slab reads "Not clear to publish" with the sentence "4 problems need fixing before this roster goes out." and four big numbers: 2 Double-booked, 1 Short rest, 1 On leave, 2 Data issues. Nothing else is above the fold.
- [ ] Without colour, the verdict is still clear (icon, heading and sentence say it).

**Cards**
- [ ] Filter chips show counts: All 6, Overlap 2, Rest 1, Leave 1, Data 2. Each chip filters the cards, and "Nothing in this group." shows for an empty one.
- [ ] One card per employee, errors first, the warning (E005) last: E003, E007, E010, E012, E015, E005. Each shows "Store S01/S02".
- [ ] Each problem is one plain line, for example "Only 8h rest between Tue 22:00 and Wed 06:00 (needs 11h)" and "Double-booked on Thu 19 Nov: 10:00–16:00 at S01 and 12:00–18:00 at S02", with an icon, an "Error" or "Warning" tag, and a one-line "Fix:" hint.
- [ ] "Details" opens shift IDs, rule code, file and line, and the checker's own sentence. "Hide details" closes it.
- [ ] The amber "Data quality" strip says "1 row skipped (1 unreadable), 1 duplicate row counted once" and expands on click to the file and line.
- [ ] Match each of the 6 to `case/seed/README.md`.

**Green and truncated**
- [ ] Click "Check another roster": the inputs come back, files are cleared, the key is still filled in.
- [ ] Load your own small CSVs with no problems: a **green** slab "Clear to publish", and the strip says all rows were read.
- [ ] (Optional) Start the server with `MAX_FINDINGS=2`, check the sample: an amber note says the list was cut off.

**Errors (plain English, nothing crashes)**
- [ ] Click "Check roster" with no key: the message appears under step 1 and the cursor goes to the key box.
- [ ] Right key missing files: "Add the employees and shifts files first, or try the sample data."
- [ ] Wrong key + sample data: "That access key was not accepted..." under step 1, and the box is empty again.
- [ ] Drop an empty `.csv` on Employees: the red message appears under that zone only.
- [ ] Drop a file over 1 MB: "... is larger than 1 MB ...".
- [ ] Drop a CSV with the wrong header on Shifts, then check: "The server could not use these files: shifts.csv is missing column(s) ...".
- [ ] Stop the server and check: "Could not reach the server..." with a "Try again" button that keeps the files.

**Look and feel**
- [ ] Body text is large and readable at the back of a room. Tab through the page: every control shows a visible focus ring, and the drop zones can be used with Enter or Space.
- [ ] Narrow the window to about 360 px: the four numbers go 2 by 2, chips scroll sideways, nothing scrolls the whole page sideways.
- [ ] Switch the operating system to dark mode: the page follows it, the verdict is still red or green with white text.
- [ ] With "reduce motion" turned on in the operating system, nothing fades or pulses.

**Key handling (NFR-S6)**
- [ ] After a successful check, reload the page: the key box is empty and the results are gone.
- [ ] In the browser dev tools, Application tab: Local storage, Session storage and Cookies are empty for this site.
- [ ] The address bar never shows the key.
- [ ] Network tab: the only requests go to this same address (`/`, the JS and CSS files, `/api/check`). No outside hosts.

**Text, not HTML (NFR-S5)**
- [ ] A shifts file with a row such as `<b>x</b>,E001,S01,2026-11-16,09:00,17:00` shows the row as plain text under Data quality, with no bold text.

## B. Deployment checklist (milestone 3, not done yet)
- [ ] `http://<EC2 public IP>:3000/health` returns `{"status":"ok"}`.
- [ ] The dashboard works from another machine with the sample data.
- [ ] Only port 3000 answers from outside. Ports 22 (from other IPs) and 27017 do not.
- [ ] `docker kill` the app container: it comes back by itself.

## C. History and database checklist (milestone 4, not done yet)
- [ ] A check appears in the History list and can be reopened after a reload.
- [ ] Stop the database container: a check still returns findings with `saved: false`, and History says it is unavailable.
