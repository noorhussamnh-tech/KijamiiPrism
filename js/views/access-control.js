/**
 * Access Control — demonstration build.
 *
 * In production this page is live and administrative: it reads `profiles`
 * through RLS, and an admin can change a role or approve an account from the
 * table. Both of those are gone here. The accounts are fictional, the email
 * column is not rendered and is not carried in the dataset, and the role and
 * approval controls are static tags rather than disabled inputs — a greyed-out
 * dropdown still implies an action exists.
 *
 * The page is kept rather than removed because the second table is the
 * interesting half: it documents the policy model the production system
 * actually enforces, and that is worth showing even when there is no database
 * behind it. It is labelled as documentation, not as live state.
 */
import { el, clear, formatDate } from '../ui/dom.js';
import { getState } from '../state.js';
import { pageHeader, panel, kpiRow, tag } from '../ui/page.js';

const POLICIES = [
  ['profiles', 'Own row, or all rows for an admin', 'Own row', 'Admin only'],
  ['prism_job_book_entries', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_time_dedication', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_scope_lines', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_clients / employees', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_sync_runs / issues', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
];

export function renderAccessControl(root, view) {
  const { team } = getState();
  clear(root);

  const rows = team ?? [];
  const admins = rows.filter((r) => r.role === 'admin').length;
  const pending = rows.filter((r) => !r.is_approved && r.role !== 'admin').length;

  root.append(
    pageHeader(view),

    kpiRow([
      { label: 'Accounts listed', value: String(rows.length), meta: 'Fictional — illustration only' },
      { label: 'Approved', value: String(rows.length - pending), meta: 'Would be able to read the record' },
      { label: 'Awaiting approval', value: String(pending),
        meta: 'Signed up, sees nothing yet', tone: pending ? 'note' : undefined },
      { label: 'Admins', value: String(admins), meta: 'Approve accounts and change roles' },
    ]),

    panel({
      eyebrow: 'Accounts',
      title: 'Who has access',
      aside: tag('READ-ONLY', 'note'),
      body: el('div', { class: 'table-wrap' }, [
        el('table', { class: 'table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Name' }),
              el('th', { text: 'Role' }),
              el('th', { text: 'Access' }),
              el('th', { text: 'Joined' }),
            ]),
          ]),
          el(
            'tbody',
            {},
            rows.map((m) =>
              el('tr', {}, [
                el('td', {}, [el('p', { class: 'table__title', text: m.full_name || '—' })]),
                el('td', {}, [tag(m.role, m.role === 'admin' ? 'accent' : 'neutral')]),
                el('td', {}, [
                  el('span', {
                    class: m.is_approved ? 'tag tag--accent' : 'tag tag--note',
                    text: m.is_approved ? 'approved' : 'pending',
                  }),
                ]),
                el('td', { class: 'table__muted', text: formatDate(m.created_at) }),
              ])
            )
          ),
        ]),
      ]),
      footnote:
        'These accounts are fictional and no email addresses are held in this build. Administrative actions — approving an account, changing a role — exist only in the production system and have been removed here, not disabled.',
    }),

    panel({
      eyebrow: 'Enforcement',
      title: 'What the database permits, per table',
      body: el('div', { class: 'table-wrap' }, [
        el('table', { class: 'table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Table' }),
              el('th', { text: 'Read' }),
              el('th', { text: 'Write' }),
              el('th', { text: 'Delete' }),
            ]),
          ]),
          el(
            'tbody',
            {},
            POLICIES.map(([table, read, write, del]) =>
              el('tr', {}, [
                el('td', {}, [el('p', { class: 'table__title mono', text: table })]),
                el('td', { class: 'table__muted', text: read }),
                el('td', { class: 'table__muted', text: write }),
                el('td', { class: 'table__muted', text: del }),
              ])
            )
          ),
        ]),
      ]),
      footnote:
        'This table documents the Row Level Security model the production system enforces in Postgres. This demonstration build has no database at all — the whole dataset is a static file in the page — so nothing here is being enforced against anything. It is shown because the policy design is part of what the platform is.',
    })
  );
}
