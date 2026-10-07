import { html, render, toast, niceDate, onSubmit } from '../ui.js';
import { users, loans, normalizeEmail, isValidEmail } from '../repo.js';
import { loanList } from '../components.js';

export function peoplePage(view) {
    const people = users.allWithLoanCounts();

    render(view, html`
        <h1>People</h1>
        ${people.length ? html`
            <div class="list">
                ${people.map((p) => html`
                    <a class="list-item" href="#/people/${p.id}">
                        <span class="avatar">${p.name.slice(0, 1).toUpperCase()}</span>
                        <span class="list-item-body">
                            <strong>${p.name}</strong>
                            <span class="small muted">${p.email}</span>
                        </span>
                        <span>
                            ${p.books_overdue ? html`<span class="badge badge-danger">${p.books_overdue} overdue</span>`
                                : p.books_out ? html`<span class="badge badge-warn">${p.books_out} out</span>` : ''}
                        </span>
                    </a>`)}
            </div>`
        : html`<div class="card center muted">People appear here the first time you lend them a book.</div>`}
    `);
}

export function personPage(view, [id]) {
    const person = users.find(id);
    if (!person) {
        location.hash = '#/people';
        return;
    }
    const history = loans.forUser(id);

    render(view, html`
        <a class="back" href="#/people">‹ People</a>
        <section class="card">
            <h1>${person.name}</h1>
            <div class="button-row">
                <a class="btn btn-small" href="mailto:${person.email}">Email</a>
                ${person.phone ? html`
                    <a class="btn btn-small" href="tel:${person.phone}">Call</a>
                    <a class="btn btn-small" href="sms:${person.phone}">Text</a>` : ''}
            </div>
            <p class="small muted">Borrowing since ${niceDate(person.created_at)}</p>
        </section>

        <section class="card">
            <h2>Books</h2>
            ${history.length ? loanList(history, { showBorrower: false }) : html`<p class="muted">Nothing borrowed yet.</p>`}
        </section>

        <details class="card">
            <summary>Edit details</summary>
            <form class="stack" data-edit>
                <label>Email <input type="email" name="email" value="${person.email}" autocapitalize="off" required></label>
                <label>Name <input name="name" value="${person.name}" required></label>
                <label>Phone <input type="tel" name="phone" value="${person.phone ?? ''}"></label>
                <div><button class="btn">Save</button></div>
            </form>
        </details>
    `);

    onSubmit(view.querySelector('[data-edit]'), ({ email, name, phone }) => {
        email = normalizeEmail(email);
        if (!isValidEmail(email)) throw new Error('Please enter a valid email address.');
        const owner = users.findByEmail(email);
        if (owner && owner.id !== id) throw new Error(`${owner.name} already uses that email.`);
        users.update(id, email, name, phone);
        toast('Saved.');
        personPage(view, [id]);
    });
}
