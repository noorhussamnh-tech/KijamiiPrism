/**
 * The sign-in gate. Rendered whenever there is no session; the dashboard shell
 * is never built without one.
 */
import { el, clear } from './dom.js';
import { reportError, toast } from './toast.js';
import { signIn, signUp } from '../auth.js';

let mode = 'signin'; // 'signin' | 'signup' | 'confirm'
let pendingEmail = '';

function field({ id, label, type = 'text', autocomplete, required = true, placeholder }) {
  return el('label', { class: 'field', for: id }, [
    el('span', { class: 'field__label', text: label }),
    el('input', { class: 'input', id, name: id, type, required, autocomplete, placeholder }),
  ]);
}

function confirmPanel() {
  return el('div', { class: 'auth__confirm' }, [
    el('div', { class: 'auth__confirm-mark', text: '✓' }),
    el('h2', { class: 'auth__title', text: 'Check your email' }),
    el('p', { class: 'auth__lede' }, [
      'We sent a confirmation link to ',
      el('strong', { text: pendingEmail }),
      '. Open it, then come back and sign in.',
    ]),
    el('button', {
      class: 'btn btn--ghost',
      type: 'button',
      text: 'Back to sign in',
      onClick: () => {
        mode = 'signin';
        rerender();
      },
    }),
  ]);
}

function formPanel() {
  const isSignup = mode === 'signup';

  const form = el('form', { class: 'auth__form', novalidate: false }, [
    el('h2', {
      class: 'auth__title',
      text: isSignup ? 'Create your account' : 'Sign in',
    }),
    el('p', {
      class: 'auth__lede',
      text: isSignup
        ? 'Use your work address. Roles are assigned automatically.'
        : 'Kijamii team access.',
    }),
    isSignup &&
      field({ id: 'full_name', label: 'Full name', autocomplete: 'name', placeholder: 'Noor Suleiman' }),
    field({
      id: 'email',
      label: 'Email',
      type: 'email',
      autocomplete: 'email',
      placeholder: 'you@kijamii.com',
    }),
    field({
      id: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: isSignup ? 'new-password' : 'current-password',
      placeholder: isSignup ? 'At least 6 characters' : '',
    }),
    el('button', {
      class: 'btn btn--primary btn--block',
      type: 'submit',
      text: isSignup ? 'Create account' : 'Sign in',
    }),
    el('p', { class: 'auth__switch' }, [
      isSignup ? 'Already have an account? ' : 'No account yet? ',
      el('button', {
        class: 'linkbtn',
        type: 'button',
        text: isSignup ? 'Sign in' : 'Create one',
        onClick: () => {
          mode = isSignup ? 'signin' : 'signup';
          rerender();
        },
      }),
    ]),
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submit = form.querySelector('button[type="submit"]');
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const fullName = isSignup ? form.elements.full_name.value.trim() : undefined;

    submit.disabled = true;
    submit.textContent = isSignup ? 'Creating…' : 'Signing in…';

    try {
      if (isSignup) {
        const { needsConfirmation } = await signUp(email, password, fullName);
        if (needsConfirmation) {
          pendingEmail = email;
          mode = 'confirm';
          rerender();
          return;
        }
        toast.success('Account created.');
      } else {
        await signIn(email, password);
      }
      // On success main.js reacts to the auth state change and swaps the view.
    } catch (error) {
      reportError(error, 'Could not sign you in.');
      submit.disabled = false;
      submit.textContent = isSignup ? 'Create account' : 'Sign in';
    }
  });

  return form;
}

let mountPoint = null;

function rerender() {
  if (mountPoint) renderAuthView(mountPoint);
}

export function renderAuthView(root) {
  mountPoint = root;
  clear(root);

  root.append(
    el('div', { class: 'auth' }, [
      el('div', { class: 'auth__brand' }, [
        el('span', { class: 'logo-dot' }),
        el('span', { class: 'auth__wordmark', text: 'Kijamii Prism' }),
      ]),
      el('p', { class: 'auth__tagline' }, [
        'Agency operations, ',
        el('em', { text: 'in one place' }),
        '.',
      ]),
      el('div', { class: 'auth__card' }, [mode === 'confirm' ? confirmPanel() : formPanel()]),
    ])
  );
}
