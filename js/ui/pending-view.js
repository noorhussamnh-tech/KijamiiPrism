/**
 * The screen an unapproved account sees.
 *
 * Without this, someone who signs up lands on a dashboard where every figure
 * reads zero — because RLS is correctly returning nothing — and reasonably
 * concludes the product is broken. Saying plainly that the account is pending
 * is both more honest and less alarming than a wall of zeros.
 */
import { el, clear } from './dom.js';
import { APP_VERSION } from '../config.js';

export function renderPendingView(root, { profile, onSignOut }) {
  clear(root);

  root.append(
    el('div', { class: 'auth' }, [
      el('div', { class: 'auth__brand' }, [
        el('span', { class: 'brand__prism', 'aria-hidden': 'true' }),
        el('p', { class: 'brand__name' }, [
          el('span', { class: 'brand__kijamii', text: 'KIJAMII ' }),
          el('span', { class: 'brand__word', text: 'PRISM' }),
        ]),
      ]),

      el('div', { class: 'auth__card' }, [
        el('div', { class: 'auth__confirm' }, [
          el('div', { class: 'auth__confirm-mark', text: '⏳' }),
          el('h2', { class: 'auth__title', text: 'Waiting for approval' }),
          el('p', { class: 'auth__lede' }, [
            'Your account ',
            el('strong', { text: profile?.email ?? '' }),
            ' exists, but it has not been given access to the record yet.',
          ]),
          el('p', {
            class: 'auth__lede',
            text: 'An administrator has to approve it. Once they do, sign in again and everything will be here.',
          }),
          el('button', {
            class: 'btn btn--ghost btn--block',
            type: 'button',
            text: 'Sign out',
            onClick: onSignOut,
          }),
        ]),
      ]),

      el('p', {
        class: 'brand__ver',
        text: `${APP_VERSION} · access is granted per account, not per link`,
      }),
    ]),
  );
}
