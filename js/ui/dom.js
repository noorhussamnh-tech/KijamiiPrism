/**
 * DOM helpers.
 *
 * `el` sets text through `textContent`, never `innerHTML`. Client names, task
 * titles and notes are typed by other people in a shared workspace, so they
 * are untrusted input; building markup from them by string concatenation is
 * how a stored XSS gets in.
 */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list') {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FMT.format(date);
}

/** Days until a date; negative means overdue. Null when there is no date. */
export function daysUntil(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

/** 'in_progress' -> 'In progress' */
export function humanise(value) {
  if (!value) return '';
  const spaced = String(value).replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function pill(text, variant = 'neutral') {
  return el('span', { class: `pill pill--${variant}`, text });
}
