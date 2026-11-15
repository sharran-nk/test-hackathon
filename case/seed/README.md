# Seed data

Fictional data for two stores: S01 Northfield and S02 Riverside. Roster period: Mon 2026-11-16 to Sun 2026-11-29. No real people.

| File | Rows | Columns |
|---|---|---|
| employees.csv | 25 | employee_id, name, home_store, role, contracted_hours_per_week |
| shifts.csv | 156 (155 distinct + 1 duplicate) | shift_id, employee_id, store_id, date, start, end |
| leave.csv | 5 | leave_id, employee_id, start_date, end_date, status (all `approved`) |

Times are 24h `HH:MM`, and every shift starts and ends on the same day. Dates are ISO `YYYY-MM-DD`, except the one malformed row below.

## Planted problems (exactly 6)

A correct checker should report these and nothing else. "Line" is the line number in shifts.csv, header = line 1.

| # | Problem | Shift IDs (line) | Employee | Detail |
|---|---|---|---|---|
| 1 | Overlapping shifts, same store | SH024 (25), SH025 (26) | E007 Mei Tanaka | S01 on 2026-11-18: 09:00-15:00 and 13:00-19:00. Overlap 13:00-15:00. |
| 2 | Same person at two stores at the same time | SH033 (34), SH041 (42) | E012 Omar Haddad | 2026-11-19: S01 10:00-16:00 and S02 12:00-18:00. Overlap 12:00-16:00. |
| 3 | Shift during approved leave | SH098 (100) | E015 Dev Sharma | S02 shift on 2026-11-24 08:00-16:00. Leave L001 covers 2026-11-24 to 2026-11-25. |
| 4 | Under 11 hours' rest | SH013 (14), SH021 (22) | E003 Aisha Rahman | S01 2026-11-17 ends 22:00, next shift 2026-11-18 starts 06:00. Rest is 8h. |
| 5 | Duplicate row | SH091 (92 and 93) | E005 Grace Okafor | Identical row, same shift_id: S01 2026-11-24 06:00-14:00. |
| 6 | Malformed date | SH086 (87) | E010 Ravi Menon | Date is `31/11/2026` (wrong format and not a real date). Row is otherwise valid: S01 16:00-22:00. |

## Notes for checking the app

- **Duplicate (5):** both copies are the same shift, so the second must be reported as a duplicate. It must not also be reported as the person overlapping themselves.
- **Malformed date (6):** SH086 can't be placed on a day, so it should be flagged as bad input. It must not crash the run, and it must not be silently dropped. The other 154 distinct shifts are valid.
- **Two stores (2):** this is also a time overlap, but across stores. A good checker names both stores.
- **Leave (3):** L001 also covers 2026-11-25. E015 has no shift that day, so only SH098 should be flagged.
- **Leave rows that must produce no findings:** L002 (E005, 11-16 to 11-17), L003 (E021, 11-26 to 11-28), L004 (E009, 11-20) and L005 (E002, 11-27 to 11-29). I checked that no shift falls on those days.
- **Hours side effect:** four people go over their contracted weekly hours because of the planted shifts. E003 has 40h against 24h in week 1, E007 has 32h against 20h, E012 has 28h against 16h, and E015 has 40h against 32h in week 2. These are not one of the six problems. Don't treat them as expected findings unless the app has an overtime rule. The brief doesn't ask for one.
- Every other shift was checked with a separate script. None overlap, none have under 11 hours' rest, none fall on leave, and every employee_id and store_id exists.
