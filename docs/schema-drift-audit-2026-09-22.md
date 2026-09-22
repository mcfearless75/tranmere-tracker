# Schema drift audit — repo vs production

**Date:** 2026-09-22
**Production:** `avpdwutgtsurddvfxhmh`, Postgres 17.6
**Repo at:** `912ddfb` (84 migrations, `001` … `084_teams.sql`)

## Method

The `Migration replay` CI job proves migrations *apply* to an empty database. It
says nothing about whether the result *matches* production. This audit closes
that gap.

1. Replayed all 84 migrations into a throwaway **Postgres 17** container
   (matching production's major version to avoid false positives), via
   `scripts/migration-replay/replay.sh`'s bootstrap. Result: 84/84 applied.
   That database is "what the repo says the schema should be".
2. Computed a normalised signature per object class — tables, columns,
   constraints, indexes, RLS policies, RLS-enabled flags, functions,
   triggers — on both sides, hashed, and compared.
3. Drilled into each mismatching class until every difference was explained.

Scope is schema `public` only. The local Supabase shim fakes `auth` and
`storage`, so comparing those would measure the shim, not the app.

## Result

**After accounting for the four findings below, these classes are
byte-for-byte identical:**

| Class | Count | Match |
|---|---|---|
| tables | 65 | identical |
| columns | 545 | identical |
| constraints | 241 | identical |
| rls_enabled | 65 | identical |
| triggers | 13 | identical |

The core schema is genuinely in sync. Every difference found is listed below —
nothing is unexplained.

---

## 1. Migration `010_lti_platforms.sql` was never applied — LTI is broken in production

**Severity: highest functional impact.**

Three tables exist in the repo and **not** in production:

- `lti_platforms`
- `lti_keypair`
- `lti_user_links`

Five application files query them:

- `app/(admin)/admin/lti/page.tsx`
- `app/(admin)/admin/lti/LtiPlatformForm.tsx`
- `app/api/lti/launch/route.ts`
- `app/api/lti/login/route.ts`
- `lib/lti/keys.ts`

So `/admin/lti` and both LTI endpoints fail against production — they select
from tables that do not exist. This has gone unnoticed because the Moodle
External Tool registration was never completed, so nothing has exercised the
routes.

This is the repo's recurring "a committed migration is not an applied one"
pattern, and `010` is one of the earliest migrations, so it has been in this
state for months.

**Fix:** apply `010_lti_platforms.sql` to production. It is purely additive
(three `create table` statements plus policies), so it is safe to run — but it
is a production DDL change and should be a deliberate decision, not a
side-effect of this audit.

## 2. Nine indexes defined in migrations are missing from production

Tables and columns are present; only the indexes are absent. Queries work,
they are just slower than intended.

| Index | Table | Migration |
|---|---|---|
| `users_role_idx` | users | `037_performance_indexes.sql` |
| `attendance_records_student_id_idx` | attendance_records | `037` |
| `gps_sessions_player_date_idx` | gps_sessions | `037` |
| `nutrition_logs_student_date_idx` | nutrition_logs | `037` |
| `training_logs_student_date_idx` | training_logs | `037` |
| `submission_evidence_student` | submission_evidence | `009_submission_evidence.sql` |
| `submission_evidence_sub` | submission_evidence | `009` |
| `assignment_messages_thread` | assignment_messages | `009` |
| `wellbeing_staff_notes_survey_idx` | wellbeing_staff_notes | `075_match_meet_time_wellbeing_notes.sql` |

`037_performance_indexes.sql` appears to have never run at all — all five of
its indexes are missing. `009` and `075` ran far enough to create their
tables and columns but their indexes are absent, so they were applied
partially, or by hand without the index statements.

`users_role_idx` is the one most worth having: `role` is filtered on nearly
every admin and roster query.

**Fix:** re-running these migrations is safe — every one of the nine uses
`create index if not exists`.

## 3. An RLS policy exists in production that is in no migration

On `public.users`:

```
policy   "admins can update any user"
command  UPDATE
roles    public
using        is_admin_or_coach()
with check   is_admin_or_coach()
```

It is not created by any migration, so it cannot be reviewed in git, and a
rebuilt database (preview branch, disaster recovery, a new environment) would
silently not have it.

Worth understanding what it grants. The app's own writes go through the
service-role client, which bypasses RLS entirely, so this policy is not what
makes the admin UI work — it governs **direct PostgREST access with a user's
own JWT**. `is_admin_or_coach()` includes coaches, so any coach's token can
`PATCH` any user row directly against the API.

Role escalation specifically is still blocked by
`prevent_client_role_change` (migration `050`), and migration `068` hardened
`is_admin_or_coach()` to require `is_active`. But other columns — `name`,
`year_group`, `team_id`, `is_active`, `contact_email` — are writable by any
coach through the API.

**Fix:** decide whether it is wanted. If yes, add it to a migration so it is
version-controlled and reviewable. If no, drop it. Either way it should not
exist only in production.

## 4. A second application shares this database

Not drift in the "broken" sense, but an undocumented coupling worth recording.

Production contains four tables, seven functions and one column on
`public.users` that no migration in this repo creates and no code in this repo
references:

- **Tables:** `gps_tags`, `gps_tag_allocations`, `gps_tag_sessions`, `gps_roster_members`
- **Functions:** `gps_add_roster_member`, `gps_import_all_students`,
  `gps_list_active_players`, `gps_list_addable_players`, `gps_remove_roster_member`,
  `gps_update_catapult_code`, `gps_update_shirt_number`
- **Column:** `users.shirt_number` (`smallint`, nullable)

These belong to the **GPS Tag Allocation** app, which shares this Supabase
project. Note it does not merely live alongside this app — it **writes to
`public.users`**, both the `shirt_number` column it added and `catapult_code`
(which this repo does own, via `074_catapult_roster_codes.sql`).

**Risk:** this repo's migrations have no knowledge of `shirt_number`. Any
future migration that rebuilds or replaces `public.users` would drop a column
another live application depends on, and CI would not catch it — the replay
runs against an empty database where that column never existed.

**Fix:** no action required today. Either add a comment-only migration
recording that `users.shirt_number` is owned externally, or move the GPS app
to its own Supabase project. At minimum, anyone altering `public.users` should
know the table is shared.

---

## Recommended order

1. **Decide on the `users` UPDATE policy** (finding 3) — it is the only
   security-relevant item.
2. **Apply the nine missing indexes** (finding 2) — safe, `if not exists`,
   immediate query benefit.
3. **Apply `010_lti_platforms.sql`** (finding 1) — needed before Moodle SSO
   can ever work; harmless until then.
4. **Record the shared-database coupling** (finding 4).

## Reproducing this audit

```bash
bash scripts/migration-replay/replay.sh   # 84/84 should apply
```

Then compute the same signature on both databases and compare hashes per
class, excluding schema `public` objects owned by the GPS app and any
extension-owned functions (the local shim installs `uuid-ossp` and `pgcrypto`
into `public`; Supabase puts them in `extensions`, which otherwise shows up as
a spurious 39-function difference).
