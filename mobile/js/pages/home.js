import { html, render } from '../ui.js';
import { books, loans } from '../repo.js';
import { cover, loanList } from '../components.js';
import { CONFIG } from '../config.js';
import { kvGet, settings } from '../store.js';

export async function homePage(view) {
    const stats = books.stats();
    const out = loans.active();
    const recent = books.recentlyAdded(8);

    // Nudge toward a backup if there are changes that have never been exported, or the last
    // export is getting old. The phone is the only copy of the library.
    const changedAt = (await kvGet('changedAt')) ?? 0;
    const lastBackup = settings.lastBackupAt;
    const staleDays = lastBackup ? (Date.now() - lastBackup) / 86400000 : Infinity;
    const needsBackup = stats.titles > 0 && changedAt > (lastBackup ?? 0) && staleDays > CONFIG.backupReminderDays;

    render(view, html`
        ${needsBackup ? html`
            <a class="banner" href="#/backup">
                <strong>${lastBackup ? 'Time for a backup' : 'Back up your library'}</strong>
                <span>Your library only lives on this phone. Tap to save a copy to iCloud Drive.</span>
            </a>` : ''}

        ${stats.titles === 0 ? html`
            <section class="card">
                <h1>Welcome!</h1>
                <p>Start by scanning the books on your shelves, or bring over the library from the laptop app.</p>
                <div class="button-row">
                    <a class="btn" href="#/add">Add books</a>
                    <a class="btn btn-ghost" href="#/backup">Import from laptop</a>
                </div>
            </section>` : ''}

        <section class="stats">
            <a class="stat" href="#/books"><strong>${stats.titles}</strong><span>titles</span></a>
            <a class="stat" href="#/books"><strong>${stats.copies}</strong><span>copies</span></a>
            <a class="stat" href="#on-loan"><strong>${stats.on_loan}</strong><span>lent out</span></a>
            <a class="stat" href="#/people"><strong>${stats.people}</strong><span>borrowers</span></a>
        </section>

        <section class="actions">
            <a class="action" href="#/lend"><strong>Lend</strong><span>Scan a book out</span></a>
            <a class="action" href="#/return"><strong>Return</strong><span>Scan a book back</span></a>
        </section>

        <section class="card" id="on-loan">
            <h2>Lent out</h2>
            ${out.length ? loanList(out) : html`<p class="muted">Every book is on its shelf.</p>`}
        </section>

        ${recent.length ? html`
            <section class="card">
                <h2>Recently added</h2>
                <div class="cover-row">
                    ${recent.map((book) => html`
                        <a class="cover-link" href="#/books/${book.id}">
                            ${cover(book)}
                            <span>${book.title}</span>
                        </a>`)}
                </div>
            </section>` : ''}
    `);
}
