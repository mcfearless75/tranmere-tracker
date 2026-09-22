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

New migration: `supabase/migrations/083_teams.sql`.
(Re-derive the number immediately before writing the file — another session may have
landed one.)

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

None. All existing students start unassigned and surface in the Unassigned bucket;
coaches sort them using the new UI. This is deliberate — we do not have the paper
allocation in a machine-readable form, and guessing would be worse than empty.

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
| `setUserTeam(userId, teamId \| null)` | Target must be `role === 'student'`. Assignment replaces — no accumulation is possible, the column holds one value. |
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

- `app/(admin)/admin/users/UserFields.tsx` — add `TeamSelect`, built exactly like
  `YearGroupSelect`: a bare `<select>` in a `useTransition()`, `aria-label`, rendering
  `—` for non-students. Defined once here so the desktop row and mobile card cannot
  drift (the bug that file's comment documents).
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
  security boundary and must be proven, not assumed); non-student targets rejected;
  reassignment replaces rather than accumulates; name validation rejects rather than
  truncates; retiring a team preserves `team_id` on its players.
- `TeamBadge` — renders nothing for a null team; stable colour for a given id.
- Create-match pre-fill — selecting a team selects exactly that team's active players;
  deselecting the team clears; an inactive student is never pre-ticked.

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
