import { html, render, toast, niceDate, today, onSubmit } from '../ui.js';
import { books } from '../repo.js';
import { cover, bookcaseOptions, returnLoan } from '../components.js';

export function bookPage(view, [id]) {
    const book = books.find(id);
    if (!book) {
        render(view, html`<div class="card center"><p>That book was removed.</p><a class="btn" href="#/books">Catalog</a></div>`);
        return;
    }
    const copies = books.copies(id);
    const refresh = () => bookPage(view, [id]);

    render(view, html`
        <a class="back" href="#/books">‹ Catalog</a>

        <section class="card book-detail">
            ${cover(book, 'large')}
            <div>
                <h1>${book.title}</h1>
                <p class="lead">${book.authors || 'Unknown author'}</p>
                <dl class="facts">
                    ${book.isbn ? html`<dt>ISBN</dt><dd>${book.isbn}</dd>` : ''}
                    ${book.publisher ? html`<dt>Publisher</dt><dd>${book.publisher}</dd>` : ''}
                    ${book.published_date ? html`<dt>Published</dt><dd>${book.published_date}</dd>` : ''}
                    ${book.page_count ? html`<dt>Pages</dt><dd>${book.page_count}</dd>` : ''}
                    <dt>Added</dt><dd>${niceDate(book.created_at)}</dd>
                </dl>
            </div>
        </section>
        ${book.description ? html`
            <details class="card"><summary>Description</summary><p>${book.description.replace(/<[^>]+>/g, '')}</p></details>` : ''}

        <section class="card">
            <h2>${copies.length === 1 ? 'Copy' : `${copies.length} copies`}</h2>
            ${bookcaseOptions(books.bookcases())}
            ${copies.map((copy) => html`
                <div class="copy">
                    <div class="copy-status">
                        ${copy.loan_id
                            ? html`<span class="badge ${copy.due_date < today() ? 'badge-danger' : 'badge-warn'}">
                                       With <a href="#/people/${copy.borrower_id}">${copy.borrower_name}</a>,
                                       due ${niceDate(copy.due_date)}</span>`
                            : html`<span class="badge badge-ok">On the shelf</span>`}
                        <span class="copy-actions">
                            ${copy.loan_id
                                ? html`<button type="button" class="btn btn-small" data-return="${copy.loan_id}">Return</button>`
                                : html`<a class="btn btn-small" href="#/lend/${book.id}">Lend</a>`}
                        </span>
                    </div>
                    <form class="inline-form" data-move="${copy.id}">
                        <input name="bookcase" value="${copy.bookcase}" list="bookcase-options" aria-label="Bookcase" required>
                        <input name="shelf" type="number" inputmode="numeric" min="1" value="${copy.shelf}" aria-label="Shelf" class="shelf-input" required>
                        <button class="btn btn-small btn-ghost">Move</button>
                        ${!copy.loan_id && copy.loan_history_count === 0
                            ? html`<button type="button" class="btn btn-small btn-danger-ghost" data-remove="${copy.id}">Remove</button>` : ''}
                    </form>
                </div>`)}

            <form class="inline-form add-copy" data-add-copy>
                <input name="bookcase" placeholder="Bookcase" list="bookcase-options" required>
                <input name="shelf" type="number" inputmode="numeric" min="1" placeholder="Shelf" class="shelf-input" required>
                <button class="btn btn-small">Add copy</button>
            </form>
        </section>

        <details class="card">
            <summary>Fix title or author</summary>
            <form class="stack" data-edit>
                <label>Title <input name="title" value="${book.title}" required></label>
                <label>Author(s) <input name="authors" value="${book.authors ?? ''}"></label>
                <div><button class="btn">Save</button></div>
            </form>
        </details>
    `);

    view.querySelectorAll('[data-move]').forEach((form) => onSubmit(form, ({ bookcase, shelf }) => {
        books.moveCopy(Number(form.dataset.move), bookcase, Number(shelf));
        toast(`Moved to ${bookcase} · shelf ${shelf}.`);
        refresh();
    }));

    view.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
        const last = copies.length === 1;
        if (!confirm(last ? 'Remove this book from the catalog?' : 'Remove this copy?')) return;
        try {
            const bookGone = books.deleteCopy(Number(button.dataset.remove));
            toast(bookGone ? 'Book removed.' : 'Copy removed.');
            if (bookGone) location.hash = '#/books'; else refresh();
        } catch (error) {
            toast(error.message, 'error');
        }
    }));

    view.querySelectorAll('[data-return]').forEach((button) => button.addEventListener('click', () => {
        const result = returnLoan(Number(button.dataset.return));
        toast(result.message, result.type);
        refresh();
    }));

    onSubmit(view.querySelector('[data-add-copy]'), ({ bookcase, shelf }) => {
        books.addCopy(id, bookcase, Number(shelf));
        toast(`Added a copy on ${bookcase} · shelf ${shelf}.`);
        refresh();
    });

    onSubmit(view.querySelector('[data-edit]'), ({ title, authors }) => {
        books.updateDetails(id, title, authors);
        toast('Saved.');
        refresh();
    });
}
