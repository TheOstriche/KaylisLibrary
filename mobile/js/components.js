// Pieces of UI used on several pages, plus the shared lend/return actions.

import { html, niceDate, today } from './ui.js';
import { books, loans } from './repo.js';
import { normalizeIsbn } from './isbn.js';

/** Book cover, falling back to a plain green "spine" with the title. size: '' | 'small' | 'large' */
export function cover(book, size = '') {
    return html`
        <div class="cover ${size}">
            <span class="cover-fallback">${book.title.length > 40 ? book.title.slice(0, 39) + '…' : book.title}</span>
            ${book.cover_url ? html`<img src="${book.cover_url}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        </div>`;
}

/** One row in a list of books. */
export function bookRow(book) {
    const copies = Number(book.copy_count ?? 1);
    const available = Number(book.available_count ?? 1);
    return html`
        <a class="list-item" href="#/books/${book.id}">
            ${cover(book, 'small')}
            <span class="list-item-body">
                <strong>${book.title}</strong>
                <span class="muted">${book.authors || 'Unknown author'}</span>
                ${book.locations !== undefined ? html`<span class="small muted">${book.locations ?? 'No copies'}</span>` : ''}
            </span>
            ${book.copy_count !== undefined ? html`
                <span>${copies === 0
                    ? html`<span class="badge">No copies</span>`
                    : available > 0
                        ? html`<span class="badge badge-ok">${copies > 1 ? `${available}/${copies} in` : 'In'}</span>`
                        : html`<span class="badge badge-warn">Out</span>`}</span>` : ''}
        </a>`;
}

/** List of loans with Return buttons (handled by app.js via data-return-loan). */
export function loanList(list, { showBorrower = true } = {}) {
    if (!list.length) return '';
    return html`
        <div class="list">
            ${list.map((loan) => {
                const overdue = !loan.returned_at && loan.due_date < today();
                return html`
                    <div class="list-item">
                        ${cover(loan, 'small')}
                        <span class="list-item-body">
                            <a href="#/books/${loan.book_id}"><strong>${loan.title}</strong></a>
                            ${showBorrower ? html`<a class="small" href="#/people/${loan.user_id}">${loan.borrower_name}</a>` : ''}
                            <span class="small muted">
                                ${loan.returned_at
                                    ? `Returned ${niceDate(loan.returned_at)}`
                                    : html`Due ${niceDate(loan.due_date)} ${overdue ? html`<span class="badge badge-danger">Overdue</span>` : ''}`}
                            </span>
                        </span>
                        ${loan.returned_at ? '' : html`
                            <button type="button" class="btn btn-small" data-return-loan="${loan.id}">Return</button>`}
                    </div>`;
            })}
        </div>`;
}

export function bookcaseOptions(bookcaseNames) {
    return html`<datalist id="bookcase-options">${bookcaseNames.map((name) => html`<option value="${name}">`)}</datalist>`;
}

// ----- Shared actions ---------------------------------------------------------------------

/**
 * Return a book by ISBN. If several copies are out, returns the one out longest.
 * Returns { type, message } describing what happened.
 */
export function returnByIsbn(code) {
    const book = books.findByIsbn(normalizeIsbn(code));
    if (!book) return { type: 'error', message: 'That book isn’t in the catalog.' };
    const out = loans.activeForBook(book.id);
    if (!out.length) return { type: 'info', message: `“${book.title}” wasn’t lent out.` };
    return returnLoan(out[0].id);
}

export function returnLoan(loanId) {
    const loan = loans.find(loanId);
    if (!loan || loan.returned_at) return { type: 'info', message: 'Already returned.' };
    loans.markReturned(loanId);
    return {
        type: 'success',
        message: `Returned “${loan.title}” from ${loan.borrower_name}. It goes on ${loan.bookcase} · shelf ${loan.shelf}.`,
    };
}
