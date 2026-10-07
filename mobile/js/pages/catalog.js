import { html, render, toast } from '../ui.js';
import { books } from '../repo.js';
import { bookRow } from '../components.js';
import { normalizeIsbn } from '../isbn.js';
import { openScanner } from '../scanner.js';

export function catalogPage(view, params, query) {
    const bookcaseNames = books.bookcases();

    render(view, html`
        <div class="page-head">
            <h1>Catalog</h1>
            <button type="button" class="btn btn-small" data-scan>Scan to find</button>
        </div>
        <div class="filters">
            <input type="search" name="q" value="${query.get('q') ?? ''}" placeholder="Title, author or ISBN"
                   autocomplete="off" autocorrect="off">
            <select name="bookcase">
                <option value="">All bookcases</option>
                ${bookcaseNames.map((name) => html`
                    <option value="${name}" ${name === query.get('bookcase') ? 'selected' : ''}>${name}</option>`)}
            </select>
        </div>
        <p class="muted small" data-count></p>
        <div class="list" data-results></div>
    `);

    const search = view.querySelector('[name=q]');
    const bookcase = view.querySelector('[name=bookcase]');

    // Results update as you type.
    const show = () => {
        const results = books.search(search.value.trim(), bookcase.value);
        view.querySelector('[data-count]').textContent = `${results.length} ${results.length === 1 ? 'book' : 'books'}`;
        render(view.querySelector('[data-results]'), results.length
            ? results.map(bookRow)
            : html`<div class="card center muted">No books found.</div>`);
        // Remember the filters in the address so "back" from a book returns to the same list.
        const q = new URLSearchParams();
        if (search.value.trim()) q.set('q', search.value.trim());
        if (bookcase.value) q.set('bookcase', bookcase.value);
        const qs = q.toString();
        history.replaceState(null, '', '#/books' + (qs ? '?' + qs : ''));
    };
    search.addEventListener('input', show);
    bookcase.addEventListener('change', show);
    show();

    view.querySelector('[data-scan]').addEventListener('click', () => openScanner({
        title: 'Scan a book to find it',
        onCode(code) {
            try {
                const book = books.findByIsbn(normalizeIsbn(code));
                if (book) {
                    location.hash = `#/books/${book.id}`;
                } else {
                    toast('That book isn’t in the catalog yet.', 'info');
                }
            } catch (error) {
                toast(error.message, 'error');
            }
        },
    }));
}
