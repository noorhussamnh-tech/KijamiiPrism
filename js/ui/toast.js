import { el } from './dom.js';

let host = null;

function ensureHost() {
  if (!host) {
    host = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  return host;
}

function show(message, variant) {
  const node = el('div', { class: `toast toast--${variant}`, text: message });
  ensureHost().append(node);

  setTimeout(() => {
    node.classList.add('toast--leaving');
    node.addEventListener('transitionend', () => node.remove(), { once: true });
  }, 4000);
}

export const toast = {
  success: (message) => show(message, 'success'),
  error: (message) => show(message, 'error'),
  info: (message) => show(message, 'info'),
};

/**
 * Surface a thrown error without leaking raw Postgres noise at the user.
 * RLS denials arrive as 42501 or as a zero-row result; both mean the same
 * thing to someone using the app.
 */
export function reportError(error, fallback = 'Something went wrong.') {
  const code = error?.code;
  if (code === '42501' || code === 'PGRST301') {
    toast.error('Not permitted — an admin has to do that.');
    return;
  }
  toast.error(error?.message || fallback);
  console.error(error);
}
