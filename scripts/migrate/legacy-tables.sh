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
# pg_dump/psql run inside the local Supabase DB container (scripts/dev-db.sh start), so the client
# version matches Supabase's Postgres. Dropped on purpose: policies, triggers, grants, owners and
# foreign keys to auth.users (old project's accounts do not exist in PI-CORE).
set -euo pipefail

: "${OLD_DB_URL:?set OLD_DB_URL}"
: "${NEW_DB_URL:?set NEW_DB_URL}"
[ "$OLD_DB_URL" != "$NEW_DB_URL" ] || { echo "OLD_DB_URL and NEW_DB_URL are the same. Stopping." >&2; exit 1; }
CONTAINER="${PG_CONTAINER:-supabase_db_pmk-form}"
OUT="legacy-tables.sql"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

docker exec -i "$CONTAINER" pg_dump "$OLD_DB_URL" --no-owner --no-privileges --no-comments \
  -t public.submissions -t public.recruitments -t public.selection_results \
  | python3 -I "$HERE/legacy_transform.py" > "$OUT"

echo "Wrote $OUT ($(grep -c '^COPY ' "$OUT") tables with data). Review it before --apply."
grep -E '^(CREATE TABLE|COPY|ALTER TABLE ONLY)' "$OUT" | cut -c1-120

if [ "${1:-}" = "--apply" ]; then
  docker exec -i "$CONTAINER" psql "$NEW_DB_URL" -X -1 -v ON_ERROR_STOP=1 -q < "$OUT"
  echo "Applied. Row counts in the new database:"
  docker exec -i "$CONTAINER" psql "$NEW_DB_URL" -X -tA -c \
    "select 'legacy_submissions', count(*) from form.legacy_submissions
     union all select 'legacy_recruitments', count(*) from form.legacy_recruitments
     union all select 'legacy_selection_results', count(*) from form.legacy_selection_results;"
fi
