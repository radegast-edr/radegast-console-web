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
//
// Layout in the "keys" object store:
//   `wk_${userId}` → non-extractable AES-GCM CryptoKey  (wrapping key)
//   `pk_${userId}` → { iv: Uint8Array(12), ciphertext: ArrayBuffer }
//
// The AGE private key is never written as plaintext. The wrapping CryptoKey
// is non-extractable, so JS code cannot read its raw bytes — only the browser
// engine can use it for encrypt/decrypt. This gives at-rest protection even
// if an attacker can dump raw IndexedDB contents.

const IDB_NAME = 'radegast';
const IDB_STORE = 'keys';
const IDB_VERSION = 1;

/** @returns {Promise<IDBDatabase>} */
function openKeyDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(IDB_NAME, IDB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = /** @type {IDBDatabase} */ (e.target.result);
			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE);
			}
		};
		req.onsuccess = (e) => resolve(/** @type {IDBDatabase} */ (e.target.result));
		req.onerror = () => reject(req.error);
	});
}

/** @param {IDBDatabase} db @param {IDBValidKey} key @returns {Promise<any>} */
function idbGet(db, key) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readonly');
		const req = tx.objectStore(IDB_STORE).get(key);
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

/** @param {IDBDatabase} db @param {IDBValidKey} key @param {any} value @returns {Promise<void>} */
function idbPut(db, key, value) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		const req = tx.objectStore(IDB_STORE).put(value, key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

/** @param {IDBDatabase} db @param {IDBValidKey} key @returns {Promise<void>} */
function idbDelete(db, key) {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		const req = tx.objectStore(IDB_STORE).delete(key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

/**
 * Return the AES-GCM wrapping key for userId, creating and persisting it if it
 * does not exist yet. The key is non-extractable — the browser engine holds the
 * raw key material; JS only ever holds an opaque CryptoKey handle.
 *
 * @param {IDBDatabase} db
 * @param {string|number} userId
 * @returns {Promise<CryptoKey>}
 */
async function getOrCreateWrappingKey(db, userId) {
	const idbKey = `wk_${userId}`;
	const existing = await idbGet(db, idbKey);
	if (existing) return /** @type {CryptoKey} */ (existing);

	const wk = await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		false, // non-extractable
		['encrypt', 'decrypt']
	);
	await idbPut(db, idbKey, wk);
	return wk;
}

/**
 * Retrieve the stored AGE private key for the given user.
 * If the stored key is missing, unencrypted, or cannot be decrypted,
 * wipe any stored key material and return null.
 *
 * @param {string|number} userId
 * @returns {Promise<string|null>}
 */
export async function getStoredPrivateKey(userId) {
	const db = await openKeyDB();

	const stored = await idbGet(db, `pk_${userId}`);
	if (stored) {
		try {
			const wk = await getOrCreateWrappingKey(db, userId);
			const plainBuf = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: stored.iv },
				wk,
				stored.ciphertext
			);
			return new TextDecoder().decode(plainBuf);
		} catch (err) {
			await clearStoredPrivateKey(userId);
			return null;
		}
	}

	return null;
}

/**
 * Encrypt and persist the AGE private key for the given user.
 *
 * @param {string|number} userId
 * @param {string} privateKey
 * @returns {Promise<void>}
 */
export async function storePrivateKey(userId, privateKey) {
	const db = await openKeyDB();
	const wk = await getOrCreateWrappingKey(db, userId);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		wk,
		new TextEncoder().encode(privateKey)
	);
	await idbPut(db, `pk_${userId}`, { iv, ciphertext });
}

/**
 * Remove both the encrypted private key blob and the wrapping key for a user.
 *
 * @param {string|number} userId
 * @returns {Promise<void>}
 */
export async function clearStoredPrivateKey(userId) {
	const db = await openKeyDB();
	await Promise.all([
		idbDelete(db, `pk_${userId}`),
		idbDelete(db, `wk_${userId}`),
		idbDelete(db, String(userId)) // remove any legacy plaintext entry
	]);
}
