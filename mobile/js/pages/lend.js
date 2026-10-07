// Lending happens in two steps:
//   #/lend        pick the book (scan it, or type/Bluetooth-scan the ISBN)
//   #/lend/<id>   pick the borrower by email; new emails get a name + phone
import { html, render, toast, niceDate, onSubmit } from '../ui.js';
import { books, users, loans, normalizeEmail, isValidEmail } from '../repo.js';
import { cover } from '../components.js';
import { normalizeIsbn } from '../isbn.js';
import { openScanner } from '../scanner.js';
import { CONFIG } from '../config.js';

export function circulationTabs(active) {
    return html`
        <div class="segmented">
            <a href="#/lend" class="${active === 'lend' ? 'active' : ''}">Lend</a>
            <a href="#/return" class="${active === 'return' ? 'active' : ''}">Return</a>
        </div>`;
}

export function lendPage(view, [bookId]) {
    if (bookId) {
        chooseBorrower(view, bookId);
    } else {
        chooseBook(view);
    }
}

// ----- Step 1: which book? ----------------------------------------------------------------

function chooseBook(view) {
    render(view, html`
        ${circulationTabs('lend')}
        <section class="card">
            <h1>Which book?</h1>
            <button type="button" class="btn btn-large btn-block" data-scan>Scan the barcode</button>
            <form class="isbn-form" data-isbn>
                <input name="isbn" inputmode="numeric" autocomplete="off" placeholder="…or type the ISBN" required>
                <button class="btn btn-ghost">Next</button>
            </form>
            <p class="small muted">You can also open any book in the <a href="#/books">catalog</a> and tap Lend.</p>
        </section>
    `);

    const pick = (code) => {
        try {
            const book = books.findByIsbn(normalizeIsbn(code));
            if (!book) {
                toast('That book isn’t in the catalog yet. Add it first.', 'error');
                return;
            }
            if (!loans.findAvailableCopy(book.id)) {
                const out = loans.activeForBook(book.id)[0];
                toast(out
                    ? `“${book.title}” is already lent to ${out.borrower_name} (due ${niceDate(out.due_date)}).`
                    : `“${book.title}” has no copies on the shelf.`, 'error');
                return;
            }
            location.hash = `#/lend/${book.id}`;
        } catch (error) {
            toast(error.message, 'error');
        }
    };

    view.querySelector('[data-scan]').addEventListener('click', () => openScanner({ title: 'Scan the book to lend', onCode: pick }));
    onSubmit(view.querySelector('[data-isbn]'), ({ isbn }) => pick(isbn));
}

// ----- Step 2: who's borrowing? -----------------------------------------------------------

function chooseBorrower(view, bookId) {
    const book = books.find(bookId);
    const copy = book && loans.findAvailableCopy(bookId);
    if (!copy) {
        toast(book ? `Every copy of “${book.title}” is lent out.` : 'That book was removed.', 'error');
        location.hash = '#/lend';
        return;
    }
    const people = users.allWithLoanCounts();
    const recent = users.recentBorrowers(6);

    render(view, html`
        ${circulationTabs('lend')}
        <section class="card book-mini">
            ${cover(book, 'small')}
            <div>
                <strong>${book.title}</strong>
                <span class="muted small">${book.authors || ''}</span>
                <span class="small">From ${copy.bookcase} · shelf ${copy.shelf}</span>
            </div>
        </section>

        <section class="card">
            <h1>Who’s borrowing it?</h1>
            ${recent.length ? html`
                <div class="chips">
                    ${recent.map((p) => html`<button type="button" class="chip" data-email="${p.email}">${p.name}</button>`)}
                </div>` : ''}
            <form class="stack" data-borrower novalidate>
                <label>Email
                    <input type="email" name="email" list="people-emails" autocomplete="off" autocapitalize="off" required>
                </label>
                <datalist id="people-emails">
                    ${people.map((p) => html`<option value="${p.email}">${p.name}</option>`)}
                </datalist>
                <p class="person-hint" data-hint></p>
                <div class="new-person" data-new hidden>
                    <p class="small muted">New borrower! Add their details:</p>
                    <label>Name <input name="name" autocomplete="off"></label>
                    <label>Phone <span class="muted small">(optional)</span> <input type="tel" name="phone" autocomplete="off"></label>
                </div>
                <button class="btn btn-large btn-block">Lend for ${CONFIG.loanDays} days</button>
            </form>
        </section>
    `);

    const form = view.querySelector('[data-borrower]');
    const emailInput = form.elements.email;
    const hint = view.querySelector('[data-hint]');
    const newPerson = view.querySelector('[data-new]');

    // As the email is typed, show who it belongs to, or ask for details if it's new.
    const update = () => {
        const email = normalizeEmail(emailInput.value);
        const person = isValidEmail(email) ? users.findByEmail(email) : null;
        hint.textContent = person ? `✓ ${person.name}${person.phone ? ' · ' + person.phone : ''}` : '';
        newPerson.hidden = !(isValidEmail(email) && !person);
    };
    emailInput.addEventListener('input', update);
    view.querySelectorAll('[data-email]').forEach((chip) => chip.addEventListener('click', () => {
        emailInput.value = chip.dataset.email;
        update();
    }));

    onSubmit(form, ({ email, name, phone }) => {
        email = normalizeEmail(email);
        if (!isValidEmail(email)) throw new Error('Please enter a valid email address.');

        let person = users.findByEmail(email);
        if (!person) {
            if (!name) {
                update();
                form.elements.name.focus();
                throw new Error('Please enter the new borrower’s name.');
            }
            person = users.find(users.create(email, name, phone));
        }

        const loanId = loans.checkOut(copy.id, person.id, CONFIG.loanDays);
        toast(`Lent “${book.title}” to ${person.name}. Due ${niceDate(loans.find(loanId).due_date)}.`);
        location.hash = '#/';
    });
}
