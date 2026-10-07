# Kayli's Library — iPhone app

The phone version of the library. It installs to the iPhone Home Screen, works offline, and keeps
the whole library on the phone. There's no server and no account; it's just these files.

- **Lend**: scan a book with the camera, then enter the borrower's email. New emails are asked for a name and phone.
- **Return**: scan books back one after another; it tells you which shelf each goes on.
- **Add**: set the bookcase and shelf, then scan book after book. Titles and covers are looked up online.
- **People**: contact details (tap to email, call or text), borrowing history, and editing.
- **Backup**: export the library to iCloud Drive / AirDrop, or import one (including from the laptop app).

## Putting it on the iPhone

The camera and Home Screen install only work when the app is served over `https://`.
Free option: **GitHub Pages**.

1. Create a new repository on github.com (e.g. `kaylis-library-app`).
2. **Add file → Upload files**, and drag in *the contents* of this `mobile` folder
   (`index.html`, `sw.js`, and the `css`, `js`, `icons` folders…). Commit.
3. **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`. Save.
4. After a minute the address appears there, like `https://<you>.github.io/kaylis-library-app/`.
5. On the iPhone, open that address in **Safari**, tap **Share → Add to Home Screen**.
6. Open it from the Home Screen, go to **Backup → Choose a .db file**, and pick the laptop's
   `library.db` (AirDrop it or save it to iCloud Drive first).

Only the app is published. Your books and borrowers stay on the phone and never go to GitHub.

## Updating the app

Phones keep a saved copy of the app so it works offline. After changing any file, open `sw.js`
and bump `VERSION` (e.g. `'v1'` → `'v2'`), then upload the files again. The phone picks up the new
version the next time the app is opened (sometimes it takes a second launch).

## Data

The library is a SQLite database (same tables as the laptop app) stored in the phone's browser
storage. **Back up regularly**: if the app is deleted from the Home Screen, its data goes with it.
The Home screen reminds you when a backup is overdue.

Exported backups open in DBeaver, and can replace `data\library.db` in the laptop app.

## How the code is organized

```
index.html          The page shell: top bar, bottom tabs, and where pages are drawn
sw.js               Offline support (saved copy of the app)
js/app.js           Starts the app and maps addresses (#/books, #/lend…) to pages
js/pages/*.js       One file per screen
js/repo.js          All the SQL: books, copies, people, loans
js/db.js            Opens SQLite, saves changes, backup/restore
js/isbn.js          ISBN checking (same rules as the laptop app)
js/lookup.js        Open Library / Google Books lookups
js/scanner.js       Camera barcode scanning
```

No build step and no dependencies to install. To try it on a computer, serve this folder with any
web server (e.g. `php -S 127.0.0.1:8770 -t mobile`) and open it in a browser.
