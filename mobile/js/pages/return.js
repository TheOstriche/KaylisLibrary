import { html, render, toast, onSubmit } from '../ui.js';
import { loans } from '../repo.js';
import { loanList, returnByIsbn } from '../components.js';
import { openScanner } from '../scanner.js';
import { circulationTabs } from './lend.js';

export function returnPage(view) {
    const out = loans.active();

    render(view, html`
        ${circulationTabs('return')}
        <section class="card">
            <h1>Return books</h1>
            <button type="button" class="btn btn-large btn-block" data-scan>Scan books back</button>
            <form class="isbn-form" data-isbn>
                <input name="isbn" inputmode="numeric" autocomplete="off" placeholder="…or type the ISBN" required>
                <button class="btn btn-ghost">Return</button>
            </form>
        </section>

        <section class="card">
            <h2>Lent out</h2>
            ${out.length ? loanList(out) : html`<p class="muted">Every book is on its shelf.</p>`}
        </section>
    `);

    // The camera stays open so a stack of returned books can be scanned one after another.
    view.querySelector('[data-scan]').addEventListener('click', () => openScanner({
        title: 'Scan each returned book',
        continuous: true,
        onCode(code) {
            const result = returnByIsbn(code);
            returnPage(view); // refresh the list underneath
            return result;
        },
    }));

    onSubmit(view.querySelector('[data-isbn]'), ({ isbn }, form) => {
        const result = returnByIsbn(isbn);
        toast(result.message, result.type);
        form.reset();
        if (result.type === 'success') returnPage(view);
    });
}
