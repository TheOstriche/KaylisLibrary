// Looks up book details by ISBN on the internet: Open Library first, then Google Books.
// Returns null if neither knows the book (the app then offers manual entry).

import { settings } from './store.js';

/** Problems hit during the last lookup, for display. */
export let lookupErrors = [];

export async function lookupBook(isbn) {
    lookupErrors = [];
    if (!navigator.onLine) {
        lookupErrors.push('The phone is offline');
        return null;
    }
    const book = (await fromOpenLibrary(isbn)) ?? (await fromGoogle(isbn));
    if (book && !book.cover_url) {
        book.cover_url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
    }
    return book;
}

async function fromOpenLibrary(isbn) {
    const data = await getJson(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, 'Open Library');
    const info = data?.[`ISBN:${isbn}`];
    if (!info?.title) return null;

    const names = (list) => (list?.length ? list.map((x) => x.name).join(', ') : null);
    return {
        title: fullTitle(info.title, info.subtitle),
        authors: names(info.authors),
        publisher: names(info.publishers),
        published_date: info.publish_date ?? null,
        page_count: info.number_of_pages ?? null,
        description: null,
        cover_url: info.cover?.medium ?? null,
        lookup_source: 'openlibrary',
    };
}

async function fromGoogle(isbn) {
    let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    if (settings.googleBooksKey) url += `&key=${encodeURIComponent(settings.googleBooksKey)}`;
    const info = (await getJson(url, 'Google Books'))?.items?.[0]?.volumeInfo;
    if (!info?.title) return null;

    const cover = (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? '')
        .replace('http://', 'https://').replace('&edge=curl', '');
    return {
        title: fullTitle(info.title, info.subtitle),
        authors: info.authors?.join(', ') ?? null,
        publisher: info.publisher ?? null,
        published_date: info.publishedDate ?? null,
        page_count: info.pageCount ?? null,
        description: info.description ?? null,
        cover_url: cover || null,
        lookup_source: 'google',
    };
}

/** Series books sometimes put the book's own name in the subtitle, so include real subtitles. */
function fullTitle(title, subtitle) {
    if (!subtitle || /^an? (novel|memoir|story|thriller)\b/i.test(subtitle)) return title;
    return `${title}: ${subtitle}`;
}

async function getJson(url, serviceName) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
            lookupErrors.push(`${serviceName}: HTTP ${response.status}${response.status === 429 ? ' (daily limit reached)' : ''}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        lookupErrors.push(`${serviceName}: couldn’t connect`);
        return null;
    }
}
