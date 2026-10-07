// Small helpers for building pages safely and formatting dates.

// ----- Safe HTML --------------------------------------------------------------------------
// html`<p>${value}</p>` escapes every ${value}, so book titles or names can never break the page.
// Nested html`...` results (and arrays of them) are inserted as-is.

const RAW = Symbol('raw');

export const raw = (markup) => ({ [RAW]: String(markup) });

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function toMarkup(value) {
    if (value === null || value === undefined || value === false) return '';
    if (Array.isArray(value)) return value.map(toMarkup).join('');
    if (typeof value === 'object' && RAW in value) return value[RAW];
    return escapeHtml(value);
}

export function html(strings, ...values) {
    return raw(strings.reduce((out, part, i) => out + part + (i < values.length ? toMarkup(values[i]) : ''), ''));
}

export function render(element, template) {
    element.innerHTML = toMarkup(template);
}

// ----- Messages ---------------------------------------------------------------------------

/** Brief message at the bottom of the screen. type: success | error | info */
export function toast(message, type = 'success') {
    const box = document.getElementById('toasts');
    const item = document.createElement('div');
    item.className = `toast toast-${type}`;
    item.textContent = message;
    box.append(item);
    setTimeout(() => item.classList.add('hide'), type === 'error' ? 5000 : 3500);
    setTimeout(() => item.remove(), type === 'error' ? 5500 : 4000);
}

// ----- Dates (stored like "2026-10-06 14:30:00", the same as the laptop app) ---------------

const pad = (n) => String(n).padStart(2, '0');
const dateOnly = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => dateOnly(new Date());
export const now = () => {
    const d = new Date();
    return `${dateOnly(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return dateOnly(d);
}

/** "Oct 6, 2026" */
export function niceDate(value) {
    if (!value) return '';
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ----- Forms ------------------------------------------------------------------------------

/** Trimmed text values from a form, as an object keyed by input name. */
export function formValues(form) {
    return Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
}

/** Call handler(values, form) when the form is submitted, without reloading the page. */
export function onSubmit(form, handler) {
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('button[type=submit], button:not([type])');
        if (button) button.disabled = true;
        try {
            await handler(formValues(form), form);
        } catch (error) {
            toast(error.message, 'error');
            console.error(error);
        } finally {
            if (button) button.disabled = false;
        }
    });
}
