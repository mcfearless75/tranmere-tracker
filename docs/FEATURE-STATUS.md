# Tranmere Tracker / The Solar Campus — Feature Status

_Last reviewed: 2026-06-09. master @ latest, build green, 366 tests passing._

**Legend:** ✅ Live · 🔗 Delegated to Moodle (intentional) · 🔑 Built, needs vendor credentials · ⚠️ Stale after Moodle move (needs a decision) · ❌ Not built · ⏳ Deferred

---

## Student Features
| Feature | Status |
|---|---|
| Bar/Pie chart visuals w/ click-through detail | ✅ attendance bar chart + drill-down (academic pie removed → Moodle) |
| Dashboard (schedule, timetable, fixtures, announcements, reminders) | ✅ |
| Attendance check-in/out, GPS + geofencing | ✅ |
| Training / fixture / education calendar | ✅ |
| Player profile & statistics | ✅ |
| Performance tracking | ✅ |
| IDPs | ✅ |
| Learning Hub | ✅ (curated links) |
| Moodle integration | 🔗 link live · 🔑 data sync needs API key |
| Messaging & notifications | ✅ |
| Bi-weekly wellbeing survey (2nd Monday) | ✅ |
| VEO match analysis access | 🔗 link page live · 🔑 embed/data needs API |
| Catapult performance data access | 🔗 link page live · 🔑 data needs API |
| Digital portfolio | ✅ |
| Goal setting & progress | ✅ |
| Google email account access | ❌ needs Google OAuth/Workspace setup |
| Academic progress bar/pie (visual aid) | 🔗 moved to Moodle (removed in-app by request) |

## Player Health & Lifestyle — all ✅
Nutrition tracking · meal logging · meal photo upload · hydration + goals · gym programme · workout logging · weights/PB tracking.

## Platform Integrations
| Integration | Status |
|---|---|
| Moodle | 🔗 link live · 🔑 REST sync scaffolded, needs token |
| GURU | 🔑 scaffolded, needs API key |
| MyConcern | ✅ link/signposting page (no API needed — as you suspected) |
| VEO | 🔑 scaffolded + link, needs API key |
| Catapult | 🔑 scaffolded + link, needs API key |
| Sports Session Planner | 🔑 scaffolded, needs API key |

_All six configured at `/admin/integrations`; adapters throw "not configured" until a key is saved._

## Staff Features
| Feature | Status |
|---|---|
| Attendance monitoring & reporting | ✅ |
| Academic monitoring | 🔗 now via Moodle (in-app removed) — ⚠️ no Moodle-fed staff view yet |
| Wellbeing monitoring & alerts | ✅ |
| Performance tracking | ✅ |
| Communication tools | ✅ |
| IDP management | ✅ |
| VEO video management | 🔑 needs VEO API |
| Catapult data management | 🔑 needs Catapult API |
| Safeguarding monitoring | ✅ (built this session) |

## Learner Reviews & 1-to-1s — ✅
Termly auto-scheduling (cron) · 10-question review · attendance/punctuality auto-pulled · actions/targets · stored history · AI summaries · PDF export.

## AI Review Summary
Attendance ✅ · Academic progress 🔗 section removed (now on Moodle) · Football development ✅ · Wellbeing ✅ · Future aspirations ✅ · Support needs ✅ · Agreed actions/targets ✅.

## Parent / Guardian
| Feature | Status |
|---|---|
| Attendance monitoring | ✅ |
| Check-in/out notifications | ✅ |
| Academic progress tracking | 🔗 in-app removed → Moodle · ⚠️ parents have link only, no data view |
| Moodle engagement overview | 🔑 needs Moodle API |
| Football development updates | ✅ |
| Fixtures & events | ✅ |
| Announcements & notifications | ✅ (announcements feed built this session) |

## Automated Processes (live crons)
attendance-report AM/PM ✅ · refresh-reports ✅ · check-in-nudges ✅ · session-reminders ✅ · wellbeing-survey ✅ · schedule-reviews (termly) ✅. _(academic-alerts cron removed — coursework is on Moodle.)_

## Future Development — ⏳ deferred
Youth football section · Bursary management · Recruitment portal.

---

## What's left to complete

**1. Your action — credentials (unlocks the 🔑 items):**
Moodle WS token · VEO API key · Catapult API token + org ID · GURU key · Sports Session Planner key · Google OAuth client. These light up: Moodle/VEO/Catapult/GURU/SSP data sync, staff VEO/Catapult management, parent Moodle engagement.

**2. My action — Moodle-pivot cleanup:**
- ✅ DONE: `academic-alerts` cron removed; AI learner-review academic section + stale coursework data removed.
- Remaining: staff "academic monitoring" + parent "academic progress" — currently rely on the Moodle link; a Moodle-API-fed view would need credentials (item 1).

**3. Not built:** Google email access (needs Google Workspace OAuth).

**4. Deferred:** youth section, bursary, recruitment.
