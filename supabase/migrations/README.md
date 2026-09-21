# Migrations

## Never hardcode an id that only exists in production

A Supabase preview branch replays **every** migration against an **empty**
database (`with_data = false`). A literal id that is real in production does
not exist there, so anything that *depends on that row existing* dies on a
foreign key and aborts the whole replay.

That is exactly what happened to `054_year1_timetable_2026_27.sql`: it seeded
`timetable_slots.created_by` (`uuid not null references public.users(id)`)
with a hardcoded admin id. It replayed fine against production and failed on
every preview branch, so the `Supabase Preview` check was red on every PR from
2026-08-02 until it was fixed in PR #38 — weeks in which no migration was
validated before reaching production.

**Rule:** resolve ids at runtime instead.

```sql
DO $$
DECLARE author uuid;
BEGIN
  -- prefer the original author so production stays byte-identical...
  SELECT id INTO author FROM public.users WHERE id = '<the original id>';
  -- ...then degrade gracefully on a fresh database
  IF author IS NULL THEN
    SELECT id INTO author FROM public.users WHERE role = 'admin' ORDER BY id LIMIT 1;
  END IF;
  IF author IS NULL THEN
    RAISE NOTICE 'skipping seed - no users yet';
    RETURN;
  END IF;

  INSERT INTO ... VALUES (..., author);
END $$;
```

### What is fine

A literal id is only a problem when the row must **already exist**. These are
all safe on an empty database and were confirmed so during the 2026-09-21
audit:

| Migration | Literal ids | Why it's safe |
|---|---|---|
| `012`, `022`, `061`, `079` | `00000000-…-000000000099` | The chat-bot user. `061` **creates** this row rather than referencing a pre-existing one. |
| `032_year_group.sql` | 1 student id | `UPDATE … WHERE id = …` — matches nothing on an empty DB, no error. |
| `058_delete_fake_public_services_accounts.sql` | 10 student ids | `DELETE … WHERE id IN (…)` — no-op when absent. |
| `061_seed_chat_bot_user.sql` | 3 chat-room ids | `DELETE … WHERE id IN (…)` — no-op when absent. |

Adding a literal to an `INSERT`, a `NOT NULL` FK column, or anything that
assumes a row is present needs the runtime-lookup pattern above.

## Verify before you push

`Supabase Preview` aborts at the first failing statement, so each bug costs a
full push/wait cycle. Replay locally instead — it runs every migration in its
own transaction and reports **all** failures in one pass:

```bash
bash scripts/migration-replay/replay.sh
```

Requires Docker. Exits non-zero with the number of failed migrations.

The **`Migration replay`** CI job runs the same script on every PR, against a
Postgres service container, and blocks the merge if any migration fails. That
job exists because `Supabase Preview` is an external check that went red for
weeks while four PRs merged straight over it — this one is in-repo and
blocking, so the same breakage cannot slip through again.

## Migrations are not applied by CI

Nothing in this repo applies migrations. **A committed migration is not an
applied one** — apply it against production yourself and confirm, or the app
will quietly misbehave against a schema that never changed.
