// Reading and writing books, copies, people and loans. All of the app's SQL lives here.
// A direct port of the laptop app's Books.php, Users.php and Loans.php.

import { all, get, value, run, transaction } from './db.js';
import { now, today, addDays } from './ui.js';

// ===== Books and copies ===================================================================

export const books = {
    find: (id) => get('SELECT * FROM books WHERE id = ?', [id]),

    findByIsbn: (isbn) => get('SELECT * FROM books WHERE isbn = ?', [isbn]),

    create(data) {
        return run(
            `INSERT INTO books (isbn, title, authors, publisher, published_date, page_count,
                                description, cover_url, lookup_source, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.isbn ?? null, data.title, data.authors ?? null, data.publisher ?? null,
             data.published_date ?? null, data.page_count ?? null, data.description ?? null,
             data.cover_url ?? null, data.lookup_source ?? 'manual', now(), now()],
        );
    },

    updateDetails(id, title, authors) {
        run('UPDATE books SET title = ?, authors = ?, updated_at = ? WHERE id = ?',
            [title, authors || null, now(), id]);
    },

    /** Matches title, author or ISBN; optionally only one bookcase. Includes availability. */
    search(query = '', bookcase = '') {
        const where = [];
        const params = [];
        if (query) {
            where.push('(b.title LIKE ? OR b.authors LIKE ? OR b.isbn LIKE ?)');
            params.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }
        if (bookcase) {
            where.push('EXISTS (SELECT 1 FROM copies c2 WHERE c2.book_id = b.id AND c2.bookcase = ?)');
            params.push(bookcase);
        }
        return all(
            `SELECT b.*,
                    COUNT(c.id) AS copy_count,
                    COUNT(c.id) - COUNT(l.id) AS available_count,
                    GROUP_CONCAT(DISTINCT c.bookcase || ' · shelf ' || c.shelf) AS locations
             FROM books b
             LEFT JOIN copies c ON c.book_id = b.id
             LEFT JOIN loans l ON l.copy_id = c.id AND l.returned_at IS NULL
             ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
             GROUP BY b.id
             ORDER BY b.title COLLATE NOCASE`,
            params,
        );
    },

    recentlyAdded: (limit = 8) => all('SELECT * FROM books ORDER BY created_at DESC, id DESC LIMIT ?', [limit]),

    stats: () => get(
        `SELECT (SELECT COUNT(*) FROM books) AS titles,
                (SELECT COUNT(*) FROM copies) AS copies,
                (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL) AS on_loan,
                (SELECT COUNT(*) FROM users) AS people`),

    bookcases: () => all('SELECT DISTINCT bookcase FROM copies ORDER BY bookcase COLLATE NOCASE').map((r) => r.bookcase),

    /** Copies of a book, each with its active loan (if any) and borrower. */
    copies: (bookId) => all(
        `SELECT c.*, l.id AS loan_id, l.due_date,
                u.id AS borrower_id, u.name AS borrower_name,
                (SELECT COUNT(*) FROM loans lh WHERE lh.copy_id = c.id) AS loan_history_count
         FROM copies c
         LEFT JOIN loans l ON l.copy_id = c.id AND l.returned_at IS NULL
         LEFT JOIN users u ON u.id = l.user_id
         WHERE c.book_id = ?
         ORDER BY c.id`, [bookId]),

    findCopy: (id) => get('SELECT * FROM copies WHERE id = ?', [id]),

    addCopy: (bookId, bookcase, shelf) => run(
        'INSERT INTO copies (book_id, bookcase, shelf, created_at) VALUES (?, ?, ?, ?)',
        [bookId, bookcase, shelf, now()]),

    moveCopy: (id, bookcase, shelf) => run('UPDATE copies SET bookcase = ?, shelf = ? WHERE id = ?', [bookcase, shelf, id]),

    /**
     * Removes a copy (e.g. a duplicate scan). Copies with borrowing history are kept.
     * If it was the book's last copy, the book goes too. Returns whether the book was removed.
     */
    deleteCopy(id) {
        const copy = books.findCopy(id);
        if (!copy) return false;
        if (value('SELECT COUNT(*) FROM loans WHERE copy_id = ?', [id]) > 0) {
            throw new Error('That copy has borrowing history, so it can’t be removed.');
        }
        return transaction(() => {
            run('DELETE FROM copies WHERE id = ?', [id]);
            const remaining = value('SELECT COUNT(*) FROM copies WHERE book_id = ?', [copy.book_id]);
            if (remaining === 0) run('DELETE FROM books WHERE id = ?', [copy.book_id]);
            return remaining === 0;
        });
    },
};

// ===== People =============================================================================

export const normalizeEmail = (email) => String(email).trim().toLowerCase();
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const users = {
    find: (id) => get('SELECT * FROM users WHERE id = ?', [id]),

    findByEmail: (email) => get('SELECT * FROM users WHERE email = ?', [normalizeEmail(email)]),

    create: (email, name, phone) => run(
        'INSERT INTO users (email, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [normalizeEmail(email), name, phone || null, now(), now()]),

    update: (id, email, name, phone) => run(
        'UPDATE users SET email = ?, name = ?, phone = ?, updated_at = ? WHERE id = ?',
        [normalizeEmail(email), name, phone || null, now(), id]),

    allWithLoanCounts: () => all(
        `SELECT u.*,
                COUNT(l.id) AS books_out,
                SUM(CASE WHEN l.due_date < ? THEN 1 ELSE 0 END) AS books_overdue
         FROM users u
         LEFT JOIN loans l ON l.user_id = u.id AND l.returned_at IS NULL
         GROUP BY u.id
         ORDER BY u.name COLLATE NOCASE`, [today()]),

    /** People who borrowed most recently, for quick picking when lending. */
    recentBorrowers: (limit = 6) => all(
        `SELECT u.* FROM users u
         LEFT JOIN loans l ON l.user_id = u.id
         GROUP BY u.id
         ORDER BY MAX(COALESCE(l.checked_out_at, u.created_at)) DESC
         LIMIT ?`, [limit]),
};

// ===== Loans ==============================================================================

const LOAN_DETAILS = `
    SELECT l.*, c.bookcase, c.shelf, b.id AS book_id, b.title, b.authors, b.cover_url,
           u.name AS borrower_name, u.email AS borrower_email, u.phone AS borrower_phone
    FROM loans l
    JOIN copies c ON c.id = l.copy_id
    JOIN books b  ON b.id = c.book_id
    JOIN users u  ON u.id = l.user_id`;

export const loans = {
    find: (id) => get(`${LOAN_DETAILS} WHERE l.id = ?`, [id]),

    /** First copy of the book that's on the shelf, or null. */
    findAvailableCopy: (bookId) => get(
        `SELECT c.* FROM copies c
         WHERE c.book_id = ?
           AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = c.id AND l.returned_at IS NULL)
         ORDER BY c.id LIMIT 1`, [bookId]),

    checkOut: (copyId, userId, loanDays) => run(
        'INSERT INTO loans (copy_id, user_id, checked_out_at, due_date) VALUES (?, ?, ?, ?)',
        [copyId, userId, now(), addDays(loanDays)]),

    markReturned: (id) => run('UPDATE loans SET returned_at = ? WHERE id = ? AND returned_at IS NULL', [now(), id]),

    active: () => all(`${LOAN_DETAILS} WHERE l.returned_at IS NULL ORDER BY l.due_date, l.id`),

    activeForBook: (bookId) => all(`${LOAN_DETAILS} WHERE l.returned_at IS NULL AND b.id = ? ORDER BY l.checked_out_at`, [bookId]),

    /** A person's loans: current first, then recent returns. */
    forUser: (userId, limit = 30) => all(
        `${LOAN_DETAILS} WHERE l.user_id = ?
         ORDER BY (l.returned_at IS NULL) DESC, COALESCE(l.returned_at, l.due_date) DESC
         LIMIT ?`, [userId, limit]),
};
