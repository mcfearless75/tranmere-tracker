# Fable Findings — Full Codebase Sweep

**Date:** 2026-07-19
**Scope:** Bugs, security, gaps, stale/dead code, performance, new-feature opportunities
**Method:** 8 specialist finder agents + product strategist, adversarial verification on all CRITICAL/HIGH claims. 78 raw findings → deduped and verified. Build green, 517 Jest tests passing.

The dominant theme is **broken authorization on service-role write endpoints**. A large number of API routes and server actions use the RLS-bypassing service-role client but only check *that you are logged in*, not *what role you have*. Middleware does not compensate — its role gate only matches page paths starting with `/admin`, never `/api`. This is one root cause behind ~10 of the findings and should be fixed as a pattern, not one route at a time.

---

## CRITICAL — fix before anything else

### 1. `logStudentMatch` server action: zero auth, service-role insert
`app/(admin)/admin/student-matches/actions.ts:5` — **Verified against source.**
A `'use server'` action creates a service-role client and inserts into `match_logs` with **no `getUser()` and no role check**. Server actions are POST endpoints any client can invoke. Any authenticated user — plausibly unauthenticated — can insert arbitrary match records for any `student_id`, polluting stats, AI reports and parent views. Every other server action verifies the caller; this one verifies nothing.
**Fix:** add `getUser()` → 401 if absent → users-table role lookup restricted to admin/coach/teacher before the insert.

### 2. `attendance_sessions` RLS leaks the check-in `pin_code`
`supabase/migrations/013_attendance.sql:50` — **Verified against source.**
The "students read open sessions" SELECT policy is gated only on `opens_at <= now()` — no role restriction — and returns the whole row including `pin_code`. Any authenticated student can read the live check-in PIN for any open session and mark themselves present without attending, defeating the entire QR/geofence check-in. If the `anon` role has base grants, it is exposed pre-login too.
**Fix:** split the sensitive column out, or replace the policy with a column-limited view / RPC that never returns `pin_code` to students.

### 3. Coach/teacher can mint an **admin** account
`app/api/admin/create-user/route.ts:27` — **Verified against source.** *(Attacker = authenticated coach/teacher, not anon.)*
The route correctly gates the caller to admin/coach/teacher, but the `role` field is taken straight from the request body and never constrained. A coach or teacher (lower-trust staff) can pass `role: "admin"` and create a full admin account — privilege escalation.
**Fix:** only `admin` may set `role` to `admin`; clamp coach/teacher-created roles to student/parent (or a staff allow-list that excludes admin).

### 4. Coach/teacher can reset **any** user's PIN, including the superuser
`app/api/admin/reset-pin/route.ts:18` — **Verified against source.** *(Attacker = authenticated coach/teacher.)*
Same gate, but `userId` is unconstrained. A coach can reset the `superuser@tranmeretracker.internal` admin PIN — lock the admin out and take over the top account.
**Fix:** restrict PIN reset of admin/superuser accounts to an admin caller; block targeting the superuser entirely except by itself.

---

## HIGH — authorization gap cluster (same root cause)

All of these are service-role endpoints that check login but not role. Fix them together with a shared `requireStaff()` helper.

| Endpoint | File | What any logged-in user can do |
|---|---|---|
| Save training schedule | `app/api/attendance/save-schedule/route.ts:35` | Wipe & rewrite the academy training schedule |
| Generate month of sessions | `app/api/attendance/generate-month/route.ts:12` | Bulk-create attendance sessions |
| GPS bulk import | `app/api/admin/gps-import/route.ts:60` | Inject/overwrite GPS data for all players |
| Mark learner review complete | `app/api/reviews/[reviewId]/complete/route.ts:6` | IDOR — complete anyone's review |
| Chat `notifyRoomMembers` / `nudgeRoom` | `app/chat/actions.ts:95` | Push-spoof any user as "Head Coach: …" in rooms they aren't in |
| Chat `leaveOrDeleteRoom` | `app/chat/actions.ts:172` | Destructive room delete without membership check |

**Also HIGH, security-adjacent:**
- **Middleware blocks server-to-server endpoints** — `middleware.ts:4`. Vercel crons, `/api/push/send`, and LTI endpoints are caught by the auth matcher and silently dead unless bearer/secret paths are excluded. Cross-check every cron actually fires.
- **PIN brute-force** — `app/admin-login/AdminPinForm.tsx:30`. 5–7 digit PIN on one well-known superuser email, no app-level lockout. Add rate-limit + lockout.

## HIGH — correctness bugs (verified)

- **Parent Messages & Announcements query a non-existent column.** `app/(parent)/parent/messages/page.tsx:37` and `announcements/page.tsx:40` select `content`; the column is `body` (migration 011). PostgREST errors, error is swallowed, parents permanently see "No messages yet." Both pages are fully non-functional. **Change `content` → `body`.**
- **Parent dashboard "Next Match" is wrong.** `app/(parent)/parent/dashboard/page.tsx:177` orders squad rows by `created_at desc` with no `match_date >= today` filter. Retro-logging a past match shows it as "Next Match" and hides the real fixture. Use the correct pattern already in `parent/matches/page.tsx:84`.
- **Capacitor registration listener attached after `register()`.** `components/PushOptIn.tsx:56` — native token event can fire before the listener exists. Attach listener first, then register.
- **`check-in-nudges` cron: AM nudges never fire.** `app/api/cron/check-in-nudges/route.ts:22` — invalid Date parse makes phase always resolve `pm`.
- **`learner-review` reads non-existent `daily_attendance` columns.** `app/api/ai/learner-review/route.ts:39` — attendance context silently always empty in AI reports.

## HIGH — reliability / scale

- **No `error.tsx` boundary anywhere.** Any thrown error in a server component = white screen. Add root + per-segment boundaries.
- **Only 3 `loading.tsx` across ~45 routes.** Blank freeze on mobile navigation. Add skeletons to the heavy routes.
- **Fire-and-forget safeguarding push can silently never send.** `app/api/wellbeing/submit/route.ts:106` — serverless suspends after response; awaited push or `waitUntil` needed. This is a duty-of-care path.
- **`refresh-reports` cron has no `maxDuration`.** `app/api/cron/refresh-reports/route.ts:40` — sequential Claude calls per student will truncate on timeout as the squad grows.
- **Chat room loads full history unbounded.** `app/chat/[roomId]/page.tsx:37` — add limit + pagination.
- **Dead push subscriptions never pruned.** `app/api/push/send/route.ts:49` — no 404/410 cleanup; the table fills with dead endpoints.
- **Shared-device cross-user push.** `app/api/push/subscribe/route.ts:18` — endpoint not unique per row; previous user's subscription survives a login switch on a shared device (privacy).

## HIGH — database integrity (migrations)

- **RLS recursion can reappear on fresh replay.** `008_fix_rls_recursion.sql:5` — the recursive `users_select_admin` policy from 001 is never dropped, so a clean migration replay reproduces the infinite-recursion bug 008 exists to fix.
- **Bot user inserted directly into `auth.users` via SQL.** `012_chat_bot.sql:37` — violates the project's own GoTrue rule (SQL-inserted auth rows don't authenticate and block the Admin API). Recreate via `admin.auth.admin.create_user()`.
- **12+ FK references to `public.users` with no `ON DELETE`.** `001_initial_schema.sql:57` and across later migrations — user deletion fails on the first FK violation. Matches the known manual-cleanup rule in CLAUDE.md; consider adding explicit `ON DELETE` clauses.

---

## MEDIUM — highlights (33 total, full list below)

- **Stale "Coursework completion %" still default-selected in the live Report Builder** (`reports/builder/ReportBuilderClient.tsx:12`) and a stale "Coursework reminder" template in notifications — education moved to Moodle. User-visible dead features.
- **Recharts dynamic-import refactor is incomplete** — `reports/squad/SquadReportClient.tsx:7` and one other still import recharts statically. Your in-flight `*Inner.tsx` split didn't cover the report clients.
- **`serverExternalPackages` is a Next 15 key, silently ignored on 14.2.35** (`next.config.js:15`) — the Capacitor externalization you intended isn't happening. Use `experimental.serverComponentsExternalPackages` on 14.
- **SW runtime-caches authenticated `GET /api/*` for 24h** (`next.config.js`) — private data cached on device.
- **`public/sw-push.js` is dead** — nothing registers it; the real push handler is `worker/index.js`. Drift risk (this bit us on the recent push bug).
- **Timezone: "today" computed as UTC not London** (`app/(student)/dashboard/page.tsx:51`) — wrong day shown 00:00–01:00 BST. Matches the UTC-cron rule.
- **Attendance % can exceed 100%** (`dashboard/page.tsx:157`) — present days not intersected with scheduled days.
- **Unvalidated `?date=` crashes admin attendance page** (`attendance/page.tsx:13`) — `Invalid Date → toISOString()` throws.
- **`/api/setup` fails open** — `route.ts:16` bootstrap gate fails open on query error and can delete the existing superuser; `verify-pin` is brute-forceable, non-constant-time, fails open when `SETUP_PIN` unset.
- **Recruitment apply endpoint has no rate limiting** (`api/recruitment/apply/route.ts:24`) — public endpoint writing minors' PII, floodable.
- **SECURITY DEFINER attendance functions omit `SET search_path`** (`013_attendance.sql:84`) — search-path hijack surface.
- **Hot FK columns still unindexed after 037** — `match_squads(player_id)`, `match_logs`, `hydration_logs`, `gym_logs`. Extend the new index migration.
- **`match_events` has no student SELECT policy** — players can't read details of matches they're picked for.
- Native notification tap never navigates (no `pushNotificationActionPerformed` listener); no VAPID key-rotation re-sync; several N+1 loops (GPS CSV insert per-row, `remindAll`, `publishToPlayers`).

## Dead / stale code (Moodle migration leftovers)

Safe-to-remove clusters, non-usage grep-verified by the finders:
- Admin coursework cluster still live: `admin/assignments`, `admin/courses`, grade-submissions
- Student `/coursework` page, `AssignmentCard`, `/api/student/evidence`
- Coursework & Progress report pages orphaned from the Reports hub
- `components/GeofenceCheckIn.tsx` — never imported anywhere
- `lib/alerts/alertsUtils.ts` (overdue coursework alerts) — no production caller
- Moodle URLs still generic placeholder login pages (`lib/config/moodle.ts:11`)

## LOW (16)

Non-constant-time cron secret compare; manifest icons lack `maskable`/apple-touch; unbounded admin lists (users, safeguarding); "players notified" shown before push resolves; form labels not associated with inputs; student count pulls every row instead of a head count; `getOrCreateDM` find-then-create race; `.single()` on a legitimately-empty lookup in `ai-report/page.tsx:286`; 7-day signed URL persisted as canonical in `submission_evidence`.

---

## Refuted / not-a-bug
The verification pass discarded lower-confidence claims that didn't survive reading the actual source. Only findings verified against the code are listed above.

---

## New feature opportunities (ranked value/effort)

Every idea is grounded in data the platform already collects.

### Small — quick wins
1. **Personal Bests & Milestones** — auto-detect PBs (top speed, sprint/total distance) on GPS import, push a celebration. Season totals ("100km this term"). Retention lever for 16–18s who currently see only raw charts. *Builds on: `gps_sessions`, gps-import, PushOptIn/webpush.*
2. **Coach Weekly Digest** — one Monday push per coach: squad load trend, wellbeing red flags, attendance dips, reviews due. Replaces trawling six admin pages. *Builds on: attendance-report cron pattern, cohortReport, wellbeing/gps/attendance tables.*
3. **Squad Percentile Benchmarks on the Player Radar** — overlay "top 20% for sprint distance in your year group." Makes development visible, drives IDP chats. *Builds on: PlayerRadar (just refactored), player_attributes, year_group (032).*
4. **Attendance Streaks & Check-in Gamification** — streak counter + term-best badges; nudge cron mentions the streak at stake. Punctuality lever, no new data. *Builds on: daily_attendance, check-in flow, YearBadge.*

### Medium — biggest coach-time / welfare value
5. **Daily Player Readiness Score (traffic-light coach view)** — one R/A/G per player from wellbeing + hydration + gym + GPS load + attendance. Biggest single coach-time saver with current data. *Pure aggregation into a dashboard tile + push.*
6. **Training Load / Injury-Risk (ACWR)** — acute:chronic workload ratio from GPS `player_load`; flag spikes >1.5 to coaches. Injury prevention is the headline promise of GPS and the data is imported but never interpreted. *Builds on: gps_sessions, 037 indexes, gps-dashboard.*
7. **Wellbeing Early-Warning → Safeguarding** — sustained score drops / missed surveys auto-raise a low-severity safeguarding flag for the DSL. Turns passive survey data into active duty-of-care — strong Ofsted story. *Builds on: wellbeing cron, safeguarding module, lib/alerts.*
8. **Post-Match Parent Summary** — after a match is logged, push parents minutes/goals/cards + distance/top-speed. Parent engagement is the stickiest retention lever; the parent portal has no performance content today. *Builds on: match_events/squads/logs, gps_sessions, parent_student_links.*
9. **AI Termly Development Report for parents** — extend the Claude player report into a parent-facing termly narrative. Club-quality report; saves coaches hours. *Builds on: ai_player_reports, refresh-reports cron, goals, reviews, idp.*
10. **AI Review-Prep Pack** — before each scheduled review, Claude drafts a one-page prep sheet per player. Cuts prep from 20 min to 2. *Builds on: schedule-reviews cron, reviews, goals, idp, cached Claude calls.*
11. **Trialist vs Squad Benchmarking (recruitment)** — compare a trial attendee's GPS against squad percentiles for position/age. Objective signing case in one view. *Builds on: recruitment tables (034), gps_sessions.*

### Large — flagship
12. **Return-to-Play Tracker** — staged protocol (gym-only → modified → full contact) with per-stage GPS load caps; alert if a returning player exceeds cap. Closes the injury↔gym↔GPS loop. *Builds on: gym_logs, gps load, idp structure, alerts.*
13. **Veo Clip Links on Match Events** — retire `VeoComingSoon`: attach a Veo URL+timestamp per match_event so players tap a goal and watch it. Most-requested academy feature; big perceived-value jump. *Builds on: VeoComingSoon placeholder, match-events, integration_configs (031).*

---

## Suggested order of work
1. **CRITICAL 1–4** and the **HIGH auth cluster** — one PR introducing `requireStaff()` / `requireAdmin()` helpers and applying them; fix the two parent-page column bugs in the same pass (they're one-line and fully break the parent portal).
2. **Middleware server-to-server exclusion** + verify every cron fires.
3. **Dead-code purge** (Moodle leftovers) — removes stale user-facing features and shrinks the surface.
4. **Reliability**: error/loading boundaries, safeguarding push await, refresh-reports maxDuration.
5. Then pick from features — **Readiness Score** and **ACWR** give the most value for a football academy with the data already sitting there.
