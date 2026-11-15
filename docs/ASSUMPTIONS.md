# Assumptions

Every item below is **a guess, not a requirement**. None has been confirmed by the customer. Source: `case/brief.md`, `docs/PROBLEM.md`, `case/seed/`. Status of every row: **Unconfirmed**.

★ = one of the 5 most important (wrong answer changes the design or the rules, not just a detail).

## Business

| ID | Assumption | Why needed | Risk if wrong | Clarifying question I would ask the customer |
|---|---|---|---|---|
| B1 ★ | "Double-booked" means one person has two shifts whose times overlap, at the same store or at different stores. | It's the core rule, and the brief doesn't define it. | We miss a kind of clash the customer cares about (for example two shifts on one day with no overlap), or flag things they accept. | "What exactly counts as double-booked? Overlapping times only, or also back-to-back shifts at two stores with no travel time?" |
| B2 ★ | The tool only warns and summarises. A person decides whether to publish. It never blocks. | Decides whether the app is advisory or a gate. Blocking needs integration with the publish step. | If they expect a hard block, the app doesn't deliver. If we block and they didn't want it, managers work around it. | "Should a roster with problems be stopped from going out, or just flagged for the manager to fix?" |
| B3 ★ | A minimum of 11 hours of rest between the end of one shift and the start of the next is an error. The number comes from the seed data, not the brief. | Needed to define the rest check. | The wrong number gives false alarms or misses real breaches. If it's a legal rule, getting it wrong has compliance cost. | "What is the minimum rest between shifts? Is it company policy, a union agreement or the law, and does it differ by country or role?" |
| B4 | Success is "fewer problems found after publication", but there is no baseline. | Needed for a measurable success target. | We can't show the tool helped. | "How many roster errors reach staff per month today, and how do you find out?" |
| B5 | Checking hours (contracted hours, overtime, weekly limits), minimum cover, breaks and skills is out of scope. | Keeps the build small. | The customer expects these and sees the tool as incomplete. | "Besides double-booking, which checks matter most? Rank them." |
| B6 | Building a small checker is better than buying a rostering product with built-in checks. | The panel asks "build or buy". | A suitable product already exists and we duplicate it. | "What rostering tool do you use now, and does it have any checks? Why is it not enough?" |

## Users and roles

| ID | Assumption | Why needed | Risk if wrong | Clarifying question I would ask the customer |
|---|---|---|---|---|
| U1 | The user is a store manager or rostering staff member, working in a browser, before publishing. | Decides the interface and the language of findings. | The real user is an ops analyst or an area manager checking many stores, which needs different views. | "Who builds the roster and who would run the check? One store at a time, or all stores?" |
| U2 | Everyone who can open the app may check any store. There are no per-store permissions. | Keeps the demo simple. | A manager sees staff from other stores they shouldn't. | "Should a manager see only their own store's staff?" |
| U3 | Staff don't use the tool. Only the roster owner sees findings. | Limits who sees personal data. | If staff need a view, there's a privacy and access design to do. | "Do staff or area managers need to see the results?" |
| U4 | A person's home store is only informational. They may legitimately work at either store. | Needed so cross-store shifts aren't flagged just for being at the other store. | We flag normal cover shifts, or miss genuine errors. | "Can staff work at stores other than their home store, and how is that approved?" |

## Data (volume, quality, duplicates)

| ID | Assumption | Why needed | Risk if wrong | Clarifying question I would ask the customer |
|---|---|---|---|---|
| D1 ★ | A roster arrives as CSV files shaped like the seed data (employees, shifts, leave). | We need an input format to build against. | The real source is a spreadsheet, a rostering-system export or an API, and parsing is a larger job than assumed. | "How is a roster produced today, and in what format could we get it?" |
| D2 | Volume is small: 2 stores, 2 weeks, about 150 shifts per roster. Chain scale is a few hundred staff. | Sizing, and the "10x volume" question. | At hundreds of stores, an in-memory check per upload may be too slow or too big. | "How many stores, staff and rosters per week? How far ahead are rosters built?" |
| D3 | An exact duplicate row (including shift ID) is a data error, reported once. It isn't a double-booking. | Seed data has one (SH091). | Duplicates may come from a real double entry the manager wants flagged as a person double-booked. | "If the same shift appears twice, is it a mistake in the file or a real second booking?" |
| D4 | A row with an unreadable date is reported and skipped. The rest of the roster is still checked. | Seed data has one (SH086). | A skipped row hides a real conflict, and the roster looks cleaner than it is. | "If a row can't be read, should the whole check stop, or continue and report it?" |
| D5 | Dates are `YYYY-MM-DD` and times are 24h `HH:MM`. Anything else counts as malformed. | Defines "malformed". | Real data uses other formats, so most rows get rejected. | "Which date and time formats appear in your exports?" |
| D6 | All shifts start and end on the same day, in one time zone. No overnight shifts. | Simplifies interval maths. | Night shifts (22:00 to 06:00) are common in some stores and are wrongly rejected or mis-compared. Daylight-saving changes break rest checks. | "Do any stores run overnight? Are all stores in one time zone?" |
| D7 | Only `approved` leave blocks a shift. Pending or rejected leave is ignored. The seed has only `approved`. | Needed for the leave rule. | A shift on pending leave isn't flagged, or rejected leave wrongly blocks someone. | "Which leave statuses should stop a shift being rostered?" |
| D8 | Leave covers whole days, from `start_date` to `end_date` inclusive. | Seed leave has dates, no times. | Half-days or hourly leave exist, and shifts are wrongly flagged or missed. | "Is leave ever part of a day?" |
| D9 | Employee and store IDs in `shifts.csv` always exist in the employee list. An unknown ID is reported as an error. The seed has none. | Needed to avoid crashing on bad references. | Real data has staff not yet in the list (new starters, agency staff), which we flag as errors. | "Where does the employee list come from, and is it always up to date?" |
| D10 | One upload is one roster, saved as its own record. There's no versioning, no draft or published status, and no comparison between uploads. The seed has no roster ID or status. | Needed so each saved result has a clear scope. | The customer wants to compare versions, or check only changes since the last publication. | "Do you want to check a new version against the last published one?" |

## Security and privacy

| ID | Assumption | Why needed | Risk if wrong | Clarifying question I would ask the customer |
|---|---|---|---|---|
| S1 ★ | Names are personal data, so they are dropped when the files are read and never stored or logged. MongoDB keeps only IDs, stores, dates, times and findings, for 30 days (`RETENTION_DAYS`, my assumption), then deletes them. Logs use IDs only. | Sets privacy, storage and logging rules. The seed has fictional names only. | Names or IDs end up where they shouldn't, which breaches policy or data protection law. If the customer needs longer history or names shown, the stored data and the UI change. | "How long may we keep rosters and results? Which privacy rules apply (for example GDPR)? Who may see staff IDs, and do names need to be shown?" |
| S2 | A simple access gate (or none for the demo) is enough. There's no single sign-on. | Needed to decide on authentication. | Real use needs login tied to the company's identity system. | "How do your staff sign in to internal tools?" |
| S3 | Uploaded files are untrusted: size-limited, type-checked and parsed safely. | Input validation is a project rule. | A large or crafted file crashes or slows the app. | "Are there any limits on file size or format we should know?" |
| S4 | Roster data is internal, not highly sensitive (no pay, no health data). | Sets the security level. | Leave reasons or pay rates are attached later, which changes the level required. | "Does the leave data include reasons (such as sickness) or pay?" |
| S5 | Hosting in one AWS region is acceptable. | Needed for hosting. | The customer requires data in a particular country. | "Is there a rule about where staff data may be stored?" |

## Integrations

| ID | Assumption | Why needed | Risk if wrong | Clarifying question I would ask the customer |
|---|---|---|---|---|
| I1 | No live integration with a rostering or HR system. Files are uploaded by hand. | Keeps the build to the time box. | The customer expects the check to run automatically before publishing. | "Is the check meant to run by itself inside your rostering tool, or on demand?" |
| I2 | No third-party APIs are needed. The design must work if they are banned. | The panel may ban them. | A rule needs an outside source, such as public holidays. | "Are there outside systems we must use, or ones we must avoid?" |
| I3 | Output is on screen and as JSON. No email, SMS or chat notifications. | Scope. | Managers want findings sent to them. | "Where should managers see the results?" |
| I4 | AI isn't used for the checks. If added, it only rewords findings. | CLAUDE.md rule: AI is a bonus. | The panel expects AI. | "Is AI expected, or is a rules-based tool fine?" |

## Operations

| ID | Assumption | Why needed | Risk if wrong | Clarifying question I would ask the customer |
|---|---|---|---|---|
| O1 | Used mostly in a weekly window, by a small number of people at once. No high availability needed. | Sets hosting size and uptime promises. | The tool becomes essential just before publishing, so downtime at the wrong moment is costly. | "When is the check needed, and what happens if it is down for an hour?" |
| O2 | A single EC2 instance with Docker Compose is enough. | Hosting default. | Scale or uptime needs more. | "What are your uptime and recovery expectations?" |
| O3 | Structured logs and `GET /health` are enough monitoring. No alerts. | Operability criterion. | Failures go unnoticed. | "Who looks after the tool when it breaks, and how do they find out?" |
| O4 | The rules (11h rest and similar) can be changed in configuration, not by customers editing them. | Keeps rules adjustable. | Different stores or countries need different rules at run time. | "Do rules differ by store, role or country, and who changes them?" |
| O5 | Support is handled by me. There's no support process or cost model. | Scope. | The customer asks who maintains it. | "Who owns and maintains the tool after the pilot?" |

## The 5 most important assumptions

1. **B1** What "double-booked" means.
2. **B2** The tool warns and doesn't block.
3. **B3** 11h minimum rest.
4. **D1** Roster arrives as CSV in the seed shape.
5. **S1** Names are personal data, so IDs-only logs, names never stored, and a 30-day expiry on what is stored.

## Decisions I must make before coding

These are mine to decide, not the customer's. Each one affects the code.

1. **Overlap rule precision.** Are two shifts that touch (one ends at 14:00, the next starts at 14:00) an overlap? Proposal: no, they touch but don't overlap.
2. **Rest rule precision.** Is exactly 11h acceptable? Proposal: yes, below 11h is the error.
3. **What the app reports for each finding.** Fields, severity levels and the wording. For example error versus warning, with the duplicate and bad-date rows as data-quality findings.
4. **Order of checks.** Validate rows, drop duplicates, then run rules on valid rows only. This decides whether a bad row can hide a conflict.
5. **Input method.** File upload, JSON body or both. And whether the three CSVs come together or separately.
6. **Storage.** Settled by the mandatory stack: MongoDB with Mongoose, as a container on EC2 (see `docs/DECISIONS.md`). Still to confirm with the customer: the 30-day retention and IDs-only storage (S1).
7. **What the user sees.** A web page, an API or both. Decides whether React is needed in the time box.
8. **Access gate.** None, a shared key or a login. The CLAUDE.md stack includes JWT and bcrypt, but I should add only what the demo needs.
9. **How rules are configured.** The minimum rest (11h) and the severity per rule, in environment variables or a small config file.
10. **How to cover the rules in tests.** One test per planted problem, plus the edge cases below, using the seed data as the answer key.

## Edge cases my assumptions create

| Edge case | Caused by | Why it matters |
|---|---|---|
| Shifts that touch (end 14:00, start 14:00) | B1, decision 1 | Flagged or not? A wrong choice gives false alarms at every shift handover. |
| Rest of exactly 11h | B3, decision 2 | Boundary of the rule. |
| Overlapping shifts where one is the duplicate row | D3 | Must give one duplicate finding, not an overlap. |
| Triple booking (three overlapping shifts) | B1 | Report once per person, or per pair? Pairs can grow quickly. |
| Same shift ID used for two different rows | D3 | Not an exact duplicate, so which rule applies? |
| Bad date on a row that would have clashed | D4 | The skipped row hides a conflict, so the summary must say rows were skipped. |
| Malformed row for an unknown employee | D4, D9 | Two errors on one row: how many findings? |
| Shift that crosses midnight | D6 | Treated as malformed, but it is real in some stores. |
| Rest check across the roster boundary | D10 | The first shift of the roster follows a shift from last week that isn't in the file. |
| Leave on a day when the person has two shifts | D7, D8 | One finding per shift, or per leave? |
| Leave `end_date` before `start_date` | D8 | Bad leave row, which the seed doesn't test. |
| Leave status other than `approved` | D7 | Ignored by assumption, but not tested by the seed. |
| Employee on two stores without clashing times | U4 | Allowed, so it must not be flagged. |
| Employee in `shifts.csv` but not in `employees.csv` | D9 | Report, but don't crash. |
| Empty file, header only, or extra columns | D1, S3 | Must give a clear error. |
| Very large upload | D2, S3 | Needs a size limit. |
| Same data in a different order | D1 | Results should not depend on row order. |
| Contracted hours exceeded | B5 | Seed has four such people. The tool is silent on them, so the summary could look "all clear" when a manager expects a warning. |
| Findings containing names | S1 | Names are never stored, so findings and saved results show employee IDs only. |

## Not assumed (still open)

I have no basis for any of these, so nothing is assumed: the chain's real rest rule and its legal source, the actual volume of stores and staff, how rosters are built today, who owns the problem after the pilot, and any budget or deadline beyond the hackathon. These stay as questions until the customer answers.
