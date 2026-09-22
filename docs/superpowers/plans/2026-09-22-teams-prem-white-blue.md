# Teams (Prem / White / Blue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the club's three standing teams a home in the app, seeded with the real rosters, and make match-squad selection start from a team instead of from a flat list of sixty names.

**Architecture:** A coach-managed `teams` table, one team per player via a nullable `users.team_id` foreign key, and `match_events.team_id` so a fixture pre-fills its squad. Team membership is role-agnostic — having a team is what makes someone pickable for a squad, which is how a coach who plays gets into a squad without being misrepresented as a student. All writes go through `'use server'` actions guarded by `requireStaffAction()`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (`@supabase/ssr` + service-role admin client), Tailwind, Jest + Testing Library, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-09-22-teams-and-match-squads-design.md`

## Global Constraints

- **Migration number must be re-derived immediately before creating the file.** It was 083 when the spec was written and 084 by the time this plan was written, because another session landed one in between. Run `ls supabase/migrations/ | sort | tail -1` and use the next number. This plan says `084_teams.sql` throughout; rename if it is taken.
- **Every new migration must be applied to production manually.** This repo has no CI step that applies migrations — written is not applied, confirmed twice (012, 065).
- **Migration replay CI runs against a blank database.** The seed `UPDATE ... WHERE id IN (...)` matches zero rows there, which is fine. Never add an `INSERT` that references a hardcoded production uuid — that is what broke replay at migration 054.
- **`npm run build` must pass before merge**, not just `tsc` + Jest. A real ESLint error once passed both and broke the Vercel build for a day. Note `next.config.js` ignores lint and typecheck during builds, so CI is the only enforcement.
- **TypeScript strict — no `any` without justification.**
- **Name fields reject, never truncate.** `TEAM_NAME_MAX = 40`, enforced client-side as `maxLength` and re-checked server-side.
- **Constants shared between client and server must not live in a `'use server'` module.** A server-action module may only export async functions; exporting a const from one fails the webpack build while passing tsc and Jest.
- **Server actions are reachable by action id and are NOT protected by the `/admin` layout.** Every action must open with `requireStaffAction()`.
- **Mobile is the primary target.** The admin Users table is `min-w-[600px]`; a control added only to the desktop row is invisible on a phone. Every control goes in both `UserRow` and `UserCard`.
- **Use `.maybeSingle()`**, not `.single()`, for any lookup that may legitimately return no row.
- **Server actions return `{ ok, error }`; they do not throw** (except `requireStaffAction`, whose rejection the client's `catch` already covers). Next.js redacts a thrown Server Action error in production into an opaque digest, so a throw cannot carry a reason to the client. **A parallel session was converting `userActions.ts` to this shape while this plan was written** — that work was not on `origin/master` yet, so this worktree still has the throwing version. Before starting Task 3, run `git fetch origin master && git log --oneline -5 origin/master` and rebase if it has landed; the new `teamActions` are written in the `{ ok, error }` shape either way, because that is independently the right shape.
- **Commit after every task.** Commit messages end with `Co-Authored-By: claude-flow <ruv@ruv.net>`.

## File Structure

**Created:**
- `supabase/migrations/084_teams.sql` — schema, RLS, seeded rosters
- `lib/teams/types.ts` — shared constants and the `Team` interface
- `lib/teams/players.ts` — the single definition of "who can be picked for a squad"
- `components/TeamBadge.tsx` — team pill, sibling to `YearBadge`
- `app/(admin)/admin/teams/page.tsx` — server page
- `app/(admin)/admin/teams/TeamRosterCard.tsx` — one team's roster + add/remove
- `app/(admin)/admin/teams/ManageTeams.tsx` — rename / reorder / add / retire
- `app/(admin)/admin/teams/teamActions.ts` — all team server actions
- `__tests__/app/admin/teamActions.test.ts`
- `__tests__/components/TeamBadge.test.tsx`
- `__tests__/lib/eligiblePlayers.test.ts`
- `__tests__/components/admin/CreateMatchFormTeamPrefill.test.tsx`

**Modified:**
- `app/(admin)/admin/users/UserFields.tsx` — add `TeamSelect`, extend `UserListItem`
- `app/(admin)/admin/users/page.tsx` — select `team_id`, add the Team column
- `app/(admin)/admin/students/[id]/StudentIdentityForm.tsx` — add the team control
- `app/(admin)/admin/match-events/page.tsx` — eligible players, pass teams
- `app/(admin)/admin/match-events/CreateMatchForm.tsx` — team picker + pre-fill
- `app/(admin)/admin/match-events/[id]/page.tsx` — eligible players (**fixes the missing `is_active` filter**)
- `app/(admin)/admin/match-events/[id]/AddPlayersLater.tsx` — group by team
- `app/(admin)/admin/formation/page.tsx` — eligible players, pass team
- `app/(admin)/admin/formation/FormationBuilder.tsx` — team-first ordering + badge
- `components/layout/MobileAdminBar.tsx` — Teams nav entry
- `components/layout/AdminSidebar.tsx` — Teams nav entry

---

### Task 1: Migration — teams table, columns, RLS, seeded rosters

**Files:**
- Create: `supabase/migrations/084_teams.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.teams(id uuid, name text, sort_order smallint, is_active boolean, created_at timestamptz)`; `public.users.team_id uuid null`; `public.match_events.team_id uuid null`.

- [ ] **Step 1: Confirm the migration number**

Run: `ls supabase/migrations/*.sql | sort | tail -1`

If the highest is `083_*`, your file is `084_teams.sql`. If something newer landed, use the next number and use that name everywhere below.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/084_teams.sql`:

```sql
-- ============================================================================
-- 084_teams.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- 2026-09-22: the club runs three standing teams — Prem, White and Blue — and
-- the app had no idea they existed. Coaches picking a match squad were shown
-- one flat list of every active student and had to remember who was in which
-- team.
--
-- Teams are a table, not an enum, so coaches can rename, reorder, add a fourth
-- or retire one without a deploy.
--
-- One team per player, enforced structurally by users.team_id being a single
-- column. team_id is NULLABLE on purpose: new joiners, trialists and injured
-- players legitimately have no team, and a NOT NULL default would repeat the
-- bug that made every Year 2 joiner silently a Year 1 (see updateUserYearGroup).
--
-- Membership is ROLE-AGNOSTIC. Joseph Barton ("Joseph B") is a coach who plays
-- and is on the Prem sheet; the squad pickers used to hard-filter
-- role='student', so he could never be picked. Having a team is now what makes
-- someone pickable.
--
-- Idempotent: safe to re-run. The seed only fills a NULL team_id, so it can
-- never stamp over a coach's later reassignment.
--
-- NOTE FOR MIGRATION REPLAY: the seed is an UPDATE against hardcoded production
-- user ids. On a blank database it matches zero rows and succeeds. Do NOT turn
-- it into an INSERT referencing those ids — that is what broke replay at 054.
-- ============================================================================

create table if not exists public.teams (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

-- Two ACTIVE teams cannot share a name; a retired team's name is reusable.
create unique index if not exists teams_name_active_idx
  on public.teams (lower(name)) where is_active;

alter table public.users
  add column if not exists team_id uuid references public.teams(id) on delete set null;

-- ON DELETE SET NULL, never cascade: deleting a team must not delete players.
alter table public.match_events
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists users_team_id_idx on public.users (team_id);
create index if not exists match_events_team_id_idx on public.match_events (team_id);

alter table public.teams enable row level security;

drop policy if exists "staff manage teams" on public.teams;
create policy "staff manage teams" on public.teams
  for all using (public.is_staff()) with check (public.is_staff());

-- Students and parents read team names to render a badge.
drop policy if exists "authenticated read teams" on public.teams;
create policy "authenticated read teams" on public.teams
  for select using (auth.uid() is not null);

-- ── Seed the three teams ────────────────────────────────────────────────────
insert into public.teams (name, sort_order)
select v.name, v.sort_order
from (values ('Prem', 0::smallint), ('White', 1::smallint), ('Blue', 2::smallint)) as v(name, sort_order)
where not exists (
  select 1 from public.teams t where lower(t.name) = lower(v.name) and t.is_active
);

-- ── Seed the rosters ────────────────────────────────────────────────────────
-- Transcribed from "College Squad Lists 2026/27" and matched to user ids.
-- Seeded by id, not name: three of the 46 names were spelled differently on
-- the sheet than in the app (Robert Ewan Duncan/Ewan Duncan, Ollie/Oliver
-- Piercy, Seb Macauley/Sebastian MacAulay).

update public.users u set team_id = t.id
from public.teams t
where t.name = 'Prem' and t.is_active and u.team_id is null and u.id in (
  'afc86107-fac9-475a-9053-aa28349c48c4',  -- Alfie Casey
  'c4bc75d1-6ad1-40a1-985c-8df3f1c1efa2',  -- Beau Edwards
  '8e230c3a-a84e-426f-a176-42d310d5f14e',  -- Caleb McWilliam
  'a2763c60-0723-4f6d-994b-4854d64fc17a',  -- Dylan Bullock
  'cafc6fe4-5b52-4c44-9ade-7b2528b0df85',  -- Ewan Duncan  (sheet: Robert Ewan Duncan)
  '047d8c7e-1d0f-4e45-bd2d-0536ab70de5c',  -- Harris McIntosh
  'f80f8bce-0bfb-4ff6-a1ce-d6a8d41d42ab',  -- Isaac Kennedy
  '11e25b83-836d-41a3-bea3-d4fa957886bb',  -- Jacob Garnett
  'a62b3cca-1e86-48d9-b6d2-e20f296e2778',  -- James Lowther
  'd1d02a54-c57f-4378-ad47-9f32f3d7ea97',  -- Joseph B  (role=coach, plays)
  '4c5e96ff-c049-4877-8503-ff15d4f4d2f6',  -- Liam Blake
  '480f184e-787b-4060-bb49-bad5de8c68e2',  -- Luke Proudlove
  'b9f2d1c2-f5a7-4d2b-aefe-1c4ccff32f4b',  -- Mark Omolade
  '2548cc77-2613-4bd8-8098-a02f6e38a19c',  -- Naod Tewolde
  'bda87bcb-e464-4609-9bf6-8ca9406169a2',  -- Oliver Piercy  (sheet: Ollie Piercy)
  '45cc5a52-323a-48ae-b294-09851f5818a9',  -- Preston Cleator
  'faf65055-e936-47b7-a071-953781e29883'   -- Sebastian MacAulay  (sheet: Seb Macauley)
);

update public.users u set team_id = t.id
from public.teams t
where t.name = 'Blue' and t.is_active and u.team_id is null and u.id in (
  'd225c75b-e8cf-4540-aae8-8f769622cfd0',  -- Lewis Boden
  '583f1126-4a09-4167-8884-099ceca42049',  -- Ollie Carson
  '6e6ab73c-2456-4edb-9b99-a8f453f9c38f',  -- Marcus Dos Santos
  'd22c1bde-74df-4605-be88-cbba2f93c24e',  -- Jonah Jones
  '6670952c-2fab-4985-8ef7-9332ee0066aa',  -- Kieron Murphy
  'cfc49190-63f4-4c3c-bff8-12270481b3c6',  -- Samuel Nash
  'c5929870-2aaf-4d33-8ddf-6972b16f436d',  -- Joshua Upton
  'a74e43f2-9306-4734-93f8-b15147c25371',  -- Jack Brindley
  '6c329cad-8fba-4444-9532-78f82101f965',  -- Lewis Dooley
  '7ed45be5-c91a-4ff9-9f76-5f74a8fba7e0',  -- Lewis Cubbins
  '91161e9e-1a74-47f4-b5a5-feaa613251ad',  -- Jamie Cunningham
  '97b1c970-6efa-47ed-b8bb-f11d85bfeb6a',  -- Troy Lockyer
  '6abd15d0-5516-449d-8828-042038994d96',  -- Tinashe Makoni
  'e4e6a7b5-a0cc-4356-93d1-292fac1b3a2b'   -- Javan Moussa
);

update public.users u set team_id = t.id
from public.teams t
where t.name = 'White' and t.is_active and u.team_id is null and u.id in (
  '658f875a-6ae1-47e0-94ff-897e54c40a89',  -- Kenneth Chimhuva
  '9bbae31b-1c40-4ff4-b12c-07929e1a1246',  -- Liam Gray
  '3fa12548-d7ab-40b7-878b-833f4b3cbeba',  -- Charlie Lawler
  'a73f12e9-5ffc-4957-b4eb-9909ec11e35d',  -- Kaelin Owen
  '83d1bd61-d986-41ff-9350-db2ab9031d56',  -- Caspar Quilty
  '6c9905de-5192-4a24-99e7-b3330e239a6d',  -- Mason Smith
  '53f42d8a-435b-4fa1-9345-8c770e8c360d',  -- Joshua Williams
  'cc9c1bf1-aa70-4c7a-bb73-b2d5d73491b8',  -- Jeff Osazuwa
  '3a0159bd-3529-4dbf-9b1e-b43eabdbbd0c',  -- Lamin Manjang
  '08599ebd-0c91-4261-a39e-f6ddb4c380e8',  -- Leighton Kelly
  'd71490c1-352b-43cc-b767-3cd7f163b7b2',  -- Aidan O'Brien
  'd02194d1-531f-4970-ae4e-481e6dc85a56',  -- Max Roberts
  '7ff08fac-3e27-48a1-9d67-c6f1f8ea09d8',  -- Jack Roddick
  '7cac9bc1-8e6a-4752-9440-0628590de88f',  -- Oliver Wilson
  'c4fbdc77-b75f-4522-b7b7-d0879d1ed1b2'   -- Jayden McAuley
);
```

- [ ] **Step 3: Verify it replays against a blank database**

Run: `bash scripts/migration-replay/replay.sh`

Expected: all migrations apply, including `084`. The three `UPDATE` statements match zero rows on a blank DB — that is correct, not a failure.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/084_teams.sql
git commit -m "$(cat <<'EOF'
feat(db): teams table, team_id columns, and the seeded Prem/White/Blue rosters

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

- [ ] **Step 5: Apply to production and verify the counts**

Apply `084_teams.sql` in the Supabase SQL editor, then run:

```sql
select t.name, count(u.id) as players
from public.teams t left join public.users u on u.team_id = t.id
group by t.name order by t.sort_order;
```

Expected exactly: **Prem 17, White 15, Blue 14**. If any count is off, stop and reconcile before continuing — every later task assumes this data.

---

### Task 2: Shared types, the eligibility rule, and TeamBadge

**Files:**
- Create: `lib/teams/types.ts`, `lib/teams/players.ts`, `components/TeamBadge.tsx`
- Test: `__tests__/components/TeamBadge.test.tsx`, `__tests__/lib/eligiblePlayers.test.ts`

**Interfaces:**
- Consumes: the `teams` table from Task 1.
- Produces:
  - `TEAM_NAME_MAX: number` (40)
  - `interface Team { id: string; name: string; sort_order: number; is_active: boolean }`
  - `interface TeamRef { id: string; name: string }`
  - `eligiblePlayers(supabase, columns: string)` → a Supabase query builder
  - `<TeamBadge team={TeamRef | null | undefined} className?: string />`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/eligiblePlayers.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { eligiblePlayers, ELIGIBLE_PLAYER_FILTER } from '@/lib/teams/players'

function fakeSupabase() {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, (...a: unknown[]) => unknown> = {}
  for (const m of ['select', 'eq', 'or', 'order']) {
    builder[m] = (...args: unknown[]) => {
      calls[m] = args
      return builder
    }
  }
  return { client: { from: (t: string) => { calls.from = [t]; return builder } }, calls }
}

describe('eligiblePlayers', () => {
  it('reads from users, only active rows, ordered by name', () => {
    const { client, calls } = fakeSupabase()
    eligiblePlayers(client as never, 'id, name')
    expect(calls.from).toEqual(['users'])
    expect(calls.select).toEqual(['id, name'])
    expect(calls.eq).toEqual(['is_active', true])
    expect(calls.order).toEqual(['name'])
  })

  it('includes students and anyone with a team, so a coach who plays is pickable', () => {
    const { client, calls } = fakeSupabase()
    eligiblePlayers(client as never, 'id')
    expect(calls.or).toEqual([ELIGIBLE_PLAYER_FILTER])
    expect(ELIGIBLE_PLAYER_FILTER).toBe('role.eq.student,team_id.not.is.null')
  })
})
```

Create `__tests__/components/TeamBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { TeamBadge } from '@/components/TeamBadge'

describe('TeamBadge', () => {
  it('renders the team name', () => {
    render(<TeamBadge team={{ id: 'a1', name: 'Prem' }} />)
    expect(screen.getByText('Prem')).toBeInTheDocument()
  })

  it('renders nothing when the player has no team', () => {
    const { container } = render(<TeamBadge team={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('gives the same team the same colour every time', () => {
    const { container: a } = render(<TeamBadge team={{ id: 'a1', name: 'Prem' }} />)
    const { container: b } = render(<TeamBadge team={{ id: 'a1', name: 'Renamed' }} />)
    expect(a.firstElementChild?.className).toBe(b.firstElementChild?.className)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lib/eligiblePlayers.test.ts __tests__/components/TeamBadge.test.tsx`
Expected: FAIL — `Cannot find module '@/lib/teams/players'` and `'@/components/TeamBadge'`.

- [ ] **Step 3: Write `lib/teams/types.ts`**

```ts
/**
 * Shared team constants and types.
 *
 * These live outside app/(admin)/admin/teams/teamActions.ts because that file
 * is `'use server'`, and a server-action module may only export async
 * functions — exporting a plain const from it fails the webpack build (tsc and
 * Jest both pass, so the build is the only thing that catches it).
 */

/**
 * teams.name is plain `text` with no DB limit, so this cap is the app's own.
 * The input carries the same maxLength and the server re-checks it — an
 * over-long name is REJECTED rather than silently truncated, which is the
 * failure mode that bit the chat and folder name fields (2026-09-14 sweep).
 */
export const TEAM_NAME_MAX = 40

export interface Team {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

/** The shape a joined `teams(id, name)` select returns. */
export interface TeamRef {
  id: string
  name: string
}
```

- [ ] **Step 4: Write `lib/teams/players.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who can be picked for a match squad — defined once, here.
 *
 * This used to be `role = 'student'`, repeated in three page files. That
 * silently excluded a coach who plays (Joseph Barton, Prem), who could
 * therefore never be added to a squad at all. match_squads.player_id is a
 * plain FK to users with no role constraint, so the database was never the
 * obstacle — only those three queries were.
 *
 * Team membership is the opt-in: anyone in a team is pickable, so no teamless
 * staff member leaks into a picker.
 */
export const ELIGIBLE_PLAYER_FILTER = 'role.eq.student,team_id.not.is.null'

/**
 * `columns` is passed through to .select() so each caller can ask for only
 * what it renders. Always filters is_active — one of the three original
 * queries did not, so deactivated students still appeared in the "Add players
 * later" picker.
 */
export function eligiblePlayers(supabase: SupabaseClient, columns: string) {
  return supabase
    .from('users')
    .select(columns)
    .eq('is_active', true)
    .or(ELIGIBLE_PLAYER_FILTER)
    .order('name')
}
```

- [ ] **Step 5: Write `components/TeamBadge.tsx`**

```tsx
import type { TeamRef } from '@/lib/teams/types'

/**
 * Small pill naming a player's team, sibling to YearBadge.
 *
 * Colour is derived from the team id rather than its name, so renaming a team
 * keeps its colour and a newly added fourth team gets a distinct one without
 * anybody editing a hardcoded map.
 */

const PALETTE = [
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
]

function paletteFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

type Props = {
  team: TeamRef | null | undefined
  className?: string
}

export function TeamBadge({ team, className = '' }: Props) {
  if (!team) return null
  return (
    <span
      title={`${team.name} team`}
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 ${paletteFor(team.id)} ${className}`}
    >
      {team.name}
    </span>
  )
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest __tests__/lib/eligiblePlayers.test.ts __tests__/components/TeamBadge.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/teams/ components/TeamBadge.tsx __tests__/lib/eligiblePlayers.test.ts __tests__/components/TeamBadge.test.tsx
git commit -m "$(cat <<'EOF'
feat(teams): shared types, the squad-eligibility rule, and TeamBadge

Eligibility is defined once in lib/teams/players.ts rather than as
role='student' repeated across three page files — that repetition is what
kept a coach who plays out of every squad picker.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 3: Team server actions

**Files:**
- Create: `app/(admin)/admin/teams/teamActions.ts`
- Test: `__tests__/app/admin/teamActions.test.ts`

**Interfaces:**
- Consumes: `TEAM_NAME_MAX` and `ActionResult` from `lib/teams/types`.
- Produces, all `async`, all returning `ActionResult` rather than throwing:
  - `setUserTeam(userId: string, teamId: string | null): Promise<ActionResult>`
  - `setUsersTeam(userIds: string[], teamId: string | null): Promise<ActionResult>`
  - `createTeam(name: string): Promise<ActionResult>`
  - `renameTeam(teamId: string, name: string): Promise<ActionResult>`
  - `reorderTeams(orderedIds: string[]): Promise<ActionResult>`
  - `setTeamActive(teamId: string, active: boolean): Promise<ActionResult>`

First add `ActionResult` to `lib/teams/types.ts` (created in Task 2):

```ts
/**
 * What every team server action returns.
 *
 * Actions do not throw: Next.js redacts a thrown Server Action error in
 * production into an opaque digest, so the reason never reaches the client and
 * every failure collapses into a generic "Not saved". A returned error
 * survives. Only requireStaffAction still throws — an unauthorised caller is
 * not a user-correctable condition.
 *
 * If userActions.ts's identical ActionResult moves somewhere shared, collapse
 * these two into one.
 */
export type ActionResult = { ok: boolean; error?: string }
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/admin/teamActions.test.ts`:

```ts
/**
 * @jest-environment node
 */
const requireStaffActionMock = jest.fn()
const updateEqMock = jest.fn(async () => ({ error: null }))
const updateInMock = jest.fn(async () => ({ error: null }))
const updateMock = jest.fn(() => ({ eq: updateEqMock, in: updateInMock }))
const insertMock = jest.fn(async () => ({ error: null }))

jest.mock('@/lib/auth/requireRole', () => ({
  requireStaffAction: () => requireStaffActionMock(),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  setUserTeam,
  setUsersTeam,
  createTeam,
  renameTeam,
  setTeamActive,
} from '@/app/(admin)/admin/teams/teamActions'
import { TEAM_NAME_MAX } from '@/lib/teams/types'

function ctx() {
  return {
    role: 'coach',
    user: { id: 'me' },
    admin: { from: () => ({ update: updateMock, insert: insertMock }) },
  }
}

describe('team server actions', () => {
  beforeEach(() => {
    requireStaffActionMock.mockReset()
    updateMock.mockClear()
    insertMock.mockClear()
    requireStaffActionMock.mockResolvedValue(ctx())
  })

  it('refuses a caller who is not staff, and writes nothing', async () => {
    requireStaffActionMock.mockRejectedValue(new Error('Unauthorised'))
    await expect(setUserTeam('u1', 't1')).rejects.toThrow('Unauthorised')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('assigns a team to a user', async () => {
    await setUserTeam('u1', 't1')
    expect(updateMock).toHaveBeenCalledWith({ team_id: 't1' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'u1')
  })

  it('unassigns with null rather than an empty string', async () => {
    await setUserTeam('u1', null)
    expect(updateMock).toHaveBeenCalledWith({ team_id: null })
  })

  // Deliberately unlike updateUserYearGroup, which rejects non-students.
  // Joseph Barton is a coach who plays and is on the Prem sheet.
  it('allows a non-student to be put in a team', async () => {
    await setUserTeam('coach-1', 't1')
    expect(updateMock).toHaveBeenCalledWith({ team_id: 't1' })
  })

  it('assigns several users in one write', async () => {
    await setUsersTeam(['u1', 'u2'], 't1')
    expect(updateMock).toHaveBeenCalledWith({ team_id: 't1' })
    expect(updateInMock).toHaveBeenCalledWith('id', ['u1', 'u2'])
  })

  it('does nothing when given an empty user list', async () => {
    await setUsersTeam([], 't1')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('trims a new team name', async () => {
    await expect(createTeam('  Reserves  ')).resolves.toEqual({ ok: true })
    expect(insertMock).toHaveBeenCalledWith({ name: 'Reserves', sort_order: 0 })
  })

  // Returned, not thrown: a thrown Server Action error is redacted in
  // production, so the reason would never reach the coach.
  it('rejects an empty team name with a reason the client can show', async () => {
    const result = await createTeam('   ')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty/i)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects an over-long name rather than truncating it', async () => {
    const result = await createTeam('x'.repeat(TEAM_NAME_MAX + 1))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/longer/i)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('applies the same name rules to a rename', async () => {
    const result = await renameTeam('t1', '')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty/i)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('surfaces a database error rather than reporting success', async () => {
    updateEqMock.mockResolvedValueOnce({ error: { message: 'permission denied' } })
    const result = await setUserTeam('u1', 't1')
    expect(result).toEqual({ ok: false, error: 'permission denied' })
  })

  it('retires a team without touching its players', async () => {
    await setTeamActive('t1', false)
    expect(updateMock).toHaveBeenCalledWith({ is_active: false })
    expect(updateMock).not.toHaveBeenCalledWith({ team_id: null })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/app/admin/teamActions.test.ts`
Expected: FAIL — `Cannot find module '@/app/(admin)/admin/teams/teamActions'`.

- [ ] **Step 3: Write `app/(admin)/admin/teams/teamActions.ts`**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { requireStaffAction } from '@/lib/auth/requireRole'
import { TEAM_NAME_MAX, type ActionResult } from '@/lib/teams/types'

/**
 * Server actions behind the Teams page.
 *
 * These run with the service-role client, which bypasses RLS entirely, and a
 * Next.js server action is reachable by anyone who has the action id from the
 * client bundle — it is NOT implicitly protected by the /admin layout. So each
 * one verifies the caller itself, per the contract in lib/auth/requireRole.ts.
 */

function revalidate() {
  revalidatePath('/admin/teams')
  revalidatePath('/admin/users')
  revalidatePath('/admin/match-events')
}

/** Returns the cleaned name, or the reason it is unusable. */
function cleanName(name: string): { name: string } | { error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Team name cannot be empty' }
  if (trimmed.length > TEAM_NAME_MAX) {
    return { error: `Team name cannot be longer than ${TEAM_NAME_MAX} characters` }
  }
  return { name: trimmed }
}

/**
 * Puts one user in a team, or takes them out of one with null.
 *
 * Unlike updateUserYearGroup, this does NOT require the target to be a
 * student. Joseph Barton is a coach who plays and is on the Prem sheet, and
 * team membership is what makes someone pickable for a squad — so refusing
 * non-students here would defeat the point.
 *
 * Assignment replaces: users.team_id holds one value, so there is no state in
 * which a player accumulates two teams.
 */
export async function setUserTeam(userId: string, teamId: string | null): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const { error } = await admin.from('users').update({ team_id: teamId }).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

/** Bulk form of setUserTeam, for the Add players flow. */
export async function setUsersTeam(userIds: string[], teamId: string | null): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  if (userIds.length === 0) return { ok: true }
  const { error } = await admin.from('users').update({ team_id: teamId }).in('id', userIds)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function createTeam(name: string): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const clean = cleanName(name)
  if ('error' in clean) return { ok: false, error: clean.error }

  const { error } = await admin.from('teams').insert({ name: clean.name, sort_order: 0 })
  // The partial unique index is the backstop against two coaches adding the
  // same team at once, so a race surfaces here as a reported error rather
  // than a duplicate row.
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function renameTeam(teamId: string, name: string): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const clean = cleanName(name)
  if ('error' in clean) return { ok: false, error: clean.error }

  const { error } = await admin.from('teams').update({ name: clean.name }).eq('id', teamId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function reorderTeams(orderedIds: string[]): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await admin.from('teams').update({ sort_order: i }).eq('id', orderedIds[i])
    if (error) return { ok: false, error: error.message }
  }
  revalidate()
  return { ok: true }
}

/**
 * Retires or restores a team.
 *
 * Retiring deliberately leaves players' team_id alone, so restoring brings the
 * whole roster back. A player whose team is retired is treated as unassigned
 * everywhere a picker asks for active teams.
 */
export async function setTeamActive(teamId: string, active: boolean): Promise<ActionResult> {
  const { admin } = await requireStaffAction()
  const { error } = await admin.from('teams').update({ is_active: active }).eq('id', teamId)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}
```

Note `cleanName` is checked before any write, which is what makes the "writes nothing" assertions pass.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/admin/teamActions.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/teams/teamActions.ts" __tests__/app/admin/teamActions.test.ts
git commit -m "$(cat <<'EOF'
feat(teams): staff-guarded server actions for team membership and management

setUserTeam deliberately accepts any role, unlike updateUserYearGroup —
a coach who plays needs a team, and having one is what makes a person
pickable for a squad.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 4: The `/admin/teams` page

**Files:**
- Create: `app/(admin)/admin/teams/page.tsx`, `app/(admin)/admin/teams/TeamRosterCard.tsx`, `app/(admin)/admin/teams/ManageTeams.tsx`
- Modify: `components/layout/MobileAdminBar.tsx`, `components/layout/AdminSidebar.tsx`

**Interfaces:**
- Consumes: every action from Task 3; `TeamBadge` and `Team`/`TeamRef` from Task 2.
- Produces: the route `/admin/teams`.

- [ ] **Step 1: Write the server page**

Create `app/(admin)/admin/teams/page.tsx`:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { TeamRosterCard } from './TeamRosterCard'
import { ManageTeams } from './ManageTeams'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Team } from '@/lib/teams/types'

export const dynamic = 'force-dynamic'

/** A person who can be in a team: every active student, plus active staff. */
type Member = { id: string; name: string; role: string; year_group: number | null; team_id: string | null }

export default async function TeamsPage() {
  const supabase = createAdminClient()

  const [{ data: teams }, { data: people }] = await Promise.all([
    supabase.from('teams').select('id, name, sort_order, is_active')
      .eq('is_active', true).order('sort_order'),
    supabase.from('users').select('id, name, role, year_group, team_id')
      .eq('is_active', true).neq('role', 'parent').order('name'),
  ])

  const activeTeams = (teams ?? []) as Team[]
  const activeTeamIds = new Set(activeTeams.map(t => t.id))
  const members = (people ?? []) as Member[]

  // A player whose team has been retired counts as unassigned here, so they
  // resurface rather than disappearing into a team nobody can see.
  const unassigned = members.filter(m => !m.team_id || !activeTeamIds.has(m.team_id))

  return (
    <div className="space-y-5">
      <Link href="/admin/home" className="inline-flex items-center gap-1 text-sm text-tranmere-blue hover:underline">
        <ArrowLeft size={14} /> Back
      </Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-tranmere-blue">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Move players between teams. A match squad is picked from a team.
        </p>
      </div>

      {unassigned.length > 0 && (
        <TeamRosterCard
          team={null}
          roster={unassigned}
          teams={activeTeams}
          candidates={[]}
        />
      )}

      {activeTeams.map(team => (
        <TeamRosterCard
          key={team.id}
          team={team}
          roster={members.filter(m => m.team_id === team.id)}
          teams={activeTeams}
          candidates={members.filter(m => m.team_id !== team.id)}
        />
      ))}

      <ManageTeams teams={activeTeams} />
    </div>
  )
}
```

- [ ] **Step 2: Write the roster card**

Create `app/(admin)/admin/teams/TeamRosterCard.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { UserPlus, X, AlertCircle } from 'lucide-react'
import { setUserTeam, setUsersTeam } from './teamActions'
import { TeamBadge } from '@/components/TeamBadge'
import { YearBadge } from '@/components/YearBadge'
import type { Team, ActionResult } from '@/lib/teams/types'

type Member = { id: string; name: string; role: string; year_group: number | null; team_id: string | null }

/**
 * One team's roster, or the Unassigned bucket when `team` is null.
 *
 * The Unassigned card leads the page and disappears once it is empty — it is
 * the only thing that stops a player who is in no team being quietly
 * forgotten, which is the main adoption risk of making team_id nullable.
 */
export function TeamRosterCard({
  team, roster, teams, candidates,
}: {
  team: Team | null
  roster: Member[]
  teams: Team[]
  candidates: Member[]
}) {
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const byId = new Map(teams.map(t => [t.id, t]))

  /**
   * Actions report a reason via {ok, error}; the catch is only for the
   * request itself failing (offline, a 5xx, a deploy landing mid-call), which
   * rejects rather than returning.
   */
  function run(fn: () => Promise<ActionResult>) {
    setError(null)
    start(async () => {
      try {
        const result = await fn()
        if (!result.ok) setError(result.error ?? 'Not saved — try again')
      } catch {
        setError('Not saved — try again')
      }
    })
  }

  function toggle(id: string) {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addPicked() {
    if (!team || picked.size === 0) return
    const ids = Array.from(picked)
    run(async () => {
      await setUsersTeam(ids, team.id)
      setPicked(new Set())
      setAdding(false)
    })
  }

  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-tranmere-blue flex items-center gap-2">
          {team ? team.name : 'Unassigned'}
          <span className="text-xs font-normal text-muted-foreground">{roster.length}</span>
        </h2>
        {team && (
          <button
            onClick={() => setAdding(v => !v)}
            disabled={pending}
            className="inline-flex items-center gap-1 text-xs font-semibold text-tranmere-blue disabled:opacity-60"
          >
            <UserPlus size={13} /> {adding ? 'Cancel' : 'Add players'}
          </button>
        )}
      </div>

      {!team && (
        <p className="text-xs text-muted-foreground mb-2 flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          These players are in no team, so they are not pre-picked for any match squad.
        </p>
      )}

      {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}

      {roster.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">No players yet</p>
      ) : (
        <ul className="space-y-1">
          {roster.map(m => (
            <li key={m.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-50">
              <span className="flex-1 min-w-0 text-sm truncate">{m.name}</span>
              {m.role === 'student'
                ? <YearBadge year={m.year_group} />
                : <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>}
              {team ? (
                <button
                  onClick={() => run(() => setUserTeam(m.id, null))}
                  disabled={pending}
                  aria-label={`Remove ${m.name} from ${team.name}`}
                  className="p-1 rounded text-gray-400 hover:text-red-600 disabled:opacity-60"
                >
                  <X size={14} />
                </button>
              ) : (
                <select
                  aria-label={`Team for ${m.name}`}
                  defaultValue=""
                  disabled={pending}
                  onChange={e => e.target.value && run(() => setUserTeam(m.id, e.target.value))}
                  className="text-xs border rounded px-1 py-0.5 bg-white disabled:opacity-60"
                >
                  <option value="">Place in…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && team && (
        <div className="mt-3 border-t pt-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
            Add to {team.name} — their current team is shown, so this moves them
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto">
            {candidates.map(c => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-1.5 p-2 rounded-lg border text-left text-sm ${
                  picked.has(c.id) ? 'border-tranmere-blue bg-blue-50 font-semibold' : 'border-gray-200'
                }`}
              >
                <span className="flex-1 min-w-0 truncate">{c.name}</span>
                <TeamBadge team={c.team_id ? byId.get(c.team_id) ?? null : null} />
              </button>
            ))}
          </div>
          <button
            onClick={addPicked}
            disabled={pending || picked.size === 0}
            className="mt-2 w-full rounded-xl bg-tranmere-blue text-white py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {pending ? 'Saving…' : `Move ${picked.size} to ${team.name}`}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the manage-teams card**

Create `app/(admin)/admin/teams/ManageTeams.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Plus, Archive, ChevronUp, ChevronDown } from 'lucide-react'
import { createTeam, renameTeam, setTeamActive, reorderTeams } from './teamActions'
import { TEAM_NAME_MAX, type Team, type ActionResult } from '@/lib/teams/types'

/** Returns the team ids with the one at `from` moved to `to`. */
function move(teams: Team[], from: number, to: number): string[] {
  const ids = teams.map(t => t.id)
  const [moved] = ids.splice(from, 1)
  ids.splice(to, 0, moved)
  return ids
}

export function ManageTeams({ teams }: { teams: Team[] }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  /** Same contract as TeamRosterCard's: {ok, error} for a refusal, catch for transport. */
  function run(fn: () => Promise<ActionResult>) {
    setError(null)
    start(async () => {
      try {
        const result = await fn()
        if (!result.ok) setError(result.error ?? 'Not saved — try again')
      } catch {
        setError('Not saved — try again')
      }
    })
  }

  return (
    <div className="rounded-2xl border bg-white p-3">
      <h2 className="text-sm font-semibold text-tranmere-blue mb-2">Manage teams</h2>
      {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}

      <ul className="space-y-1 mb-3">
        {teams.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2">
            <input
              aria-label={`Rename ${t.name}`}
              defaultValue={t.name}
              maxLength={TEAM_NAME_MAX}
              disabled={pending}
              onBlur={e => {
                const next = e.target.value.trim()
                if (next && next !== t.name) run(() => renameTeam(t.id, next))
              }}
              className="flex-1 min-w-0 text-sm border rounded px-2 py-1.5 disabled:opacity-60"
            />
            {/* Up/down rather than drag: this page is used on a phone, where
                dragging a list item fights the page scroll. */}
            <button
              onClick={() => run(() => reorderTeams(move(teams, i, i - 1)))}
              disabled={pending || i === 0}
              aria-label={`Move ${t.name} up`}
              className="p-1.5 rounded text-gray-400 hover:text-tranmere-blue disabled:opacity-30"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => run(() => reorderTeams(move(teams, i, i + 1)))}
              disabled={pending || i === teams.length - 1}
              aria-label={`Move ${t.name} down`}
              className="p-1.5 rounded text-gray-400 hover:text-tranmere-blue disabled:opacity-30"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Retire ${t.name}? Its players become unassigned until it is restored.`)) {
                  run(() => setTeamActive(t.id, false))
                }
              }}
              disabled={pending}
              aria-label={`Retire ${t.name}`}
              className="p-2 rounded text-gray-400 hover:text-red-600 disabled:opacity-60"
            >
              <Archive size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t pt-3">
        <input
          aria-label="New team name"
          value={newName}
          maxLength={TEAM_NAME_MAX}
          disabled={pending}
          onChange={e => setNewName(e.target.value)}
          placeholder="New team name"
          className="flex-1 min-w-0 text-sm border rounded px-2 py-1.5 disabled:opacity-60"
        />
        <button
          onClick={() => run(async () => { await createTeam(newName); setNewName('') })}
          disabled={pending || !newName.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-tranmere-blue text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the nav entries**

In `components/layout/MobileAdminBar.tsx`, add `Shirt` to the `lucide-react` import and insert into the `nav` array immediately after the Formation entry:

```tsx
  { href: '/admin/teams', label: 'Teams', icon: Shirt, teacherHidden: true },
```

Do the same in `components/layout/AdminSidebar.tsx` — open it, find its nav array, and add the identical entry in the matching position. Teams is a coaching concern, so `teacherHidden: true`, like Formation and Match Squads.

- [ ] **Step 5: Verify it builds and renders**

Run: `npm run build`
Expected: PASS, with `/admin/teams` listed in the route output.

Then start the preview and check the page at phone width:

1. `preview_start` with the dev-server config
2. Navigate to `/admin/teams`
3. `resize_window` to the `mobile` preset (375px)
4. `read_page` and confirm: the Unassigned card appears first, each team card shows its count, and "Add players" is reachable without horizontal scrolling.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/teams/" components/layout/MobileAdminBar.tsx components/layout/AdminSidebar.tsx
git commit -m "$(cat <<'EOF'
feat(teams): /admin/teams page with an Unassigned bucket leading it

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 5: Team control on the Users list and student detail

**Files:**
- Modify: `app/(admin)/admin/users/UserFields.tsx`, `app/(admin)/admin/users/page.tsx`, `app/(admin)/admin/students/[id]/StudentIdentityForm.tsx`

**Interfaces:**
- Consumes: `setUserTeam` (Task 3), `Team` (Task 2).
- Produces: `<TeamSelect user={UserListItem} teams={Team[]} className?: string />`; `UserListItem` gains `team_id: string | null`.

- [ ] **Step 1: Extend `UserListItem` and add `TeamSelect`**

In `app/(admin)/admin/users/UserFields.tsx`, add `team_id` to the interface:

```ts
export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  course_id: string | null
  created_at: string
  year_group: number | null
  team_id: string | null
  courses: { name: string } | null
}
```

Add the import at the top of the file:

```ts
import { setUserTeam } from '../teams/teamActions'
import type { Team } from '@/lib/teams/types'
```

And add the control beside the others, reusing the existing `useSavedSelect` hook so it gets the same optimistic-then-revert behaviour.

**Check `useSavedSelect`'s contract on your branch before writing this.** In the version this plan was written against, `save` is expected to *throw* on failure. The parallel `{ ok, error }` refactor changes it to inspect the returned result instead. If it now expects `Promise<ActionResult>`, `setUserTeam` already returns exactly that and the code below is correct as written. If it still expects a throw, wrap the call:

```ts
async next => {
  const result = await setUserTeam(user.id, next || null)
  if (!result.ok) throw new Error(result.error)
}
```

```tsx
/**
 * Which team the person plays for.
 *
 * Unlike YearGroupSelect this renders for EVERY role, not just students —
 * Joseph Barton is a coach who plays, and being in a team is what makes
 * someone pickable for a match squad.
 */
export function TeamSelect({
  user, teams, className = '',
}: {
  user: UserListItem
  teams: Team[]
  className?: string
}) {
  const { value, change, error, pending } = useSavedSelect(user.team_id ?? '', next =>
    setUserTeam(user.id, next || null)
  )
  return (
    <>
      <select
        aria-label={`Team for ${user.name}`}
        value={value}
        disabled={pending}
        onChange={e => change(e.target.value)}
        className={`text-xs border rounded px-1 py-0.5 bg-white cursor-pointer disabled:opacity-60 ${className}`}
      >
        <option value="">No team</option>
        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <FieldError message={error} />
    </>
  )
}
```

- [ ] **Step 2: Wire it into the Users page**

In `app/(admin)/admin/users/page.tsx`:

1. Add `team_id` to the users select, so line 13 reads:
   `.select('id, name, email, role, course_id, created_at, is_active, year_group, team_id, courses(name)')`
2. Add a third parallel query for active teams:
   `supabase.from('teams').select('id, name, sort_order, is_active').eq('is_active', true).order('sort_order')`
3. Add `'Team'` to the table header array, immediately after `'Year'`.
4. Render `<TeamSelect user={user} teams={teams} />` in **both** `UserRow` (a new `<td>` after the Year cell) and `UserCard`. The table is `min-w-[600px]`, so a control only in `UserRow` is invisible on a phone — that exact defect was found on 2026-09-21.

- [ ] **Step 3: Add it to the student detail page**

In `app/(admin)/admin/students/[id]/StudentIdentityForm.tsx`, add a team control alongside the existing name and year-group fields, calling `setUserTeam(userId, teamId || null)`. The page must pass down the active teams list; fetch it in the parent server component the same way the Users page does.

- [ ] **Step 4: Verify**

Run: `npm run build && npx jest`
Expected: build passes; the existing `UsersList` suite still passes.

Then check at 375px that the Team control is visible on the mobile card, not only in the desktop table.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/users/" "app/(admin)/admin/students/"
git commit -m "$(cat <<'EOF'
feat(teams): team picker on the Users list and student detail

Rendered for every role, not just students, and present in both the
desktop row and the mobile card — the table is min-w-[600px], so a
desktop-only control is invisible on a phone.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 6: Squad-picker eligibility, and the missing `is_active` filter

**Files:**
- Modify: `app/(admin)/admin/match-events/page.tsx:19`, `app/(admin)/admin/match-events/[id]/page.tsx:27`, `app/(admin)/admin/formation/page.tsx:12`

**Interfaces:**
- Consumes: `eligiblePlayers` (Task 2).
- Produces: all three pages now pass players that include `team_id` and a joined `teams(id, name)`.

- [ ] **Step 1: Replace the three queries**

Each page currently builds its own `role = 'student'` query. Replace each with `eligiblePlayers`, keeping the columns that page actually renders and adding the team join.

`app/(admin)/admin/match-events/page.tsx` — replace the students query with:

```ts
eligiblePlayers(supabase, 'id, name, year_group, role, team_id, teams(id, name)')
```

`app/(admin)/admin/match-events/[id]/page.tsx` — replace
`supabase.from('users').select('id, name').eq('role', 'student').order('name')` with:

```ts
eligiblePlayers(supabase, 'id, name, year_group, role, team_id, teams(id, name)')
```

**This is the bug fix**: that query had no `is_active` filter, so deactivated students still appeared in the "Add players later" picker. Its two siblings filtered correctly.

`app/(admin)/admin/formation/page.tsx` — replace the students query with:

```ts
eligiblePlayers(supabase, 'id, name, avatar_url, year_group, role, team_id, teams(id, name)')
```

Add `import { eligiblePlayers } from '@/lib/teams/players'` to each file, and widen each page's local `Student`/player type to carry `role: string`, `team_id: string | null` and `teams: TeamRef | null`.

- [ ] **Step 2: Verify the deactivated-student fix by hand**

Run this against production to get a deactivated student's name:

```sql
select id, name from public.users where role='student' and is_active = false limit 1;
```

Open a match detail page, expand "Add players later", and confirm that name is **not** in the list. Before this task it was.

- [ ] **Step 3: Verify**

Run: `npm run build && npx jest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/match-events/page.tsx" "app/(admin)/admin/match-events/[id]/page.tsx" "app/(admin)/admin/formation/page.tsx"
git commit -m "$(cat <<'EOF'
fix(admin): one definition of who can be picked for a squad

All three pickers hard-filtered role='student', which kept a coach who
plays out of every squad. They now use eligiblePlayers(): active, and
either a student or someone with a team.

Also fixes a live bug this replaces — the match-detail query had no
is_active filter, so deactivated students still appeared in the "Add
players later" picker. Same defect class as the three-wave sweep of
2026-09-11; this is an instance that sweep missed.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 7: Create-match team picker and pre-fill

**Files:**
- Modify: `app/(admin)/admin/match-events/CreateMatchForm.tsx`, `app/(admin)/admin/match-events/page.tsx`
- Test: `__tests__/components/admin/CreateMatchFormTeamPrefill.test.tsx`

**Interfaces:**
- Consumes: players with `team_id` (Task 6), `Team` and `TeamBadge` (Task 2).
- Produces: `match_events` rows carrying `team_id`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/admin/CreateMatchFormTeamPrefill.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateMatchForm } from '@/app/(admin)/admin/match-events/CreateMatchForm'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

const TEAMS = [
  { id: 't-prem', name: 'Prem', sort_order: 0, is_active: true },
  { id: 't-blue', name: 'Blue', sort_order: 2, is_active: true },
]
const STUDENTS = [
  { id: 'p1', name: 'Alfie Casey', year_group: 2, role: 'student', team_id: 't-prem', teams: { id: 't-prem', name: 'Prem' } },
  { id: 'p2', name: 'Lewis Boden', year_group: 1, role: 'student', team_id: 't-blue', teams: { id: 't-blue', name: 'Blue' } },
  { id: 'p3', name: 'Khalid Eletu', year_group: 2, role: 'student', team_id: null, teams: null },
]

function setup() {
  render(<CreateMatchForm students={STUDENTS as never} teams={TEAMS as never} coachId="c1" />)
}

describe('CreateMatchForm team pre-fill', () => {
  it('pre-ticks exactly the chosen team, and nobody else', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/team/i), { target: { value: 't-prem' } })
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('false')
    expect((screen.getByRole('button', { name: /Khalid Eletu/ })).getAttribute('aria-pressed')).toBe('false')
  })

  it('clears the selection when the team is unset', () => {
    setup()
    const picker = screen.getByLabelText(/team/i)
    fireEvent.change(picker, { target: { value: 't-prem' } })
    fireEvent.change(picker, { target: { value: '' } })
    expect((screen.getByRole('button', { name: /Alfie Casey/ })).getAttribute('aria-pressed')).toBe('false')
  })

  it('still lets a player from another team be called up', () => {
    setup()
    fireEvent.change(screen.getByLabelText(/team/i), { target: { value: 't-prem' } })
    fireEvent.click(screen.getByRole('button', { name: /Lewis Boden/ }))
    expect((screen.getByRole('button', { name: /Lewis Boden/ })).getAttribute('aria-pressed')).toBe('true')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/components/admin/CreateMatchFormTeamPrefill.test.tsx`
Expected: FAIL — `CreateMatchForm` does not accept a `teams` prop and has no team control.

- [ ] **Step 3: Implement**

In `app/(admin)/admin/match-events/page.tsx`, fetch active teams and pass them to `CreateMatchForm`.

In `CreateMatchForm.tsx`:

1. Widen `Props` to accept `teams: Team[]`, and widen the student type to carry `role`, `team_id` and `teams`.
2. Add state: `const [teamId, setTeamId] = useState<string>('')`.
3. Add the picker above the student grid:

```tsx
<div>
  <label htmlFor="match-team" className="text-xs font-medium text-muted-foreground">Team</label>
  <select
    id="match-team"
    value={teamId}
    onChange={e => pickTeam(e.target.value)}
    className="w-full text-sm border rounded-lg px-3 py-2 bg-white mt-1"
  >
    <option value="">No team · pick players manually</option>
    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
  </select>
</div>
```

4. Add the pre-fill, guarding against wiping manual work:

```tsx
function pickTeam(next: string) {
  const manual = selected.size > 0 && teamId === ''
  if (manual && next && !confirm('Replace the players you have picked with the whole team?')) return
  setTeamId(next)
  setSelected(next ? new Set(students.filter(s => s.team_id === next).map(s => s.id)) : new Set())
}
```

5. Include `team_id: teamId || null` in the `match_events` insert `row`.
6. Split the grid into two sections — the chosen team's players (expanded) and **Other players** (a `<details>` element, collapsed) — and give every player button `aria-pressed={selected.has(s.id)}` and an accessible name containing the player's name, so the tests above can read the toggle state. Show `<TeamBadge team={s.teams} />` on each button in the Other players section.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/components/admin/CreateMatchFormTeamPrefill.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/match-events/" __tests__/components/admin/CreateMatchFormTeamPrefill.test.tsx
git commit -m "$(cat <<'EOF'
feat(matches): pick a team when creating a match and pre-fill its squad

The coach's job becomes unticking who is unavailable rather than ticking
eleven people out of sixty. Call-ups from other teams stay possible under
a collapsed section; nothing outside the chosen team is ever pre-ticked.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

### Task 8: Team grouping in AddPlayersLater and the Formation Builder

**Files:**
- Modify: `app/(admin)/admin/match-events/[id]/AddPlayersLater.tsx`, `app/(admin)/admin/match-events/[id]/page.tsx`, `app/(admin)/admin/formation/FormationBuilder.tsx`, `app/(admin)/admin/formation/page.tsx`

**Interfaces:**
- Consumes: players with `teams` (Task 6), `TeamBadge` (Task 2), `match_events.team_id` (Task 1).
- Produces: nothing later tasks depend on. This is the last task.

- [ ] **Step 1: Group AddPlayersLater by team**

In `app/(admin)/admin/match-events/[id]/page.tsx`, select `team_id` on the match and pass it plus the match's team to `AddPlayersLater`.

In `AddPlayersLater.tsx`, sort `available` so the match's own team comes first, then everyone else, and render `<TeamBadge team={s.teams} />` on each button. **Do not pre-tick anything** — this screen exists to add one missing player, not to build a squad.

- [ ] **Step 2: Order the Formation Builder's squad chips by team**

In `app/(admin)/admin/formation/page.tsx`, include `team_id` when selecting matches so the builder knows the selected match's team.

In `FormationBuilder.tsx`:
- Widen `Student` to `{ id, name, avatar_url, year_group, role, team_id, teams }` and `Match` to carry `team_id`.
- Sort `available` so players in the selected match's team come first.
- Render `<TeamBadge team={s.teams} />` next to the existing `<YearBadge>` on each squad chip.
- Render the `<YearBadge>` only when `s.role === 'student'` — Joseph Barton's `year_group` is the column default of 1, so he would otherwise show a false "Y1".

- [ ] **Step 3: Verify the whole flow in the preview**

1. `preview_start`, then `resize_window` to `mobile`.
2. `/admin/teams` — confirm Prem 17, White 15, Blue 14, and Unassigned showing 3.
3. `/admin/match-events` — create a match, pick **Blue**, confirm 14 players pre-ticked and the others collapsed.
4. `/admin/formation?match=<the new match>` — confirm Blue's players lead the squad chips and the save bar sits above the bottom nav.
5. Confirm Joseph B appears in the Prem roster and is pickable for a squad, with no "Y1" badge.

- [ ] **Step 4: Full verification**

Run: `npm run build && npx jest && npx tsc --noEmit && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/admin/match-events/" "app/(admin)/admin/formation/"
git commit -m "$(cat <<'EOF'
feat(matches): order squad pickers by the match's team

Also suppresses the year badge for non-students — a coach's year_group is
the column default of 1, so he would otherwise show a false Y1.

Co-Authored-By: claude-flow <ruv@ruv.net>
EOF
)"
```

---

## Verification checklist before opening the PR

- [ ] `npm run build` passes (not just tsc + Jest — `next.config.js` ignores lint and typecheck during builds, so CI is the only enforcement)
- [ ] `npx jest` — full suite green
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` at baseline
- [ ] `bash scripts/migration-replay/replay.sh` passes with the new migration
- [ ] Migration applied to production, and `select t.name, count(u.id) ... group by t.name` returns Prem 17, White 15, Blue 14
- [ ] Users page checked at 375px — the Team control is reachable on the mobile card
- [ ] A deactivated student no longer appears in "Add players later"

## Known follow-ups, deliberately not in this plan

- **Player positions** (GK/CB/FB/CM/CF/FW). The Blue sheet has one per player; storing them would let the Formation Builder suggest players for a slot. Deferred by explicit decision — teams ship first.
- **Joseph Barton's name** is stored as "Joseph B". Fixable through the existing `updateUserName` action; it is a real person's record, so ask before changing it.
- **`RhysJones`** (no space) is active while a separate `Rhys Jones` is inactive — a likely duplicate account to merge.
- **Khalid Eletu** is on none of the three sheets. Worth asking Chaid whether that is deliberate before anyone assumes the Unassigned bucket is a bug.
- **Squad writes still bypass server actions.** `CreateMatchForm`, `AddPlayersLater` and `FormationBuilder` write `match_squads` through the client-side Supabase client relying on RLS, while users/chat/teams writes go through `requireStaffAction()`. Pre-existing; worth its own pass.
- **`safe-area-inset-bottom` is a dead class.** All three nav bars use it but only `.safe-bottom` is defined in `app/globals.css`, so none pad for the iPhone home indicator.
