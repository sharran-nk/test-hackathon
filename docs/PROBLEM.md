# Problem framing

Source: `case/brief.md` (Head of Store Operations, grocery chain) and the seed data in `case/seed/`. Anything not in the brief is marked **(assumption)**.

## 1. The problem in one sentence

Roster mistakes such as double-booked staff are found after the roster has gone out, because nothing checks it before it is published.

## 2. 30-second spoken version

"A grocery chain publishes weekly rosters, and managers only find out someone is double-booked when the person doesn't turn up, or turns up twice. By then staff have planned their week around it and the shop is short. I'd build a checker that sits just before 'publish'. You give it the roster, and it tells you in seconds who is booked twice, who is on leave, and who hasn't had enough rest, with the exact shifts to fix. It uses plain rules, not AI, so the manager can see why each flag was raised."

## 3. Version for a technical panel

A pre-publish validation service. Input is a roster (shifts), an employee list and approved leave. Output is a list of structured findings. Each finding has a rule ID, severity, employee, shift IDs and a fix hint, plus a summary of whether the roster is safe to publish. The core is a deterministic rules engine:

1. Parse and validate each row. Bad rows become findings and are excluded from the other rules.
2. Drop exact duplicate rows and report them.
3. Group shifts by employee and sort by start time. Compare neighbours to find overlaps, which covers both same-store and cross-store clashes, and to find rest gaps under the minimum.
4. Compare each shift with the employee's approved leave dates.

Sorting makes this O(n log n), which matters for the 10x question. Only the date, time and ID fields drive the logic, so names don't need to appear in logs. No third-party APIs are needed. AI is optional, for example to phrase findings in plain English, and the app must work without it. Building beats buying here because the rules (rest period, leave policy, cross-store clashes) are specific to the chain, and the check must sit inside their publish step. **(assumption)** A generic rostering package may have some of this built in, and we haven't checked what the chain already uses.

## 4. Who has the pain, and why

| Who | Pain |
|---|---|
| Store managers and rostering staff **(assumption: they build the rosters)** | They build rosters by hand or by export. Errors are hard to spot in 150+ shifts, and they get blamed when it goes wrong. |
| Staff | Told to be in two places, called in on approved leave, or rostered with an 8h turnaround. They lose trust in the roster, and may lose pay or rest. |
| Head of Store Operations (sponsor) | Last-minute gaps, no-shows, complaints, possible working-time exposure **(assumption: the 11h rest rule comes from policy or law)**. The brief says "too late", so the cost lands after publication, when fixing it is expensive and visible. |

## 5. What success looks like

| Measure | Target |
|---|---|
| Recall on the seed data | All 6 planted problems found, 0 false positives (`case/seed/README.md` is the answer key) |
| Speed | A 2-store, 2-week roster (about 150 shifts) checked in under 2 seconds |
| Finding quality | Every finding names the employee, the shift IDs, the rule and a suggested fix |
| Robustness | Malformed rows are reported and never crash the run |
| Offline | Works with no AI and no third-party API |
| Business outcome **(proposed, sponsor to confirm)** | Double-bookings discovered after publication fall from today's monthly count towards 0. The current baseline is unknown. |

## 6. Requirements

### Explicit (from the brief)

- E1. Check a roster before it goes out.
- E2. Detect double-booking.
- E3. Deliver a design doc, an app and a README.

### Implied functional

- F1. Overlapping shifts for one person at the same store.
- F2. One person on shifts at two stores at the same time.
- F3. Shift during approved leave.
- F4. Less than the minimum rest between shifts (11h **(assumption)**).
- F5. Duplicate rows reported once, not as an overlap.
- F6. Missing or malformed fields reported and skipped, not crashed on.
- F7. Each finding has a severity, a plain explanation and the shift IDs involved.
- F8. A summary that says whether the roster is clear to publish.
- F9. A way to load a roster: file upload, or a call to the API.

### Non-functional

- N1. Correct and explainable: the same input always gives the same output, and every flag shows its rule.
- N2. Validate all input and return clear error messages.
- N3. No secrets in code. No personal data in logs (names stay out of logs).
- N4. Structured logging and `GET /health`.
- N5. Automated tests for each requirement.
- N6. Config through environment variables.
- N7. Works without AI.
- N8. Fast enough for chain scale: the check is O(n log n) per roster.

## 7. Constraints

- **Time:** about 4 hours of build in total (design 1.5h, build and host 2.5h per `CLAUDE.md`), then submission and demo prep.
- **Stack:** React, Node.js (Express), Jest and Supertest, Docker, MongoDB or SQL. Anything else must be cleared with the user first.
- **Hosting:** AWS by default (EC2 and Docker Compose), with a live URL in the README.
- **AI:** a bonus only. The app must work without it.
- **Scope:** small and finished beats ambitious. Only what is in the files earns credit.
- **Data:** the seed data is fictional. Real rosters would hold employee personal data, so privacy rules apply.
- **The panel may ban third-party APIs:** the design must not depend on one.

## 8. What is missing or unclear in the brief

| Gap | Assumption to log in `docs/ASSUMPTIONS.md` |
|---|---|
| What "double-booked" means: same time only, or also same day, or two stores? | Any two shifts for one person whose times overlap, at any store. |
| What a "roster" is and how it reaches us (spreadsheet, rostering tool, export?) | CSV files in the same shape as the seed data. |
| Who runs the check: the manager, an ops lead, the rostering tool? | A manager, in a browser, before publishing. |
| Does it block publishing or just warn? | It warns and gives a clear/not-clear summary. A person decides. |
| The minimum rest rule: policy or law, and what number? | 11h between the end of one shift and the start of the next. |
| Which leave counts: approved only, or pending too? | Approved only. The seed has only approved rows. |
| Contracted hours, overtime and weekly limits | Not checked. See section 9. |
| Minimum cover, breaks, skills, opening hours | Not checked. |
| Scale: stores, staff, rosters per week | A few stores and a few hundred staff. I will state what 10x looks like. |
| Time zones, overnight shifts, daylight-saving changes | One time zone, and each shift starts and ends on the same day. |
| How a roster is identified (version, week, draft or published) | One roster per upload. |
| Who may see findings, and who may upload (access control) | A simple access gate, or none for the demo. To be decided in the design. |
| How success is measured today | No baseline is given. |
| Existing systems to integrate with | None assumed. |

## 9. Out of scope for a 4-hour build

- Generating or optimising rosters.
- Live integration with a rostering or HR system.
- Shift swaps, approvals and publishing workflows.
- Email, SMS or push notifications.
- Contracted-hours, overtime, break and minimum-cover rules, and skills matching.
- Multiple time zones and overnight shifts.
- A full user and roles system.
- Payroll.
- Mobile app.
- AI features. They would only be an add-on.

## 10. Data problems found in the seed data

Inspected with read-only commands. Counts are exact.

| File | Rows | Notes |
|---|---|---|
| `employees.csv` | 25 (S01: 13, S02: 12) | Roles: 10 Cashier, 6 Stock Assistant, 3 Deli Assistant, 2 Bakery Assistant, 2 Store Manager, 2 Supervisor. Contracted hours: 8, 12, 16, 20, 24, 32 or 40. |
| `shifts.csv` | 156 rows (155 distinct), S01: 84, S02: 72 | Every employee has at least one shift. Only 11 distinct start/end pairs. |
| `leave.csv` | 5 | All `approved`. |

**Nulls:** none, in any file.

**Problems (the six planted ones):**

| # | Problem | Where | Visible in a single row? |
|---|---|---|---|
| 1 | Overlap, same store | SH024 and SH025, E007 | No, needs a comparison |
| 2 | Same person at two stores at once | SH033 and SH041, E012 | No |
| 3 | Shift during leave | SH098, E015, leave L001 | No, needs `leave.csv` |
| 4 | 8h rest instead of 11h | SH013 and SH021, E003 | No |
| 5 | Exact duplicate row | SH091 appears twice, E005 | Yes (the shift_id repeats) |
| 6 | Malformed date `31/11/2026` | SH086, E010 | Yes (wrong format and not a real date) |

Only rows 5 and 6 are caught by looking at a single row or column. The other four appear only when the rules compare rows, which is the reason the checker is worth building.

**Other observations:**

- **Hours over contract:** four people exceed contracted weekly hours because of the planted shifts (E003, E007, E012 and E015). Not one of the six problems, and not checked.
- **Weak schema:** no roster ID, version or draft/published status, no break times, no time zone, no required role per shift, no store opening hours or minimum cover.
- **Narrow data:** `leave.csv` has only `approved` rows, so pending or rejected leave is untested. Shifts use few time patterns, and none run overnight.
- **Personal data:** names are the only personal data, and they are fictional. There are no emails, phone numbers, dates of birth or addresses. Employee IDs are pseudonymous. Real names would still be personal data, so the app must keep them out of logs and show IDs where it can.
- **Duplicate trap:** the duplicate row also looks like an overlap with itself. The app must report one duplicate, not a double-booking.
