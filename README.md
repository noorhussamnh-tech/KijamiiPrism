# Kijamii Prism — Demonstration Environment

A submission-safe build of Kijamii Prism, running on a fixed, fully invented
dataset. Same eighteen pages, same filters, same calculations, same
interactions as the production application — different record underneath, and
no connection to anything.

**This branch must never be merged into `main`.** It is a permanent sibling of
production, not a change to it.

> **Demonstration Environment — Anonymized Data**
> Every client, employee, region, amount and date in this build is fictional.

---

## What this is

Prism is the reading layer over an agency's records: what was billed, what was
worked, what was promised. Eighteen views, one page grammar, one set of rules —
the most important of which is that a gap in the record is never read as a zero.

This build exists so that reading layer can be shown to someone without showing
them the agency's revenue, its client list, or its people.

| | Production (`main`) | Demonstration (`demo`) |
|---|---|---|
| Data source | Supabase, synced from a Google Sheet | `js/demo/dataset.js`, in the page |
| Network calls after load | Supabase REST + realtime websocket | none |
| Sign-in | Email + password, RLS, admin approval | none — no session, no form |
| Writes | Role and approval changes | none — removed, not disabled |
| Pages | 18 | 18 |

## Running it

No build step. Serve the directory:

```bash
python3 -m http.server 4477
```

Then open <http://localhost:4477>. It works from `file://` too, except that ES
modules need an origin, so use the server.

## Regenerating the dataset

The dataset is generated, not hand-written, and the generator is committed so
the result is reproducible and auditably synthetic:

```bash
node js/demo/generate.mjs
```

It is seeded, so it produces the same dataset every time. It prints a short
report — row counts, total revenue, top-5 share, coverage — so a change that
quietly alters the shape of the demo is visible at the terminal rather than
three pages into the app.

Editing `js/demo/dataset.js` by hand works but will be overwritten; change
`generate.mjs` instead.

## Layout

```
index.html            mount point; everything else is rendered by js/main.js
vercel.json           static config, CSP, and the branch guard on builds
js/
  config.js           constants. deliberately holds no credentials
  supabase.js         an inert proxy that throws — there is no client
  auth.js             a fixed viewer. no sign-in, no session, no email
  realtime.js         no-op
  main.js             bootstrap: profile -> data -> route
  data/prism.js       loads the fixture; helpers below it are production code
  demo/generate.mjs   the seeded generator
  demo/dataset.js     GENERATED — the dataset itself
  nav.js router.js state.js
  ui/                 page grammar, chart primitives, DOM helpers
  views/              the eighteen pages
styles/               tokens, base, components
```

## Isolation and anonymization

See [DEMO.md](DEMO.md) for the record of what was removed, what was replaced,
and the five independent layers that keep this build separated from production.

## Deployment

Its own Vercel project, with production branch `demo`. `vercel.json` carries an
`ignoreCommand` that refuses to build any other ref, so this project cannot
deploy `main` even though both are attached to the same repository.
