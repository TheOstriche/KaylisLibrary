import { html, render, toast, onSubmit } from '../ui.js';
import { books } from '../repo.js';
import { cover, bookcaseOptions } from '../components.js';
import { normalizeIsbn } from '../isbn.js';
import { lookupBook, lookupErrors } from '../lookup.js';
import { openScanner, closeScanner } from '../scanner.js';
import { settings, saveSettings } from '../store.js';

// Books added since the app was opened, newest first, so mistakes can be undone.
const addedThisSession = [];

export function addPage(view) {
    const spot = settings.addLocation;

    render(view, html`
        <div class="page-head">
            <h1>Add books</h1>
            <a class="small" href="#/add/manual">No barcode?</a>
        </div>
        <section class="card">
            <p class="small muted">Set where you’re shelving, then scan book after book.
                The location stays set until you change it.</p>
            ${bookcaseOptions(books.bookcases())}
            <div class="location-fields">
                <label>Bookcase <input name="bookcase" value="${spot.bookcase}" list="bookcase-options" autocomplete="off"></label>
                <label>Shelf <input name="shelf" type="number" inputmode="numeric" min="1" value="${spot.shelf}" class="shelf-input"></label>
            </div>
            <button type="button" class="btn btn-large btn-block" data-scan>Scan books</button>
            <form class="isbn-form" data-isbn>
                <input name="isbn" inputmode="numeric" autocomplete="off" placeholder="…or type the ISBN" required>
                <button class="btn btn-ghost">Add</button>
            </form>
        </section>

        ${addedThisSession.length ? html`
            <section class="card">
                <h2>Just added</h2>
                <div class="list">
                    ${addedThisSession.map((entry) => {
                        const book = books.find(entry.bookId);
                        return book ? html`
                            <div class="list-item">
                                ${cover(book, 'small')}
                                <a class="list-item-body" href="#/books/${book.id}">
                                    <strong>${book.title}</strong>
                                    <span class="small muted">${entry.bookcase} · shelf ${entry.shelf}</span>
                                </a>
                                <button type="button" class="btn btn-small btn-danger-ghost" data-undo="${entry.copyId}">Undo</button>
                            </div>` : '';
                    })}
                </div>
            </section>` : ''}
    `);

    const bookcaseInput = view.querySelector('[name=bookcase]');
    const shelfInput = view.querySelector('[name=shelf]');
    const rememberLocation = () => saveSettings({
        addLocation: { bookcase: bookcaseInput.value.trim(), shelf: shelfInput.value.trim() },
    });
    bookcaseInput.addEventListener('change', rememberLocation);
    shelfInput.addEventListener('change', rememberLocation);

    /** Adds one scanned book. Returns { type, message } for display. */
    const add = async (code) => {
        const bookcase = bookcaseInput.value.trim();
        const shelf = Number(shelfInput.value);
        if (!bookcase || !(shelf >= 1)) {
            throw new Error('Set the bookcase and shelf first.');
        }
        const isbn = normalizeIsbn(code);

        let book = books.findByIsbn(isbn);
        let message;
        if (book) {
            message = `Added another copy of “${book.title}”.`;
        } else {
            const details = await lookupBook(isbn);
            if (!details) {
                await closeScanner();
                const why = lookupErrors.length ? ` (${lookupErrors.join('; ')})` : '';
                toast(`Couldn’t find ${isbn} online${why}. Please enter it by hand.`, 'info');
                location.hash = `#/add/manual?isbn=${isbn}`;
                return null;
            }
            book = books.find(books.create({ isbn, ...details }));
            message = `Added “${book.title}”.`;
        }
        const copyId = books.addCopy(book.id, bookcase, shelf);
        addedThisSession.unshift({ bookId: book.id, copyId, bookcase, shelf });
        return { type: 'success', message };
    };

    view.querySelector('[data-scan]').addEventListener('click', () => {
        if (!bookcaseInput.value.trim() || !shelfInput.value) {
            toast('Set the bookcase and shelf first.', 'error');
            (bookcaseInput.value.trim() ? shelfInput : bookcaseInput).focus();
            return;
        }
        openScanner({
            title: `Adding to ${bookcaseInput.value.trim()} · shelf ${shelfInput.value}`,
            continuous: true,
            async onCode(code) {
                const result = await add(code);
                if (result && location.hash === '#/add') addPage(view); // refresh "Just added"
                return result;
            },
        });
    });

    onSubmit(view.querySelector('[data-isbn]'), async ({ isbn }) => {
        const result = await add(isbn);
        if (result) {
            toast(result.message, result.type);
            addPage(view);
            view.querySelector('[name=isbn]').focus();
        }
    });

    view.querySelectorAll('[data-undo]').forEach((button) => button.addEventListener('click', () => {
        const copyId = Number(button.dataset.undo);
        try {
            books.deleteCopy(copyId);
            addedThisSession.splice(addedThisSession.findIndex((e) => e.copyId === copyId), 1);
            toast('Undone.', 'info');
            addPage(view);
        } catch (error) {
            toast(error.message, 'error');
        }
    }));
}
