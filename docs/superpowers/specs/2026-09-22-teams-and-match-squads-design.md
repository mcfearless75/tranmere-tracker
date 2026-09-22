# Teams (Prem / White / Blue) and team-driven match squads

**Date:** 2026-09-22
**Status:** Approved design, ready for implementation planning

## Problem

The club runs three standing teams — **Prem**, **White** and **Blue** — and coaches
have already sorted the players into them on paper. The app has no idea they exist.

Today a coach picking a match squad is shown one flat list of every active student
and has to remember, from memory, who is in which team. There is no way to record
team membership, no way to see it, and no way to use it.

`users.year_group` is the only grouping a student has and it means Y1/Y2, not team.
`youth_squads` is a separate system for academy children who have no logins and are
not `public.users` rows, so it cannot be reused. `match_squads` is per-match call-ups,
not a standing roster.

## Goals

1. Record which team each player is in, and let coaches change it easily — including
   from a phone, which is where they actually do this.
2. Make picking a match squad start from a team instead of from nothing.
3. Keep the teams themselves editable (rename, reorder, add a fourth, retire one)
   without a code change.

## Non-goals

- Season history of team membership. A player has a current team; past teams are not
  tracked.
- **Player positions** (GK/CB/FB/CM/CF/FW). The Blue sheet carries one per player and
  they would let the Formation Builder suggest players for a slot, but teams ship
  first and positions follow — decided explicitly, not by omission.
- Per-team fixtures lists, league tables, or team-level stats pages.
- Refactoring the existing client-side `match_squads` writes (see Risks).
- Changing anything about `youth_squads`.

## Decisions made

| Question | Decision |
|---|---|
| Fixed three teams, or coach-managed? | **Coach-managed** `teams` table, seeded Prem / White / Blue. |
| Can a player be in several teams? | **No — exactly one, or none.** |
| Does a match belong to a team? | **Yes.** A fixture is "Blue vs Marine"; the squad picker pre-fills from that team. |
| Membership storage | **`users.team_id` FK**, not a `team_members` join table. |
| Can a non-student be in a team? | **Yes.** At least one coach plays — team membership is role-agnostic. See "Players who are not students". |
| Positions in scope? | **No.** Teams first, positions as a separate follow-up. |

### Why `users.team_id` and not a join table

A join table (mirroring `chat_members`) would be the right shape for multi-team
membership or season history. Both are explicit non-goals. With one-team-per-player,
a nullable FK column enforces the rule structurally — there is no state in which a
player has two teams — and it slots into the existing `users.year_group` editing
pattern (`UserFields.tsx` + `userActions.ts`), so the edit controls are nearly free.

A join table would need a unique index on `player_id` purely to re-impose the rule
the column gives for nothing, and would add a join to every roster read.

### Why `team_id` is nullable

Every one of the ~60 existing students has no team, and new joiners, trialists and
injured players legitimately have none. Forcing a team would mean either a fake
default (the exact bug that made every Year 2 joiner silently a Year 1 — see
`updateUserYearGroup`'s comment) or blocking user creation.

So "unassigned" is a real, first-class state. The Teams page compensates by leading
with an **Unassigned (N)** bucket that stays visible until it is empty, so nobody is
quietly forgotten.

## Data model

New migration: `supabase/migrations/084_teams.sql`.

(It was 083 when this spec was first written; `083_replace_schedule_slots_rpc.sql`
landed from another session hours later. **Re-derive the number immediately before
creating the file** — do not trust this line either.)

### `public.teams`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk default uuid_generate_v4()` | |
| `name` | `text not null` | Unique among active teams |
| `sort_order` | `smallint not null default 0` | Display order; Prem=0, White=1, Blue=2 |
| `is_active` | `boolean not null default true` | Retire a team without deleting history |
| `created_at` | `timestamptz default now()` | |

- `unique index teams_name_active_idx on teams (lower(name)) where is_active` — two
  active teams cannot share a name; a retired team's name is reusable.
- Seeded with Prem, White, Blue in that sort order.
- Name capped at `TEAM_NAME_MAX = 40` in application code. Rejected, never truncated
  — the failure mode from the 2026-09-14 name-field sweep.

### `public.users.team_id`

`uuid references public.teams(id) on delete set null`, nullable.

`ON DELETE SET NULL` rather than cascade: deleting a team must never delete players.
Retiring via `is_active = false` is the intended path; hard delete is a safety net.

### `public.match_events.team_id`

`uuid references public.teams(id) on delete set null`, nullable.

Nullable because every existing fixture has no team, and a coach may run a mixed
friendly. A match with no team behaves exactly as today: no pre-fill.

### RLS

- `teams`: `for all using (public.is_staff())` for staff management, plus
  `for select using (true)` for authenticated readers — students and parents need to
  read team names to render a badge.
- `users.team_id` and `match_events.team_id` are new columns on existing tables and
  inherit those tables' existing policies. No policy changes needed.

Note `is_staff()` already honours `is_active` (migration 068).

### Backfill

The three rosters exist — photographed from "College Squad Lists 2026/27" — so the
migration seeds them rather than leaving coaches to re-enter 46 players by hand.

**46 names on the sheets; all 46 resolved.** 42 matched the `users` table exactly by
normalised name. Three are spelling variants, each confirmed by Paul (only one person
with that surname exists in the database, so identity was never in doubt):

| On the sheet | In the app |
|---|---|
| Robert Ewan Duncan | Ewan Duncan |
| Ollie Piercy | Oliver Piercy |
| Seb Macauley | Sebastian MacAulay |

The 46th, Joseph Barton, is in the database as **"Joseph B" with `role = 'coach'`** —
see "Players who are not students" below.

**Seed by user id, not by name.** This exercise found three name variants in 46 rows;
names are not a stable key. The full verified mapping with ids is in the scratchpad
note `verified-team-rosters.md` and is reproduced in the migration as a literal
`(team, user_id)` list.

Resulting counts: Prem 17, Blue 14, White 15.

Three active students are on none of the three sheets and stay unassigned:
**Khalid Eletu** (Y2 — worth asking Chaid whether that is deliberate), **Paul
McWilliam** (Paul's own account, `role='student'`, not a player) and **RhysJones**
(malformed name, with a separate inactive "Rhys Jones" — a likely duplicate account,
out of scope here).

The migration is idempotent: it only sets `team_id` where it is currently null, so
re-running cannot stamp over a coach's later reassignment.

### Players who are not students

Joseph Barton — "Joseph B" in the app — is a **coach who plays**, and he is on the
Prem sheet. That breaks an assumption the whole squad flow currently makes.

All three squad pickers hard-filter `role = 'student'`:

- `app/(admin)/admin/match-events/page.tsx:19`
- `app/(admin)/admin/match-events/[id]/page.tsx:27`
- `app/(admin)/admin/formation/page.tsx:12`

So today Joseph cannot be picked for a squad at all, and putting him in Prem would
achieve nothing. `match_squads.player_id` is a plain FK to `users` with no role
constraint, so the database has never been the obstacle — only these three queries.

**Decision: team membership is role-agnostic, and a team is what makes someone
pickable.** The three queries change from "active students" to "active students, plus
any active user who has a `team_id`". Consequences:

- Nothing changes for the 48 students.
- Joseph becomes pickable because he is in Prem — no new flag, no role change, and
  no need to misrepresent a coach as a student.
- A coach with no team is completely unaffected, so no other staff member leaks into
  a squad picker.

Two knock-on details:

- `setUserTeam` must **not** reject non-students. This is a deliberate departure from
  `updateUserYearGroup`, which does reject them — year group is a student concept,
  team membership is not.
- `TeamSelect` must render a real control for non-students, not the `—` that
  `YearGroupSelect` renders.
- `<YearBadge>` renders for any `year_group` of 1 or 2 regardless of role, and
  Joseph's is the default 1. He would show a false "Y1" badge in squad pickers, so
  the badge is suppressed for non-students.

### Adjacent bug to fix while here

`app/(admin)/admin/match-events/[id]/page.tsx:27` selects students with **no
`is_active` filter**, so deactivated students still appear in the "Add players later"
picker. Its two sibling queries both filter correctly.

This is the same defect class as the three-wave deactivated-students sweep
(2026-09-11 to 09-13) and is a live instance that sweep missed. The teams work
rewrites this exact query, so it is fixed here rather than left for a future pass.

## Application design

### `lib/teams/types.ts`

Shared constants and types, outside any `'use server'` module — a server-action module
may only export async functions, and exporting a const from one fails the webpack
build while passing tsc and Jest (see `lib/users/types.ts`).

```ts
export const TEAM_NAME_MAX = 40
export interface Team { id: string; name: string; sort_order: number; is_active: boolean }
```

### `components/TeamBadge.tsx`

Sibling to `YearBadge`. Renders a small pill with the team name, or nothing when the
player has no team. Colour is derived deterministically from the team id so a renamed
or newly added team still gets a stable, distinct colour without a hardcoded map.

Used everywhere `<YearBadge>` already appears in a student list.

### `app/(admin)/admin/teams/` — new page

Server component using `createAdminClient()`, following
`app/(admin)/admin/chat-groups/page.tsx`, which is the closest existing analogue
(server page computes membership plus an addable set; client card does multi-select;
server action does the bulk write).

Layout, top to bottom, mobile-first:

1. **Unassigned (N)** card, shown only while N > 0. Lists unassigned active students,
   each with a team picker to place them.
2. One card per active team, in `sort_order`: name, player count, roster.
   - Each player row has a remove control (sets `team_id = null`).
   - **Add players** opens a multi-select over every active student not already in
     this team. Each candidate shows their *current* team badge, so the coach can see
     they are moving Jack from White to Blue, not copying him.
3. **Manage teams** section: rename, reorder, add a team, retire a team.
   Retiring warns with the count of players who will be unassigned.

`app/(admin)/admin/teams/teamActions.ts` — `'use server'`, every action opening with
`requireStaffAction()`:

| Action | Behaviour |
|---|---|
| `setUserTeam(userId, teamId \| null)` | Any role may be assigned — see "Players who are not students". Assignment replaces; no accumulation is possible, the column holds one value. |
| `setUsersTeam(userIds[], teamId)` | Bulk form of the above for the Add players flow. |
| `createTeam(name)` | Trim, length-check against `TEAM_NAME_MAX`, reject empty/duplicate-active. |
| `renameTeam(teamId, name)` | Same validation. |
| `reorderTeams(orderedIds[])` | Rewrites `sort_order`. |
| `setTeamActive(teamId, active)` | Retire/restore. Retiring does **not** null players' `team_id` — restoring brings the roster back. Players in a retired team are shown as unassigned in pickers. |

All revalidate `/admin/teams`, `/admin/users` and `/admin/match-events`.

These are server actions with the service-role client because that is what the
codebase treats as correct for staff writes (`userActions.ts`, `app/chat/actions.ts`).
A Next.js server action is reachable by anyone holding the action id from the client
bundle and is **not** protected by the `/admin` layout, hence the mandatory
`requireStaffAction()` in each.

### Users list and student detail

- `app/(admin)/admin/users/UserFields.tsx` — add `TeamSelect`, built like
  `YearGroupSelect` (a bare `<select>` in a `useTransition()`, with an `aria-label`)
  but **rendered for every role**, not just students — a coach may play. Defined once
  here so the desktop row and mobile card cannot drift (the bug that file's comment
  documents).
- `app/(admin)/admin/users/page.tsx` — select `team_id` and join team names; add
  `Team` to the header array `['Name','Email','Role','Year','Course','Joined']`.
- `app/(admin)/admin/users/userActions.ts` — re-export nothing; `TeamSelect` calls
  `setUserTeam` from `teamActions.ts` directly.
- `app/(admin)/admin/students/[id]/StudentIdentityForm.tsx` — add the same control.
  Staff look here more often than at the Users table.

**Mobile check:** the Users table is `min-w-[600px]`, so a control added only to the
desktop row is invisible on a phone — exactly the defect found on 2026-09-21. The
`TeamSelect` must appear in `UserCard` too, and be verified at 375px width.

### Create match — `app/(admin)/admin/match-events/CreateMatchForm.tsx`

Add a team picker above the existing student grid. Selecting a team:

- sets `team_id` on the `match_events` insert;
- replaces `selected` with that team's active players (all pre-ticked);
- splits the grid into **"<Team> squad"** (pre-ticked, expanded) and
  **"Other players"** (collapsed, nothing pre-ticked).

The coach's job becomes unticking whoever is unavailable, rather than ticking eleven
people from a list of sixty. Call-ups from another team remain possible via the
collapsed section — coaches do this often enough that removing it would be a
regression — but nothing outside the chosen team is ever pre-ticked.

Changing the team after ticking replaces the selection; a confirm guards this when
the coach has already made manual changes.

Selecting no team leaves today's behaviour exactly intact: flat list, nothing ticked.

### Add players later — `app/(admin)/admin/match-events/[id]/AddPlayersLater.tsx`

Group the `available` list by team with the match's own team first. No pre-ticking —
this screen is for adding a specific missing player, not for building a squad.

### Formation Builder — `app/(admin)/admin/formation/FormationBuilder.tsx`

When the selected match has a team, sort that team's players to the front of the
squad chips and show a `<TeamBadge>` on each chip. Nothing is removed: the builder
still lets a coach place any active student, which is existing, intentional behaviour.

### Navigation

Add **Teams** to `components/layout/MobileAdminBar.tsx` (the `nav` array) and
`components/layout/AdminSidebar.tsx`, near Match Squads. `teacherHidden: true`, matching
Formation and Match Squads — teams are a coaching concern.

## Error handling

- Every server action validates its inputs server-side and throws a plain `Error`
  with a message the UI surfaces. Client-side validation is a convenience, never the
  guard.
- `setUserTeam` rejects a non-student target, mirroring `updateUserYearGroup`.
- `createTeam` / `renameTeam` reject empty, over-length and duplicate-active names.
  The unique index is the backstop, so a race produces a caught error, not a duplicate.
- A team deleted concurrently with an assignment surfaces the FK violation as an error
  message; `ON DELETE SET NULL` keeps the player row intact either way.
- Match creation is unchanged in its failure handling: a failed `match_events` insert
  aborts before any `match_squads` rows are written.

## Testing

Jest tests in `__tests__/`:

- `teamActions` — `requireStaffAction` is called before any write (the guard is the
  security boundary and must be proven, not assumed); reassignment replaces rather
  than accumulates; name validation rejects rather than truncates; retiring a team
  preserves `team_id` on its players.
- `TeamBadge` — renders nothing for a null team; stable colour for a given id.
- Create-match pre-fill — selecting a team selects exactly that team's active players;
  deselecting the team clears; an inactive student is never pre-ticked.
- **Squad picker eligibility** — a coach *with* a team appears; a coach *without* one
  does not; a deactivated student never appears (this is the adjacent bug, and the
  test is what stops it regressing a fourth time).
- **Seed migration** — after it runs, the three team counts are 17 / 14 / 15, and
  re-running it does not overwrite a `team_id` that has since been changed.

Manual verification before merge:

- `npm run build` — not just `tsc` + Jest. A real ESLint error once passed both and
  broke the Vercel build for a day.
- The Users page at 375px, confirming `TeamSelect` is reachable on a phone.
- Migration applied to production and probe-verified. This repo has no CI step that
  applies migrations — written is not applied, confirmed twice (012, 065).

## Risks and notes

- **Existing squad writes bypass server actions.** `CreateMatchForm`, `AddPlayersLater`
  and `FormationBuilder` all write `match_squads` through the client-side Supabase
  client, relying on RLS, while users/chat writes go through `requireStaffAction()`
  server actions. That inconsistency is pre-existing and out of scope here; the new
  team writes follow the server-action pattern. Worth a separate pass.
- **The Unassigned bucket is the adoption risk.** If coaches never work through it,
  team pre-fill silently does nothing useful for those players. The bucket is
  deliberately the first thing on the page for that reason.
- **`sort_order` has no unique constraint.** Ties break by name. Reordering rewrites
  the whole set, so ties are transient.
