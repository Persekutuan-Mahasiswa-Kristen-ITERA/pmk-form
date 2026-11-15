# supabase/ (pmk-form on the PI-CORE project)

pmk-form lives in the **same Supabase project as PI-CORE and PMK-NEXUS**:

| Thing | Where |
|---|---|
| Tables | schema `form` (`forms`, `form_responses`, `sheets_outbox`, `admin_members`, `admin_audit_log`, later `legacy_*`) |
| Login | PI-CORE's Supabase Auth. Accounts are made in PI-CORE; no sign-up, no Google login |
| Admins | invite by email in `/admin/users` (`form.admin_members`). The invite turns active when a PI-CORE account with that email signs in to pmk-form. Deactivated PI-CORE members and accounts on a temporary password are refused |
| Files | Cloudflare R2, **private** bucket. Rows store object keys; admins open files through `/admin/attachments` |

pmk-form owns schema `form` only. Nothing here alters PI-CORE's `public`/`private` schemas; `form` functions read `public.members` and `auth.users` for the caller only.

| Path | What |
|---|---|
| `migrations/20261116100000_form_schema.sql` | Schema `form`: tables, RLS, `is_admin()`, `my_picore_status()`, `link_admin_user_id()`, `picore_account_exists()` (final state of the old migrations 001-016) |
| `tests/form_access.test.sql` | Access tests per persona (local only, rolled back) |
| `local/seed_test_accounts.sql` | FAKE `@form.test` accounts for the local stack (refuses to run on a real database) |
| `config.toml` | Local stack (ports 56430-56439) |
| `../migrations/` | The OLD project's history (001-016). Kept for reference; not applied anywhere anymore |

## Local stack

Needs Docker and the PI-CORE repo next to this one (`../pi-core-v2`, read only).

```bash
bash scripts/dev-db.sh start     # PI-CORE migrations + schema form + fake accounts
bash scripts/dev-db.sh status    # API URL and publishable key for .env.local
docker exec -i supabase_db_pmk-form psql -U postgres -X -q -v ON_ERROR_STOP=1 < supabase/tests/form_access.test.sql
```

Fake accounts (password `FormLocal2026`):

| Email | What it tests |
|---|---|
| `admin@form.test` | active admin |
| `invited@form.test` | invite that activates on first login |
| `temppw@form.test` | invited, but still on a PI-CORE temporary password (refused, link to PI-CORE) |
| `inactive@form.test` | admin row active, PI-CORE member deactivated (refused) |
| `disabled@form.test` | admin row disabled (refused) |
| `member@form.test` | PI-CORE member, not invited (refused) |

For files locally, any S3-compatible server works (`R2_ENDPOINT=http://127.0.0.1:<port>`), e.g. `adobe/s3mock`.

## Moving production (owner runs it, in this order)

Why not `supabase db push`: the project's migration history table is shared with PI-CORE and NEXUS, so the CLI would see their versions as unknown and suggest "repairing" them. Never do that. Apply the SQL file directly instead.

1. **Freeze the old app.** Close every open form in the old admin (or note the time), so no response arrives during the move.
2. **Back up both projects** (read only): `pg_dump "$OLD_DB_URL" -Fc -f old-pmk-form.dump` and `pg_dump "$NEW_DB_URL" -Fc -f picore-before-form.dump`. Both contain personal data: keep them encrypted, outside the repo and outside synced folders.
3. **R2:** create the private bucket `pmk-form-attachments` (no public access, no r2.dev URL) and an API token with Object Read & Write on that bucket only.
4. **Schema:** check the target first (`psql "$NEW_DB_URL" -c "select current_database()"` and compare the project ref), then
   `psql "$NEW_DB_URL" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261116100000_form_schema.sql`
5. **Expose `form`:** Dashboard > Project Settings > Data API > Exposed schemas. The field REPLACES the whole list (shared with PI-CORE and NEXUS): copy the current list, add `form`, save. Then check that PI-CORE login and NEXUS still work.
6. **Data and files:** dry run first, then apply:
   ```bash
   set -a; . scripts/migrate/.env.migrate; set +a   # OLD_/NEW_ Supabase URL + service keys, R2_*
   node scripts/migrate/run.mjs            # reads only, writes migrate-report.json
   node scripts/migrate/run.mjs --apply    # copies files to R2, upserts rows (safe to repeat)
   OLD_DB_URL=... NEW_DB_URL=... bash scripts/migrate/legacy-tables.sh          # review legacy-tables.sql
   OLD_DB_URL=... NEW_DB_URL=... bash scripts/migrate/legacy-tables.sh --apply
   ```
   Old admins come over with their email and status; each one is linked on their first PI-CORE login. Anyone without a PI-CORE account needs one from a PI-CORE admin first.
7. **Vercel (pmk-form):** set the env from `.env.example` (PI-CORE URL + keys, `R2_*`, `NEXT_PUBLIC_PICORE_URL`, `NEXT_PUBLIC_SITE_URL`), redeploy, add `https://form.pmkitera.web.id/**` to PI-CORE's Supabase Auth Redirect URLs.
8. **Check:** log in as an admin, open an old response and one of its files, submit a test form with a file, then delete that test response.
9. **Keep the old project** paused/read-only for 30 days as a fallback, then delete it. Delete `migrate-report.json`, `legacy-tables.sql` and the dumps when done.
