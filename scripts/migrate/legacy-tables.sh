#!/usr/bin/env bash
# Copy the legacy oprec tables from the OLD pmk-form database into the PI-CORE database as
#   public.submissions        -> form.legacy_submissions
#   public.recruitments       -> form.legacy_recruitments
#   public.selection_results  -> form.legacy_selection_results
# The app does not use them; they are kept as read-only history (service role only, no policies).
#
#   scripts/migrate/legacy-tables.sh            DRY RUN: dump + transform, writes legacy-tables.sql to review
#   scripts/migrate/legacy-tables.sh --apply    also runs that file on NEW_DB_URL in ONE transaction
#
# Env: OLD_DB_URL (old pmk-form project), NEW_DB_URL (PI-CORE project). Connection strings from
# Dashboard > Connect (session pooler). Never commit them.
# pg_dump/psql run from Supabase's Postgres image (same major version as the hosted database);
# connection strings go in as environment variables, never as command-line arguments. Dropped on purpose: policies, triggers, grants, owners and
# foreign keys to auth.users (old project's accounts do not exist in PI-CORE).
set -euo pipefail

: "${OLD_DB_URL:?set OLD_DB_URL}"
: "${NEW_DB_URL:?set NEW_DB_URL}"
[ "$OLD_DB_URL" != "$NEW_DB_URL" ] || { echo "OLD_DB_URL and NEW_DB_URL are the same. Stopping." >&2; exit 1; }
PG_IMAGE="${PG_IMAGE:-public.ecr.aws/supabase/postgres:17.11.0.006}"
pg() { # pg <OLD|NEW> <command...>: run a Postgres client with $D set to that database URL
  local url; [ "$1" = OLD ] && url="$OLD_DB_URL" || url="$NEW_DB_URL"; shift
  docker run --rm -i --network host -e D="$url" --entrypoint sh "$PG_IMAGE" -c "$*"
}
OUT="legacy-tables.sql"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pg OLD 'pg_dump "$D" --no-owner --no-privileges --no-comments -t public.submissions -t public.recruitments -t public.selection_results' \
  | python3 -I "$HERE/legacy_transform.py" > "$OUT"

echo "Wrote $OUT ($(grep -c '^COPY ' "$OUT") tables with data). Review it before --apply."
grep -E '^(CREATE TABLE|COPY|ALTER TABLE ONLY)' "$OUT" | cut -c1-120

if [ "${1:-}" = "--apply" ]; then
  pg NEW 'psql "$D" -X -1 -v ON_ERROR_STOP=1 -q' < "$OUT"
  echo "Applied. Row counts in the new database:"
  pg NEW 'psql "$D" -X -tA' <<'SQL'
select 'legacy_submissions', count(*) from form.legacy_submissions
union all select 'legacy_recruitments', count(*) from form.legacy_recruitments
union all select 'legacy_selection_results', count(*) from form.legacy_selection_results;
SQL
fi
