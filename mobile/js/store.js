// A tiny key/value store on the phone (IndexedDB). It holds the whole library database file
// plus a few app settings. IndexedDB is the browser's durable storage; it survives app restarts.

const DB_NAME = 'kaylis-library';
const STORE = 'kv';
let connection;

function open() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function transaction(mode, action) {
    connection ??= await open();
    return new Promise((resolve, reject) => {
        const tx = connection.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

export const kvGet = (key) => transaction('readonly', (s) => s.get(key));
export const kvSet = (key, value) => transaction('readwrite', (s) => s.put(value, key));

// ----- Settings ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = {
    googleBooksKey: '',
    addLocation: { bookcase: '', shelf: '' },  // remembered between scans on the Add page
    lastBackupAt: null,                        // timestamp of the last export
};

export const settings = { ...DEFAULT_SETTINGS };

export async function loadSettings() {
    Object.assign(settings, DEFAULT_SETTINGS, (await kvGet('settings')) ?? {});
}

export async function saveSettings(changes) {
    Object.assign(settings, changes);
    await kvSet('settings', { ...settings });
}
