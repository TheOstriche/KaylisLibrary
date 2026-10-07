// Starts the app: opens the database, then shows the page named in the address (#/books, #/lend…).

import { openDatabase } from './db.js';
import { loadSettings } from './store.js';
import { html, render, toast } from './ui.js';
import { closeScanner } from './scanner.js';
import { returnLoan } from './components.js';
import { homePage } from './pages/home.js';
import { catalogPage } from './pages/catalog.js';
import { bookPage } from './pages/book.js';
import { lendPage } from './pages/lend.js';
import { returnPage } from './pages/return.js';
import { addPage } from './pages/add.js';
import { manualPage } from './pages/manual.js';
import { peoplePage, personPage } from './pages/people.js';
import { backupPage } from './pages/backup.js';

// Address → page. (\d+) parts are passed to the page as numbers. The last column picks the
// highlighted tab at the bottom of the screen.
const ROUTES = [
    [/^\/$/,              homePage,    'home'],
    [/^\/books$/,         catalogPage, 'books'],
    [/^\/books\/(\d+)$/,  bookPage,    'books'],
    [/^\/lend$/,          lendPage,    'lend'],
    [/^\/lend\/(\d+)$/,   lendPage,    'lend'],
    [/^\/return$/,        returnPage,  'lend'],
    [/^\/add$/,           addPage,     'add'],
    [/^\/add\/manual$/,   manualPage,  'add'],
    [/^\/people$/,        peoplePage,  'people'],
    [/^\/people\/(\d+)$/, personPage,  'people'],
    [/^\/backup$/,        backupPage,  ''],
];

const view = document.getElementById('view');

async function showCurrentPage() {
    await closeScanner();
    const [path, queryString = ''] = (location.hash.slice(1) || '/').split('?');
    const query = new URLSearchParams(queryString);

    for (const [pattern, page, tab] of ROUTES) {
        const match = path.match(pattern);
        if (match) {
            document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
            await page(view, match.slice(1).map(Number), query);
            return;
        }
    }
    render(view, html`<div class="card center"><p>Page not found.</p><a class="btn" href="#/">Home</a></div>`);
}

// "Return" buttons appear in lists on several pages; handle them all here.
view.addEventListener('click', (event) => {
    const button = event.target.closest('[data-return-loan]');
    if (!button) return;
    const result = returnLoan(Number(button.dataset.returnLoan));
    toast(result.message, result.type);
    showCurrentPage();
});

async function start() {
    try {
        await loadSettings();
        await openDatabase();
    } catch (error) {
        console.error(error);
        render(view, html`
            <div class="card">
                <h1>The library couldn’t open</h1>
                <p>${navigator.onLine ? error.message : 'Connect to the internet once so the app can finish installing.'}</p>
            </div>`);
        return;
    }

    window.addEventListener('hashchange', () => {
        window.scrollTo(0, 0);
        showCurrentPage();
    });
    await showCurrentPage();

    // Ask iOS not to clear our storage when space runs low (granted for Home Screen apps).
    navigator.storage?.persist?.();

    // Offline support: sw.js keeps a copy of the app on the phone.
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Offline support unavailable', error));
    }
}

start();
