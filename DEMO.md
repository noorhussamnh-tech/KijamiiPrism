# Isolation and anonymization record

What was removed from this branch, what was replaced, and why the demonstration
build cannot reach production. Written to be checked rather than trusted — every
claim below corresponds to something in the source that can be read.

---

## 1. The dataset is invented, not derived

`js/demo/dataset.js` was produced by `js/demo/generate.mjs`, which reads
nothing. There is no import of production data, no export file, no fixture
captured from a live response, and no transformation of a real record.

This matters more than it first appears. A dataset derived from real figures by
perturbation — scaling amounts, shuffling names, adding noise — still carries
the *shape* of the original: the same number of clients, the same relative
sizes, the same seasonal peaks. Against a publicly known client list, shape is
re-identifying. So the demo dataset has no original to be re-identified against.

What is deliberately preserved is analytical behaviour, because a platform built
to handle imperfect records demonstrates nothing on a perfect one. The generator
plants:

- a concentration curve where the top five clients hold ~64% of revenue, above
  the 60% threshold at which Revenue Concentration flags dependency;
- ~16% of the timesheet grid missing, including two people whose gaps are
  contiguous rather than scattered;
- six people carrying three or more consecutive months above the reference
  threshold, and seven with an isolated heavy month;
- clients running both over and under their documented scope, plus one carrying
  a scope document that records zero dedication;
- two clients with effort and no revenue, seven with revenue and no effort;
- six revenue rows with no exchange rate on file, excluded from converted
  totals rather than counted as zero;
- an incomplete trailing month, so the partial-month exclusion on Commercial
  Direction has something to exclude.

## 2. Field-by-field anonymization

| Source | Field | Treatment |
|---|---|---|
| clients | `client_code`, `name` | Fictional, stable across every page (`CL-01` → Meridian Beverages) |
| | `sector` | Generic sector words — non-identifying, and the mix drives chart behaviour |
| employees | `employee_code`, `name` | Fictional; first name plus initial |
| | `is_placeholder` | Retained as a flag; two placeholder rows exist |
| regions | `region_code`, `name` | Invented: Calderra, Solvina, Marovia, Non-Solvina |
| time_dedication | `hours` | Synthetic; distribution shape and the >140h tail preserved |
| | `team`, `title`, `engagement_type` | Generic role and team labels |
| | `source_row` | Sequential synthetic index; no traceability to any source row |
| job_book | `recognized_amount`, `recognized_amount_usd`, `fx_rate_used` | Fully synthetic |
| | `invoicing_date` | **Dropped** — removed from the dataset and from the column list in `data/prism.js` |
| | `currency` | Invented codes (CDR, SVN, MRV) matching the invented regions |
| | `region_code`, `service_code`, `sub_service`, `entry_type`, `month_start` | Structure retained; values generic |
| scope_lines | `assignee_name`, `function`, `title` | Fictional, consistent with the employee labels |
| | `assumed_pct`, `assumed_hours` | Synthetic, derived from generated effort with a per-client offset |
| contracts | `end_date`, `end_date_unknown` | Synthetic; the "unknown" cases retained as a pattern |
| sync_issues | `raw_value`, `message`, `tab`, `source_row` | Rebuilt from scratch. `raw_value` echoes literal source cell contents in production and was the highest-risk field in the application; no production string survives |
| profiles | `email` | **Removed** from the interface and from the dataset |
| | `full_name`, `role`, `is_approved`, `created_at` | Fictional accounts |

Hard-coded copy was audited too, not just data. Production view text named three
real clients in a footnote and referred to a fourth in a comment; the region
names appeared in fourteen places across nav labels, filter options, panel
footnotes and source lines. All were replaced.

## 3. Removed from the branch

Deleted, not ignored — `git log` on this branch shows them going:

| Removed | Why |
|---|---|
| `apps-script/` | Held the live Google Sheet ID and the service-key plumbing |
| `supabase/` | Migrations, RLS policies, and the `sync-sheet` edge function |
| `.mcp.json`, `.claude/settings.local.json` | Local tooling configuration |
| `js/ui/auth-view.js`, `js/ui/pending-view.js` | The sign-in and approval screens |
| `netlify.toml`, `_headers` | Superseded by `vercel.json` |
| Supabase URL, publishable key, admin email | Were in `js/config.js` and `README.md` |

Administrative functionality was removed rather than hidden. `signIn`, `signUp`,
`signOut`, `setRole` and `setApproval` do not exist in `js/auth.js` on this
branch — a disabled control is still a control that implies an action exists.

## 4. Five layers of isolation

Each is sufficient on its own; they are independent so that a mistake in one
does not defeat the rest.

1. **No client exists.** `js/supabase.js` does not fetch the SDK. It exports a
   proxy that throws on any property access, so a leftover `supabase.from(...)`
   from a future merge fails loudly at the call site instead of silently
   resolving to `undefined` and looking, for a moment, like it worked.
2. **No credentials exist.** There is no project URL, key, sheet ID or address
   anywhere on the branch. Nothing to point a client at, even if one were added.
3. **The browser enforces it.** `vercel.json` ships
   `connect-src 'self'` — the production Supabase origin and its websocket are
   not in the allowlist, so the browser refuses the request regardless of what
   the JavaScript asks for. This is the layer that does not depend on the
   application code being correct.
4. **Nothing to authenticate against.** No form, no session, no token, no auth
   callback, no password field. Verified: the built page contains zero `<form>`
   elements and zero `<input>` elements.
5. **Build isolation.** `vercel.json` carries
   `ignoreCommand` that exits non-building for any ref other than `demo`. Both
   projects are attached to the same repository; this one cannot deploy `main`.

Also set: `X-Robots-Tag: noindex, nofollow` and a `robots` meta tag, so a fixed
sample does not end up ranking above the real thing; `X-Frame-Options: DENY`;
and `form-action 'none'`, which the build can afford because it has no forms.

## 5. Verification performed

Against the built branch, served locally:

- All 18 routes render. Zero console errors, zero uncaught exceptions.
- Network log after load: 33 same-origin module requests and the two Google
  Fonts hosts. Zero requests matching `supabase`, `jsdelivr`, `google`,
  `sheets` or `cdn`.
- Filters recalculate: client filter on Hours per Employee (36 employees /
  28.0Kh → 6 / 1.4Kh for one client); month window on Hours & Coverage (84%
  coverage over the full window → 80% from May); reference threshold on
  Workload Pressure (17 employees over 140h → 34 over 100h).
- Segmented controls switch panels on Projects & Ticket Size, Actual vs.
  Assumed (all three modes) and Commercial Direction (all three lenses).
- The banner is present on every page including the loading splash, and grows
  rather than hides in boardroom mode.
- Zero sign-out controls, zero forms, zero inputs, zero password fields, zero
  buttons matching approve/revoke/save/sign/delete/edit/submit.
- Source scan of the whole branch for the production project ref, publishable
  key, sheet ID, admin address, prior client names and prior region names:
  no matches.
