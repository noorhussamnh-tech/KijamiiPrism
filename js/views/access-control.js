/**
 * Access Control — accounts and roles, read live from Supabase.
 *
 * This page runs on real data today: it reads `profiles`, which RLS limits to
 * the caller's own row unless they are an admin. A member seeing one row is
 * the policy working, not the page failing, so the page says so.
 */
import { el, clear, formatDate } from '../ui/dom.js';
import { getState, isAdmin, setState } from '../state.js';
import { loadTeam, setRole } from '../auth.js';
import { pageHeader, panel, kpiRow, tag } from '../ui/page.js';
import { reportError, toast } from '../ui/toast.js';
import { ADMIN_EMAIL } from '../config.js';

const POLICIES = [
  ['profiles', 'Own row, or all rows for an admin', 'Admin only', 'Role changes blocked by trigger'],
  ['clients', 'Any signed-in user', 'Any signed-in user', 'Admin only'],
  ['projects', 'Any signed-in user', 'Any signed-in user', 'Admin only'],
  ['tasks', 'Any signed-in user', 'Any signed-in user', 'Admin only'],
];

function roleControl(member, profile, admin, onDone) {
  const isDesignated = member.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (!admin) return tag(member.role, member.role === 'admin' ? 'accent' : 'neutral');

  return el(
    'select',
    {
      class: `pill-select pill--${member.role === 'admin' ? 'accent' : 'neutral'}`,
      'aria-label': `Role for ${member.full_name || member.email}`,
      // The designated admin is re-applied by a database trigger on every
      // sign-up, so a demotion here would silently revert. Better to disable
      // the control than to offer a change that does not hold.
      disabled: isDesignated,
      title: isDesignated ? 'Assigned automatically by the database' : undefined,
      onChange: async (event) => {
        const next = event.target.value;
        try {
          await setRole(member.id, next);
          setState({ team: await loadTeam() });
          toast.success(`${member.full_name || member.email} is now ${next}.`);
          onDone?.();
        } catch (error) {
          reportError(error);
          event.target.value = member.role;
        }
      },
    },
    [
      el('option', { value: 'member', text: 'member', selected: member.role === 'member' }),
      el('option', { value: 'admin', text: 'admin', selected: member.role === 'admin' }),
    ]
  );
}

export function renderAccessControl(root, view) {
  const { team, profile } = getState();
  const admin = isAdmin();
  clear(root);

  const rows = team.length ? team : profile ? [profile] : [];
  const admins = rows.filter((r) => r.role === 'admin').length;

  root.append(
    pageHeader(view),

    kpiRow([
      { label: 'Accounts visible', value: String(rows.length), meta: admin ? 'All accounts' : 'Limited to your own row by RLS' },
      { label: 'Admins', value: String(admins), meta: 'Full read and delete rights' },
      { label: 'Members', value: String(rows.length - admins), meta: 'Read and write, no delete' },
      { label: 'Your role', value: profile?.role ?? '—', meta: 'Assigned by the database' },
    ]),

    panel({
      eyebrow: 'Accounts',
      title: 'Who has access',
      body: el('div', { class: 'table-wrap' }, [
        el('table', { class: 'table' }, [
          el('thead', {}, [
            el('tr', {}, [
              el('th', { text: 'Name' }),
              el('th', { text: 'Email' }),
              el('th', { text: 'Role' }),
              el('th', { text: 'Joined' }),
            ]),
          ]),
          el(
            'tbody',
            {},
            rows.map((m) =>
              el('tr', {}, [
                el('td', {}, [
                  el('p', { class: 'table__title', text: m.full_name || '—' }),
                  m.id === profile?.id && el('p', { class: 'table__sub', text: 'That is you' }),
                ]),
                el('td', { class: 'table__muted', text: m.email }),
                el('td', {}, [roleControl(m, profile, admin, () => renderAccessControl(root, view))]),
                el('td', { class: 'table__muted', text: formatDate(m.created_at) }),
              ])
            )
          ),
        ]),
      ]),
      footnote: admin
        ? 'Role changes take effect on the account’s next request.'
        : 'Row Level Security limits profile reads to your own row. An admin sees every account here.',
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
        'These are Postgres policies, not interface rules. Editing the client-side JavaScript changes what is displayed, never what is permitted.',
    })
  );
}
