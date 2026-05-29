/**
 * AGE encryption/decryption using agewasm v1.4.0.
 * Expects agewasm files to be served from /agewasm/:
 *   /agewasm/wasm_exec.js  — Go WASM runtime (sets globalThis.Go)
 *   /agewasm/main.wasm     — AGE WASM binary
 *
 * After WASM init, the Go program registers these globals:
 *   generateX25519Identity() → { publicKey, privateKey }
 *   encrypt(recipients, plaintext) → { output, error }   (recipients = newline-joined keys)
 *   decrypt(identities, ciphertext) → { output, error }  (identities = newline-joined keys)
 */

let wasmReady = false;
/** @type {Promise<void>|null} */
let initPromise = null;

/**
 * Initialize the agewasm module (idempotent, returns the same promise on concurrent calls).
 */
export async function initAgeWasm() {
	if (wasmReady) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		if (!window.Go) {
			await loadScript('/agewasm/wasm_exec.js');
		}
		const go = new window.Go();
		const result = await WebAssembly.instantiateStreaming(
			fetch('/agewasm/main.wasm'),
			go.importObject
		);
		go.run(result.instance);
		// Give the Go program a tick to register globals
		await new Promise((r) => setTimeout(r, 0));
		wasmReady = true;
	})();

	return initPromise;
}

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = src;
		script.onload = resolve;
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

/**
 * Generate an AGE X25519 keypair.
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateKeypair() {
	if (!wasmReady) throw new Error('agewasm not initialized');
	return window.generateX25519Identity();
}

/**
 * Encrypt plaintext for one or more AGE public key recipients.
 * @param {string} plaintext
 * @param {string[]} publicKeys - AGE public keys ("age1...")
 * @returns {string} armored AGE ciphertext
 */
export function encrypt(plaintext, publicKeys) {
	if (!wasmReady) throw new Error('agewasm not initialized');
	const recipients = publicKeys.join('\n');
	const result = window.encrypt(recipients, plaintext);
	if (result.error) throw new Error(result.error);
	return result.output;
}

/**
 * Decrypt AGE-encrypted ciphertext.
 * @param {string} ciphertext - armored AGE ciphertext
 * @param {string} privateKey - AGE private key ("AGE-SECRET-KEY-1...")
 * @returns {string} decrypted plaintext
 */
export function decrypt(ciphertext, privateKey) {
	if (!wasmReady) throw new Error('agewasm not initialized');
	const result = window.decrypt(privateKey, ciphertext);
	if (result.error) throw new Error(result.error);
	return result.output;
}

// --- IndexedDB helpers for private key storage (per user ID) ---

const IDB_NAME = 'radegast';
const IDB_STORE = 'keys';
const IDB_VERSION = 1;

/** @returns {Promise<IDBDatabase>} */
function openKeyDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(IDB_NAME, IDB_VERSION);
		req.onupgradeneeded = (e) => {
			/** @type {IDBDatabase} */
			const db = e.target.result;
			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE);
			}
		};
		req.onsuccess = (e) => resolve(e.target.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * @param {string|number} userId
 * @returns {Promise<string|null>}
 */
export async function getStoredPrivateKey(userId) {
	const db = await openKeyDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readonly');
		const req = tx.objectStore(IDB_STORE).get(String(userId));
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

/**
 * @param {string|number} userId
 * @param {string} privateKey
 * @returns {Promise<void>}
 */
export async function storePrivateKey(userId, privateKey) {
	const db = await openKeyDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		const req = tx.objectStore(IDB_STORE).put(privateKey, String(userId));
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

/**
 * @param {string|number} userId
 * @returns {Promise<void>}
 */
export async function clearStoredPrivateKey(userId) {
	const db = await openKeyDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		const req = tx.objectStore(IDB_STORE).delete(String(userId));
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}
