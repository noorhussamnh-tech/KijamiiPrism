/**
 * Boardroom Mode — the reduced presentation state.
 *
 * The mode itself is a data attribute on <html> that scales the type ramp and
 * hides controls; this page explains it and provides the switch. Keeping the
 * toggle in the top bar as well means it is reachable from any view mid-meeting.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel } from '../ui/page.js';

const BEHAVIOUR = [
  ['Type scales up', 'The whole ramp grows, so a figure readable at a desk stays readable from the far end of a room.'],
  ['Controls recede', 'Filters and segmented switches dim. The selection is already made before the room is watching.'],
  ['Nothing else changes', 'Same data, same rules, same page. Boardroom mode is a presentation state, never a different reading of the record.'],
];

function isOn() {
  return document.documentElement.dataset.boardroom === 'true';
}

export function renderBoardroom(root, view) {
  clear(root);

  const status = el('p', {
    class: 'board__status',
    text: isOn() ? 'Boardroom mode is on' : 'Boardroom mode is off',
  });

  const button = el('button', {
    class: 'btn btn--primary',
    type: 'button',
    text: isOn() ? 'Turn off boardroom mode' : 'Turn on boardroom mode',
    onClick: () => {
      document.documentElement.dataset.boardroom = isOn() ? 'false' : 'true';
      renderBoardroom(root, view);
    },
  });

  root.append(
    pageHeader(view),

    panel({
      eyebrow: 'Presentation',
      title: 'Sized for the room',
      body: el('div', { class: 'board' }, [
        status,
        button,
        el('p', {
          class: 'board__hint',
          text: 'The BOARDROOM control in the top bar does the same thing from any page.',
        }),
      ]),
    }),

    panel({
      eyebrow: 'Behaviour',
      title: 'What changes when it is on',
      body: el(
        'dl',
        { class: 'deflist' },
        BEHAVIOUR.flatMap(([term, def]) => [
          el('dt', { class: 'deflist__t', text: term }),
          el('dd', { class: 'deflist__d', text: def }),
        ])
      ),
    })
  );
}
