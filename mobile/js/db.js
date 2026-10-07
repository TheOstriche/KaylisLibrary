// The library database: a real SQLite database running inside the browser (via sql.js).
// It lives in memory while the app is open, and every change is saved to the phone's storage.

import { kvGet, kvSet } from './store.js';
import { MIGRATIONS } from './migrations.js';
import { now, today } from './ui.js';

const SQLJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';

let SQL;   // the sql.js library
let db;    // the open database

export async function openDatabase() {
    // initSqlJs comes from the <script> tag in index.html.
    SQL = await window.initSqlJs({ locateFile: (file) => SQLJS_URL + file });
    const saved = await kvGet('db');
    db = new SQL.Database(saved ?? undefined);
    prepare(db);
    if (!saved) {
        await saveNow();
    }
}

function prepare(database) {
    database.exec('PRAGMA foreign_keys = ON');
    migrate(database);
}

function migrate(database) {
    database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
    )`);
    const applied = new Set(rows(database, 'SELECT filename FROM schema_migrations').map((r) => r.filename));
    for (const migration of MIGRATIONS) {
        if (applied.has(migration.name)) continue;
        database.exec('BEGIN');
        try {
            database.exec(migration.sql);
            database.run('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)', [migration.name, now()]);
            database.exec('COMMIT');
        } catch (error) {
            database.exec('ROLLBACK');
            throw error;
        }
    }
}

// ----- Queries ----------------------------------------------------------------------------

const clean = (params) => Array.isArray(params)
    ? params.map((v) => (v === undefined ? null : v))
    : params;

function rows(database, sql, params = []) {
    const statement = database.prepare(sql);
    try {
        statement.bind(clean(params));
        const result = [];
        while (statement.step()) result.push(statement.getAsObject());
        return result;
    } finally {
        statement.free();
    }
}

/** All matching rows, as objects. */
export const all = (sql, params) => rows(db, sql, params);

/** The first matching row, or null. */
export const get = (sql, params) => all(sql, params)[0] ?? null;

/** The first column of the first row, e.g. a COUNT(*). */
export function value(sql, params) {
    const row = get(sql, params);
    return row ? Object.values(row)[0] : null;
}

/** Run an INSERT/UPDATE/DELETE. Returns the new row's id (for inserts). Saves automatically. */
export function run(sql, params) {
    db.run(sql, clean(params));
    const id = value('SELECT last_insert_rowid()');
    if (!inTransaction) scheduleSave();
    return id;
}

let inTransaction = false;

/** Run several changes as one: either all of them happen, or none do. */
export function transaction(work) {
    db.exec('BEGIN');
    inTransaction = true;
    try {
        const result = work();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    } finally {
        inTransaction = false;
        scheduleSave();
    }
}

// ----- Saving to the phone ----------------------------------------------------------------

let saving = Promise.resolve();
let dirty = false;

function scheduleSave() {
    dirty = true;
    // Saves run one after another so an older copy can never overwrite a newer one.
    saving = saving.then(async () => {
        if (!dirty) return;
        dirty = false;
        await saveNow();
    }).catch((error) => console.error('Saving the library failed', error));
}

async function saveNow() {
    await kvSet('db', db.export());
    await kvSet('changedAt', Date.now());
}

/** Resolves once every change so far has been written to the phone's storage. */
export const saved = () => saving;

// ----- Backup and restore -----------------------------------------------------------------

/** The whole database as a file (the same format DBeaver and the laptop app use). */
export function exportFile() {
    return new File([db.export()], `library-${today()}.db`, { type: 'application/x-sqlite3' });
}

/**
 * Replace the library with a .db file (from a backup or the laptop app).
 * Throws an Error with a readable message if the file isn't a library database.
 */
export async function importFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let incoming;
    try {
        incoming = new SQL.Database(bytes);
        const tables = rows(incoming, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name);
        if (!tables.includes('books') || !tables.includes('loans')) {
            throw new Error('missing tables');
        }
    } catch {
        incoming?.close();
        throw new Error('That file isn’t a library database. Choose a .db file exported from this app or the laptop app.');
    }
    prepare(incoming);
    db.close();
    db = incoming;
    await saving;
    await saveNow();
}
