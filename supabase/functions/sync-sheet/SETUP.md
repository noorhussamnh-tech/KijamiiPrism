# Sync setup — Google Sheet → Supabase

The function is deployed. It needs three secrets and read access to the Sheet
before its first run. **None of these go in the repo.**

## 1 · Google service account (once)

1. <https://console.cloud.google.com> → create or pick a project.
2. **APIs & Services → Library → Google Sheets API → Enable.**
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Name it e.g. `prism-sync`. No roles needed — it gets access via sharing.
4. Open the service account → **Keys → Add key → Create new key → JSON**.
   A JSON file downloads. It contains `client_email` and `private_key`.
5. **Share the Sheet with the `client_email` address, Viewer.** Read-only is
   deliberate: the pipeline is one-way and the service account should not be
   able to write to your source of truth even by accident.

## 2 · Supabase secrets

Dashboard → **Edge Functions → Manage secrets**, or the CLI:

```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="prism-sync@your-project.iam.gserviceaccount.com"
```

```bash
supabase secrets set PRISM_SHEET_ID="1OD0gmT-LI8rHxKBQEfVFUmnY3D4noSwEKz1ia5TqRLY"
```

For the key, paste the `private_key` value from the JSON **exactly as it
appears there**, including the literal `\n` sequences — the function converts
them back to newlines before parsing:

```bash
supabase secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform —
do not set them yourself, and never put the service-role key in client code.

## 3 · First run

```bash
curl -X POST "https://gwepxpyfgtgagceguyhm.supabase.co/functions/v1/sync-sheet?trigger=manual" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

It returns a JSON summary and writes a row to `prism_sync_runs`. Check it:

```sql
select * from public.prism_sync_status_v;
select code, severity, count(*) from public.prism_sync_issues group by 1,2 order by 3 desc;
```

## 4 · Schedule it

Enable `pg_cron` and `pg_net` under **Database → Extensions**, then:

```sql
select cron.schedule('prism-sheet-sync', '0 4 * * *', $$
  select net.http_post(
    url := 'https://gwepxpyfgtgagceguyhm.supabase.co/functions/v1/sync-sheet?trigger=cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
  );
$$);
```

`0 4 * * *` is 04:00 UTC — 06:00 Cairo. Adjust to taste.

## What the sync guarantees

- **Idempotent.** Upserts key on `(source_tab, source_row)`. Running it twice
  changes nothing the second time.
- **Safe against look-alike rows.** Row position is the key, not a content
  hash — the job book holds rows identical except for `Supplier`, and hashing
  would merge three real costs into one.
- **Never destructive.** Rows removed from the Sheet are flagged
  `is_deleted = true`, never deleted.
- **Never invents.** An unparseable value is left null and written to
  `prism_sync_issues` with its raw text. EGP rows carry a null USD amount
  until a rate exists in `prism_fx_rates`.
- **One-way.** RLS grants `authenticated` SELECT only, with no write policy on
  any pipeline table. The website cannot write to these tables at all.

## Adding the EGP rate

```sql
-- one standing rate
insert into public.prism_fx_rates (currency, effective_month, rate_to_usd, source)
values ('EGP', null, <rate>, 'manual');

-- or per month, which overrides the standing rate for that month
insert into public.prism_fx_rates (currency, effective_month, rate_to_usd, source)
values ('EGP', '2026-01-01', <rate>, 'manual');
```

Then re-run the sync — it recomputes `recognized_amount_usd` from the table.
