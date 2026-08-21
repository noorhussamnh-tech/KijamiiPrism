# Apps Script sync

`Code.gs` lives inside the **Kijamii 2026 Job Books & Timesheets** workbook and
pushes it to Supabase. It runs as the sheet owner, so there is no service
account, no Google Cloud Console and no JSON key file.

## Install

1. Open the workbook → **Extensions → Apps Script**.
2. Delete whatever is in `Code.gs` and paste this file's contents in. Save.
3. Reload the workbook. A **Kijamii Prism** menu appears next to Help.
4. **Kijamii Prism → Set Supabase key**, and paste the `service_role` key from
   Supabase → *Project Settings → API Keys*.
5. **Kijamii Prism → Sync now.** Google asks for permission the first time —
   it is asking on your behalf, for your own sheet.
6. **Kijamii Prism → Schedule daily sync** once it works.

## Where the key lives

In the script's private properties, not in a cell and not in this repo.
Anyone with **edit** access to the workbook could retrieve it; viewers cannot.
Given the workbook already holds the full revenue ledger, edit access is
already a higher level of trust than that key represents — but it is a real
difference and worth knowing.

To rotate it: Supabase → API Keys → roll `service_role`, then run
**Set Supabase key** again.

## What it guarantees

- **Idempotent.** Upserts key on `(source_tab, source_row)`. Running twice
  changes nothing the second time.
- **Look-alike rows stay separate.** Row position is the key, not a content
  hash — the job book holds rows identical except for `Supplier`, and hashing
  would merge three real costs into one.
- **Blank ≠ zero.** An empty timesheet cell produces no row. A typed `0`
  produces a row with `0`.
- **Nothing invented.** Unparseable values are left empty and written to
  `prism_sync_issues` with their original text. EGP rows carry no USD figure
  until a rate exists in `prism_fx_rates`.
- **Non-destructive.** Rows removed from the Sheet are flagged
  `is_deleted = true`, never erased.
- **One-way.** The script only reads the Sheet. Nothing is ever written back.

## Checking on it

**Kijamii Prism → Check last sync**, or in Supabase:

```sql
select * from public.prism_sync_status_v;
select code, severity, count(*) from public.prism_sync_issues
where run_id = (select max(id) from public.prism_sync_runs)
group by 1,2 order by 3 desc;
```

## Note on the Edge Function

`supabase/functions/sync-sheet` does the same job by pulling from Google with a
service account. It is deployed but has no secrets set, so it is inert. Keep it
as a fallback or ignore it — running both would be harmless (the upserts are
idempotent) but pointless.
