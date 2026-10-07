// Cleans up and validates ISBNs so every book is stored as a 13-digit ISBN.
// Same rules as the laptop app's src/Isbn.php.

export class InvalidIsbn extends Error {}

export function normalizeIsbn(input) {
    const raw = String(input).replace(/[^0-9Xx]/g, '').toUpperCase();

    if (raw.length === 10) {
        if (!isValidIsbn10(raw)) {
            throw new InvalidIsbn(`“${input}” isn’t a valid ISBN-10 (the check digit doesn’t match).`);
        }
        return isbn10To13(raw);
    }

    if (raw.length === 13 && /^\d+$/.test(raw)) {
        if (!raw.startsWith('978') && !raw.startsWith('979')) {
            throw new InvalidIsbn(`“${input}” is a product barcode, not an ISBN. Book ISBNs start with 978 or 979.`);
        }
        if (!isValidIsbn13(raw)) {
            throw new InvalidIsbn(`“${input}” isn’t a valid ISBN-13. Try scanning again.`);
        }
        return raw;
    }

    if (raw.length === 12 && /^\d+$/.test(raw)) {
        throw new InvalidIsbn(`“${input}” is a UPC price barcode. Scan the one starting with 978 or 979, usually on the back cover.`);
    }

    throw new InvalidIsbn(`“${input}” isn’t an ISBN. ISBNs are 10 or 13 digits long.`);
}

function isValidIsbn10(isbn) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += (isbn[i] === 'X' ? 10 : Number(isbn[i])) * (10 - i);
    }
    return sum % 11 === 0;
}

function isValidIsbn13(isbn) {
    return /^\d{13}$/.test(isbn) && checkDigit13(isbn.slice(0, 12)) === Number(isbn[12]);
}

function isbn10To13(isbn10) {
    const first12 = '978' + isbn10.slice(0, 9);
    return first12 + checkDigit13(first12);
}

function checkDigit13(first12) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10;
}
