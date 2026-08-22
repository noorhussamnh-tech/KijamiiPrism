# Migrations

The six `20260820*` files are the original agency-ops schema (profiles, clients,
projects, tasks) and match what is applied.

The eight `20260821*`–`20260822*` migrations that build the Prism pipeline —
reference tables, fact tables, sync observability, RLS, daily FX, the approval
gate, and the invoiced-amount fallback — **are applied to the project but are
not yet checked in here.** They can be exported at any time with:

```bash
supabase db pull --schema public
```

or read directly from `supabase_migrations.schema_migrations`:

```sql
select version, name, array_to_string(statements, E';\n')
from supabase_migrations.schema_migrations
where version >= '20260821163941'
order by version;
```

Applied, in order:

| Version | Name |
|---|---|
| 20260821163941 | `prism_reference_tables` — clients, employees, aliases, regions, services, fx_rates |
| 20260821164020 | `prism_fact_tables` — job_book_entries, time_dedication, scope_lines, contracts |
| 20260821164043 | `prism_sync_infrastructure` — sync_runs, sync_issues, sync_status_v |
| 20260821164105 | `prism_rls_read_only` — SELECT-only policies, anon revoked |
| 20260821180342 | `prism_fx_daily_rates` — day/month/standing granularity, conversion trigger |
| 20260821180851 | `prism_realtime_publication` — pipeline tables on the realtime stream |
| 20260821215116 | `prism_require_approved_accounts` — `profiles.is_approved` gates every read |
| 20260822120714 | `prism_fall_back_to_invoiced_amount` — `amount_basis`, invoiced fallback |

Until those are exported, the live database is the source of truth for the
Prism schema, not this directory. Stated here rather than left for someone to
discover when a rebuild comes up short.
