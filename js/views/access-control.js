/**
 * Access Control — accounts and roles, read live from Supabase.
 *
 * This page runs on real data today: it reads `profiles`, which RLS limits to
 * the caller's own row unless they are an admin. A member seeing one row is
 * the policy working, not the page failing, so the page says so.
 */
import { el, clear, formatDate } from '../ui/dom.js';
import { getState, isAdmin, setState } from '../state.js';
import { loadTeam, setRole, setApproval } from '../auth.js';
import { pageHeader, panel, kpiRow, tag } from '../ui/page.js';
import { reportError, toast } from '../ui/toast.js';
import { ADMIN_EMAIL } from '../config.js';

const POLICIES = [
  ['profiles', 'Own row, or all rows for an admin', 'Own row', 'Admin only'],
  ['prism_job_book_entries', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_time_dedication', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_scope_lines', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_clients / employees', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
  ['prism_sync_runs / issues', 'Approved accounts only', 'Nobody — sync writes as service_role', 'Nobody'],
];

/** Approval toggle. Disabled for admins, who are approved by definition. */
function approvalControl(member, admin, onDone) {
  if (!admin) {
    return el('span', {
      class: member.is_approved ? 'tag tag--accent' : 'tag tag--note',
      text: member.is_approved ? 'approved' : 'pending',
    });
  }
  return el('button', {
    class: member.is_approved ? 'btn btn--ghost btn--sm' : 'btn btn--primary btn--sm',
    type: 'button',
    text: member.is_approved ? 'Revoke' : 'Approve',
    disabled: member.role === 'admin',
    title: member.role === 'admin' ? 'Admins are approved by definition' : undefined,
    onClick: async (event) => {
      event.currentTarget.disabled = true;
      try {
        await setApproval(member.id, !member.is_approved);
        setState({ team: await loadTeam() });
        toast.success(
          member.is_approved
            ? `${member.full_name || member.email} can no longer read the record.`
            : `${member.full_name || member.email} now has access.`,
        );
        onDone?.();
      } catch (error) {
        reportError(error);
        event.currentTarget.disabled = false;
      }
    },
  });
}

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
  const pending = rows.filter((r) => !r.is_approved && r.role !== 'admin').length;

  root.append(
    pageHeader(view),

    kpiRow([
      { label: 'Accounts visible', value: String(rows.length),
        meta: admin ? 'All accounts' : 'Limited to your own row by RLS' },
      { label: 'Approved', value: String(rows.length - pending),
        meta: 'Can read the record' },
      { label: 'Awaiting approval', value: String(pending),
        meta: 'Signed up, sees nothing yet', tone: pending ? 'note' : undefined },
      { label: 'Admins', value: String(admins), meta: 'Approve accounts and change roles' },
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
              el('th', { text: 'Access' }),
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
                el('td', {}, [approvalControl(m, admin, () => renderAccessControl(root, view))]),
                el('td', { class: 'table__muted', text: formatDate(m.created_at) }),
              ])
            )
          ),
        ]),
      ]),
      footnote: admin
        ? 'New sign-ups arrive pending and read nothing until approved here. Changes take effect on the account’s next request.'
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
