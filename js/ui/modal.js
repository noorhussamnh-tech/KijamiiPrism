/**
 * A form dialog built on the native <dialog> element, so focus trapping,
 * Escape-to-close and the backdrop come from the platform rather than from
 * hand-rolled JavaScript.
 */
import { el, clear } from './dom.js';

/**
 * @param {object} options
 * @param {string} options.title
 * @param {Array}  options.fields   field descriptors, see fieldNode below
 * @param {object} options.values   initial values keyed by field name
 * @param {string} options.submitLabel
 * @param {(values: object) => Promise<void>} options.onSubmit
 */
export function openForm({ title, fields, values = {}, submitLabel = 'Save', onSubmit }) {
  const dialog = el('dialog', { class: 'modal' });

  const form = el('form', { class: 'modal__form', method: 'dialog' });
  const error = el('p', { class: 'modal__error', hidden: true });

  form.append(
    el('h2', { class: 'modal__title', text: title }),
    ...fields.map((f) => fieldNode(f, values[f.name])),
    error,
    el('div', { class: 'modal__actions' }, [
      el('button', {
        class: 'btn btn--ghost',
        type: 'button',
        text: 'Cancel',
        onClick: () => dialog.close(),
      }),
      el('button', { class: 'btn btn--primary', type: 'submit', text: submitLabel }),
    ])
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    error.hidden = true;

    const payload = {};
    for (const f of fields) {
      const raw = form.elements[f.name].value;
      // Empty optional inputs become null, not '' — a date column will not
      // accept an empty string, and '' for text reads as "set to blank"
      // rather than "not provided".
      payload[f.name] = raw === '' ? null : f.type === 'number' ? Number(raw) : raw;
    }

    try {
      await onSubmit(payload);
      dialog.close();
    } catch (err) {
      error.textContent = err?.message ?? 'Could not save.';
      error.hidden = false;
      submit.disabled = false;
    }
  });

  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();

  return dialog;
}

function fieldNode(f, value) {
  const id = `f_${f.name}`;
  let control;

  if (f.type === 'select') {
    control = el(
      'select',
      { class: 'input', id, name: f.name, required: f.required ?? false },
      f.options.map((o) =>
        el('option', {
          value: o.value,
          text: o.label,
          selected: String(o.value) === String(value ?? f.value ?? ''),
        })
      )
    );
  } else if (f.type === 'textarea') {
    control = el('textarea', {
      class: 'input input--area',
      id,
      name: f.name,
      rows: f.rows ?? 3,
      required: f.required ?? false,
      placeholder: f.placeholder ?? '',
      value: value ?? '',
    });
  } else {
    control = el('input', {
      class: 'input',
      id,
      name: f.name,
      type: f.type ?? 'text',
      required: f.required ?? false,
      placeholder: f.placeholder ?? '',
      value: value ?? '',
    });
  }

  return el('label', { class: 'field', for: id }, [
    el('span', { class: 'field__label', text: f.label }),
    control,
  ]);
}

/** A small yes/no dialog for destructive actions. */
export function confirmAction({ title, message, confirmLabel = 'Delete', onConfirm }) {
  const dialog = el('dialog', { class: 'modal modal--confirm' });

  dialog.append(
    el('div', { class: 'modal__form' }, [
      el('h2', { class: 'modal__title', text: title }),
      el('p', { class: 'modal__message', text: message }),
      el('div', { class: 'modal__actions' }, [
        el('button', {
          class: 'btn btn--ghost',
          type: 'button',
          text: 'Cancel',
          onClick: () => dialog.close(),
        }),
        el('button', {
          class: 'btn btn--danger',
          type: 'button',
          text: confirmLabel,
          onClick: async (event) => {
            event.currentTarget.disabled = true;
            try {
              await onConfirm();
            } finally {
              dialog.close();
            }
          },
        }),
      ]),
    ])
  );

  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
