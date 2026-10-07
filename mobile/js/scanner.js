// Full-screen camera barcode scanner.
//
//   openScanner({ title, continuous, onCode })
//
// onCode(code) is called for each barcode read. In continuous mode the camera stays open so you
// can scan book after book; onCode can return { type, message } to show under the camera.
// Bluetooth/USB scanners don't need this at all: they type into the ISBN box like a keyboard.

import { html, render } from './ui.js';

const LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
const REPEAT_IGNORE_MS = 3000; // the camera sees the same barcode many times a second

let libraryLoading;
let active = null;

function loadLibrary() {
    libraryLoading ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = LIBRARY_URL;
        script.onload = resolve;
        script.onerror = () => {
            libraryLoading = null;
            reject(new Error('Couldn’t load the scanner. Connect to the internet once so it can be saved for offline use.'));
        };
        document.head.append(script);
    });
    return libraryLoading;
}

export async function openScanner({ title = 'Scan a barcode', continuous = false, onCode }) {
    await closeScanner();

    const overlay = document.createElement('div');
    overlay.className = 'scanner';
    render(overlay, html`
        <div class="scanner-head">
            <strong>${title}</strong>
            <button type="button" class="btn btn-small btn-light" data-close>Done</button>
        </div>
        <div id="scanner-camera" class="scanner-camera"></div>
        <p class="scanner-status" data-status>Starting the camera…</p>
    `);
    document.body.append(overlay);

    const status = overlay.querySelector('[data-status]');
    const setStatus = (message, type = 'info') => {
        status.textContent = message;
        status.className = `scanner-status scanner-status-${type}`;
    };

    const session = { overlay, camera: null };
    active = session;
    overlay.querySelector('[data-close]').addEventListener('click', () => closeScanner());

    try {
        await loadLibrary();
        if (active !== session) return;

        const F = window.Html5QrcodeSupportedFormats;
        session.camera = new window.Html5Qrcode('scanner-camera', {
            formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
            verbose: false,
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });

        let lastCode = '';
        let lastAt = 0;
        let busy = false;

        await session.camera.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: (w, h) => ({ width: Math.floor(Math.min(w * 0.85, 340)), height: Math.floor(Math.min(h * 0.35, 150)) }),
            },
            async (code) => {
                const at = Date.now();
                if (busy || (code === lastCode && at - lastAt < REPEAT_IGNORE_MS)) return;
                lastCode = code;
                lastAt = at;

                if (!continuous) {
                    await closeScanner();
                    onCode(code);
                    return;
                }
                busy = true;
                setStatus(`Read ${code}…`);
                try {
                    const result = await onCode(code);
                    if (result) setStatus(result.message, result.type);
                } catch (error) {
                    setStatus(error.message, 'error');
                } finally {
                    busy = false;
                }
            },
            () => {}, // "no barcode in this frame" — normal, ignore
        );
        if (active !== session) {
            await stopCamera(session);
            return;
        }
        setStatus('Point the camera at the barcode.');
    } catch (error) {
        const text = String(error?.message ?? error);
        let message = text;
        if (/permission|NotAllowed/i.test(text)) {
            message = 'Camera access was blocked. Allow it in Settings › Safari › Camera, then try again.';
        } else if (/NotFound|no camera/i.test(text)) {
            message = 'No camera was found on this device. You can type ISBNs instead.';
        } else if (/NotReadable|in use/i.test(text)) {
            message = 'The camera is being used by another app. Close it and try again.';
        } else if (/secure|https/i.test(text)) {
            message = 'The camera only works when the app is opened from its https:// address.';
        }
        setStatus(message, 'error');
    }
}

async function stopCamera(session) {
    try {
        if (session.camera?.isScanning) await session.camera.stop();
        session.camera?.clear();
    } catch {
        // Already stopped.
    }
}

export async function closeScanner() {
    const session = active;
    if (!session) return;
    active = null;
    await stopCamera(session);
    session.overlay.remove();
}
