# Kijamii Prism — Intelligence Layer

The reading layer over Kijamii's records: what was billed, what was worked,
what was promised. Eighteen views, one page grammar, one set of rules.

Static site. No React, no Next.js, no build step — plain HTML, CSS and ES
modules, with the Supabase client loaded from a CDN. The directory deploys
to any static host as-is.

---

## Status

| Layer | State |
|---|---|
| Shell, navigation, routing, page grammar | **Built** |
| Chart primitives (heatmap, ranked, paired, stacked, deviation) | **Built and verified** |
| Auth, roles, RLS, realtime | **Built and verified** |
| About Prism · Knowledge Center · Boardroom · Access Control | **Live** |
| The other fourteen analytical views | **Chrome built, awaiting source data** |

The fourteen analytical views render their real header, filters and headline
figures, then state exactly which source columns they need. They are
deliberately not filled with placeholder numbers — a chart with invented
figures is indistinguishable from a real one at a glance, and that is a bad
thing to leave lying around in a management tool.

### What is needed to finish them

An export of the workbook, as CSV or XLSX:

| Sheet | Columns needed |
|---|---|
| **Time dedication** | employee code, month, hours, client, region |
| **Master mapping** | employee code, name, region |
| **Job book** | client, service, engagement, month, revenue, currency, region, sector |
| **Scope document** | client, assumed monthly hours |

With those, the schema gets designed around the real columns, loaded into
Supabase behind the same RLS, and bound to the views that are already built.

---

## Running it

ES modules are fetched over HTTP, so opening `index.html` from the filesystem
fails on CORS. Serve the directory:

```bash
python3 -m http.server 5500
```

Then open <http://localhost:5500>.

---

## Structure

```
index.html              mount point only — every pixel is rendered by JS
styles/tokens.css       colour, type, spacing; interface accent vs. data ramp
styles/base.css         reset, shell, sidebar, topbar, responsive rules
styles/components.css   page grammar, charts, panels, tables, modal, toasts
js/config.js            Supabase URL, publishable key, source workbook URL
js/nav.js               the 18 views: group, question, headline, caveat, needs
js/supabase.js          the only module that imports the CDN
js/auth.js              sign in / up / out, profile and role reads
js/db.js                queries
js/realtime.js          postgres_changes subscription and teardown
js/state.js             in-memory store with subscribe/notify
js/router.js            hash routing, valid routes derived from nav.js
js/ui/page.js           page grammar: header, filters, KPIs, panels, awaiting
js/ui/charts.js         heatmap, ranked, paired, stacked, deviation
js/ui/shell.js          grouped sidebar, top bar, boardroom toggle
js/views/               analytical (generic) + the four data-free views
supabase/migrations/    the SQL that produced the live schema
```

`js/nav.js` is the spine. Sidebar grouping, valid routes, the breadcrumb, each
page's editorial header, and the "what this view needs" list all read from it,
so a view cannot drift out of sync with how it is labelled. Adding an
analytical view means adding a nav entry — nothing else.

### The page grammar

Every analytical view is the same sequence, which is why it lives in
`ui/page.js` once rather than in fourteen modules:

```
question  →  headline  →  method caveat  →  toggles + source
          →  filters  →  headline figures  →  evidence  →  footnote
```

If a page cannot state the question it answers, it does not belong.

---

## Rules the code enforces

**A gap is not a zero.** A missing timesheet submission renders hatched with an
em dash and a "No submission" tooltip; a real `0` renders as a filled cell
reading `0`. `charts.js` keeps `null` and `0` on separate paths for exactly
this reason, and it is verified — of 48 test cells, 18 hatched, and a genuine
zero stayed filled.

**Attribution is labelled.** Service-level hours are derived from each client's
revenue mix, because timesheets carry no service column. Every view that does
this says so in its method note and carries an `ATTRIBUTED` tag.

**Every value is printed.** Colour shows shape; the number shows magnitude. No
figure requires reading a position against an axis.

**The interface accent is never a data series.** Lime means "you are here" and
"primary action". Data uses a separate six-hue ramp, so a selected state is
never mistaken for a category.

---

## Database

Project **Kijamii Prism** (`gwepxpyfgtgagceguyhm`, eu-west-1),
`https://gwepxpyfgtgagceguyhm.supabase.co`.

The publishable key in `js/config.js` is public by design — it identifies the
project and authorises nothing. Every access decision is made by RLS.

### Automatic admin assignment

`public.admin_email()` holds one address: `noorhussam.nh@gmail.com`. An
`after insert` trigger on `auth.users` creates the profile row and sets
`role = 'admin'` when the email matches, `'member'` otherwise. The same
migration backfills existing accounts, so the rule holds either way. To change
who is admin, edit `admin_email()` — the trigger and the backfill both read it.

### Row Level Security

| Table | select | insert | update | delete |
|---|---|---|---|---|
| `profiles` | own row, or all if admin | trigger only | own row, or all if admin | admin |
| `clients` / `projects` / `tasks` | any signed-in user | any signed-in user | any signed-in user | **admin** |

`anon` is revoked from all four tables outright.

Two details before changing any of it:

- **`public.is_admin()` is `SECURITY DEFINER` on purpose.** A `profiles` policy
  that queries `profiles` recurses; a definer function bypasses RLS on its own
  read and breaks the cycle.
- **The `profiles_guard_role_change` trigger is what stops privilege
  escalation**, not the policy. A member may update their own profile, which
  would otherwise let them set `role = 'admin'`.

Hiding controls from members is a courtesy. The database is what refuses.

### Realtime

`clients`, `projects` and `tasks` are in the `supabase_realtime` publication at
`REPLICA IDENTITY FULL` — without FULL a `DELETE` payload carries only the
primary key and the client cannot reconcile the removed row. Realtime applies
the same RLS to `postgres_changes`, using the token on the socket, so
`main.js` subscribes only *after* the session exists and tears down on sign-out.

---

## Dashboard settings

1. **Email confirmation** — on by default, so sign-up shows a "check your
   email" state. Toggle under *Authentication → Sign In / Providers*.
2. **Redirect URLs** — add the deployed origin under *Authentication → URL
   Configuration* before deploying, or confirmation links point at localhost.
3. **Leaked password protection** — flagged as disabled by the linter. One
   switch under *Authentication → Password security*.

Set `SOURCE_WORKBOOK_URL` in `js/config.js` to make every "SOURCE WORKBOOK ↗"
pill a live link. Left `null` deliberately — a source link pointing at the
wrong document is worse than one that admits it is unset.

---

## Verifying

```sql
select email, role from public.profiles order by created_at;
```

In the browser:

1. Sign in as `noorhussam.nh@gmail.com` — Access Control shows every account
   and the role selectors are editable.
2. Sign in as anyone else — Access Control shows one row and says why.
3. As a member, confirm the database refuses even when the UI is bypassed:

   ```js
   await __prism.supabase.from('profiles')
     .update({ role: 'admin' }).eq('id', '<their-id>').select()
   // → 42501 : Only an admin may change a role
   ```

4. `BOARDROOM` in the top bar scales the type ramp and dims the controls.
