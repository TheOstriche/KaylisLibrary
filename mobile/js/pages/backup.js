import { html, render, toast, onSubmit } from '../ui.js';
import { exportFile, importFile, saved } from '../db.js';
import { books } from '../repo.js';
import { settings, saveSettings } from '../store.js';

export async function backupPage(view) {
    const stats = books.stats();
    const last = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
    const persisted = await navigator.storage?.persisted?.();

    render(view, html`
        <h1>Backup</h1>

        <section class="card">
            <h2>Save a copy</h2>
            <p>Your library (${stats.titles} titles, ${stats.people} people) lives only on this phone.
               Save a copy to iCloud Drive or AirDrop it to a computer now and then.</p>
            <p class="small muted">Last backup: ${last ? last.toLocaleString() : 'never'}</p>
            <button type="button" class="btn btn-large btn-block" data-export>Export backup</button>
            <p class="small muted">The file opens in DBeaver, and works in the laptop version of the app
               (replace <code>data\\library.db</code> with it).</p>
        </section>

        <section class="card">
            <h2>Restore or import</h2>
            <p>Load a backup, or the <code>library.db</code> file from the laptop app.
               <strong>This replaces everything currently on this phone.</strong></p>
            <label class="btn btn-ghost btn-block file-button">
                Choose a .db file…
                <input type="file" accept=".db,.sqlite,application/x-sqlite3,application/octet-stream" data-import hidden>
            </label>
        </section>

        <section class="card">
            <h2>Settings</h2>
            <form class="stack" data-settings>
                <label>Google Books API key <span class="muted small">(optional)</span>
                    <input name="googleBooksKey" value="${settings.googleBooksKey}" autocomplete="off" autocapitalize="off">
                </label>
                <p class="small muted">Books are looked up on Open Library first. A Google key helps find the rest;
                    it’s stored only on this phone.</p>
                <div><button class="btn">Save</button></div>
            </form>
            <p class="small muted">Storage: ${persisted ? 'protected from automatic clearing' : 'add this app to your Home Screen so iOS keeps its data'}.</p>
        </section>
    `);

    view.querySelector('[data-export]').addEventListener('click', async () => {
        await saved();
        const file = exportFile();
        try {
            if (navigator.canShare?.({ files: [file] })) {
                // Opens the iPhone share sheet: Save to Files (iCloud Drive), AirDrop, Mail…
                await navigator.share({ files: [file], title: 'Library backup' });
            } else {
                const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 10000);
            }
            await saveSettings({ lastBackupAt: Date.now() });
            toast('Backup exported.');
            backupPage(view);
        } catch (error) {
            if (error.name !== 'AbortError') toast(`Export failed: ${error.message}`, 'error');
        }
    });

    view.querySelector('[data-import]').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (!confirm(`Replace the library on this phone with “${file.name}”? This can’t be undone.`)) return;
        try {
            await importFile(file);
            await saveSettings({ lastBackupAt: Date.now() }); // the imported file is itself a copy
            toast(`Imported ${books.stats().titles} titles.`);
            location.hash = '#/';
        } catch (error) {
            toast(error.message, 'error');
        }
    });

    onSubmit(view.querySelector('[data-settings]'), async ({ googleBooksKey }) => {
        await saveSettings({ googleBooksKey });
        toast('Settings saved.');
    });
}
