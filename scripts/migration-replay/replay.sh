#!/usr/bin/env bash
#
# Replay every migration in supabase/migrations against an EMPTY database, the
# way a Supabase preview branch does.
#
#   bash scripts/migration-replay/replay.sh
#
# Two modes, same logic either way:
#   * REPLAY_DATABASE_URL set  -> replay against that database with local psql.
#     Used by the `Migration replay` CI job against a postgres service
#     container. The database must be EMPTY -- the point is a fresh replay.
#   * unset                    -> start a throwaway postgres container via
#     Docker and replay against that. This is the local developer path.
#
# Why this exists: a migration that hardcodes an id which only exists in
# production replays fine against production and dies on a fresh database.
# That is invisible locally and only shows up as a red `Supabase Preview`
# check, which is slow to iterate on -- 054_year1_timetable_2026_27.sql sat
# broken that way for weeks, and four PRs merged straight over the red check.
#
# Each migration runs in its OWN transaction. A failure is rolled back and
# recorded, then the replay continues -- so a single pass surfaces every
# broken migration, not just the first one. (A preview branch aborts at the
# first failure, which means one push per bug.)
#
# Exit code is the number of failed migrations, so CI can gate on it.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGDIR="$REPO_ROOT/supabase/migrations"
BOOTSTRAP="$REPO_ROOT/scripts/migration-replay/bootstrap.sql"
DB_URL="${REPLAY_DATABASE_URL:-}"
CID=tranmere-migration-replay
PG_IMAGE="${PG_IMAGE:-postgres:15}"

if [ ! -d "$MIGDIR" ]; then
  echo "no migrations directory at $MIGDIR" >&2
  exit 1
fi

if [ -n "$DB_URL" ]; then
  echo "== replaying against \$REPLAY_DATABASE_URL =="
  psql_run() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }
else
  command -v docker >/dev/null 2>&1 || {
    echo "docker not found; set REPLAY_DATABASE_URL to an empty database instead" >&2
    exit 1
  }

  cleanup() { docker rm -f "$CID" >/dev/null 2>&1 || true; }
  trap cleanup EXIT
  cleanup

  echo "== replaying against a throwaway $PG_IMAGE container =="
  docker run -d --name "$CID" -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=app "$PG_IMAGE" >/dev/null

  printf 'waiting for postgres'
  for _ in $(seq 1 60); do
    if docker exec "$CID" pg_isready -U postgres -d app >/dev/null 2>&1; then break; fi
    printf '.'
    sleep 1
  done
  echo ' up'

  psql_run() { docker exec -i "$CID" psql -U postgres -d app -v ON_ERROR_STOP=1 -q "$@"; }
fi

echo '== bootstrap (Supabase shim) =='
if ! psql_run -1 < "$BOOTSTRAP"; then
  echo 'BOOTSTRAP FAILED' >&2
  exit 1
fi

PASS=0
FAIL=0
FAILED_LIST=""

for f in "$MIGDIR"/*.sql; do
  base=$(basename "$f")
  if err=$(psql_run -1 < "$f" 2>&1); then
    PASS=$((PASS + 1))
    printf 'ok   %s\n' "$base"
  else
    FAIL=$((FAIL + 1))
    FAILED_LIST="$FAILED_LIST $base"
    printf 'FAIL %s\n' "$base"
    echo "$err" | grep -E '^(psql:|ERROR|DETAIL|HINT|CONTEXT)' | head -6 | sed 's/^/       /'
  fi
done

echo
echo '================================================'
echo "RESULT: $PASS passed, $FAIL failed (of $((PASS + FAIL)))"
if [ -n "$FAILED_LIST" ]; then
  echo "FAILED:$FAILED_LIST"
  echo
  echo 'A migration that fails here would abort a Supabase preview branch and'
  echo 'never reach production cleanly. Resolve ids at runtime rather than'
  echo 'hardcoding one that only exists in production -- see'
  echo 'supabase/migrations/README.md.'
fi
echo '================================================'

exit "$FAIL"
