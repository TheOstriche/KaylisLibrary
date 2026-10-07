// Database schema changes, applied in order and recorded in schema_migrations.
// These use the same names and SQL as the laptop version's migrations/ folder, so a library.db
// file can move between the phone and the laptop in either direction.

export const MIGRATIONS = [
    {
        name: '001_initial_schema.sql',
        sql: `
CREATE TABLE users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name        TEXT    NOT NULL,
    phone       TEXT,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn            TEXT    UNIQUE,
    title           TEXT    NOT NULL,
    authors         TEXT,
    publisher       TEXT,
    published_date  TEXT,
    page_count      INTEGER,
    description     TEXT,
    cover_url       TEXT,
    lookup_source   TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

CREATE TABLE copies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    bookcase    TEXT    NOT NULL,
    shelf       INTEGER NOT NULL,
    created_at  TEXT    NOT NULL
);
CREATE INDEX idx_copies_book ON copies(book_id);

CREATE TABLE loans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id         INTEGER NOT NULL REFERENCES copies(id) ON DELETE RESTRICT,
    user_id         INTEGER NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    checked_out_at  TEXT    NOT NULL,
    due_date        TEXT    NOT NULL,
    returned_at     TEXT
);
CREATE INDEX idx_loans_user ON loans(user_id);
CREATE UNIQUE INDEX idx_loans_one_active_per_copy ON loans(copy_id) WHERE returned_at IS NULL;
`,
    },
];
