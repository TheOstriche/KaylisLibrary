import { html, render, toast, onSubmit } from '../ui.js';
import { books } from '../repo.js';
import { bookcaseOptions } from '../components.js';
import { normalizeIsbn } from '../isbn.js';
import { settings, saveSettings } from '../store.js';

export function manualPage(view, params, query) {
    const spot = settings.addLocation;

    render(view, html`
        <a class="back" href="#/add">‹ Add books</a>
        <section class="card">
            <h1>Add a book by hand</h1>
            <form class="stack" data-manual>
                ${bookcaseOptions(books.bookcases())}
                <label>Title <input name="title" required></label>
                <label>Author(s) <input name="authors" placeholder="e.g. Dr. Seuss"></label>
                <label>ISBN <span class="muted small">(optional)</span>
                    <input name="isbn" value="${query.get('isbn') ?? ''}" inputmode="numeric" autocomplete="off">
                </label>
                <div class="location-fields">
                    <label>Bookcase <input name="bookcase" value="${spot.bookcase}" list="bookcase-options" required></label>
                    <label>Shelf <input name="shelf" type="number" inputmode="numeric" min="1" value="${spot.shelf}" class="shelf-input" required></label>
                </div>
                <button class="btn btn-large btn-block">Add book</button>
            </form>
        </section>
    `);

    onSubmit(view.querySelector('[data-manual]'), async ({ title, authors, isbn, bookcase, shelf }) => {
        let cleanIsbn = null;
        if (isbn) {
            try {
                cleanIsbn = normalizeIsbn(isbn);
            } catch (error) {
                throw new Error(error.message + ' Leave the ISBN blank if the book doesn’t have one.');
            }
        }
        const existing = cleanIsbn ? books.findByIsbn(cleanIsbn) : null;
        const bookId = existing?.id ?? books.create({ isbn: cleanIsbn, title, authors, lookup_source: 'manual' });
        books.addCopy(bookId, bookcase, Number(shelf));
        await saveSettings({ addLocation: { bookcase, shelf } });
        toast(`Added “${existing?.title ?? title}”.`);
        location.hash = `#/books/${bookId}`;
    });
}
