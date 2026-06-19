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

import { base } from '$app/paths';

declare global {
	interface Window {
		Go: new () => { importObject: WebAssembly.Imports; run: (instance: WebAssembly.Instance) => void };
		generateX25519Identity: () => { publicKey: string; privateKey: string };
		encrypt: (recipients: string, plaintext: string) => { output: string; error?: string };
		decrypt: (privateKey: string, ciphertext: string) => { output: string; error?: string };
	}
}

let wasmReady = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the agewasm module (idempotent, returns the same promise on concurrent calls).
 */
export async function initAgeWasm(): Promise<void> {
	if (wasmReady) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		if (!window.Go) {
			await loadScript(`${base}/agewasm/wasm_exec.js`);
		}
		const go = new window.Go();
		const result = await WebAssembly.instantiateStreaming(
			fetch(`${base}/agewasm/main.wasm`),
			go.importObject
		);
		go.run(result.instance);
		// Give the Go program a tick to register globals
		await new Promise<void>((r) => setTimeout(r, 0));
		wasmReady = true;
	})();

	return initPromise;
}

function loadScript(src: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = src;
		script.onload = () => resolve();
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

/**
 * Generate an AGE X25519 keypair.
 */
export function generateKeypair(): { publicKey: string; privateKey: string } {
	if (!wasmReady) throw new Error('agewasm not initialized');
	return window.generateX25519Identity();
}

/**
 * Encrypt plaintext for one or more AGE public key recipients.
 * @param plaintext
 * @param publicKeys - AGE public keys ("age1...")
 * @returns armored AGE ciphertext
 */
export function encrypt(plaintext: string, publicKeys: string[]): string {
	if (!wasmReady) throw new Error('agewasm not initialized');
	const recipients = publicKeys.join('\n');
	const result = window.encrypt(recipients, plaintext);
	if (result.error) throw new Error(result.error);
	return result.output;
}

/**
 * Decrypt AGE-encrypted ciphertext.
 * @param ciphertext - armored AGE ciphertext
 * @param privateKey - AGE private key ("AGE-SECRET-KEY-1...")
 * @returns decrypted plaintext
 */
export function decrypt(ciphertext: string, privateKey: string): string {
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

function openKeyDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(IDB_NAME, IDB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE);
			}
		};
		req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
		req.onerror = () => reject(req.error);
	});
}

function idbGet<T = unknown>(db: IDBDatabase, key: IDBValidKey): Promise<T | null> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readonly');
		const req = tx.objectStore(IDB_STORE).get(key);
		req.onsuccess = () => resolve((req.result as T) ?? null);
		req.onerror = () => reject(req.error);
	});
}

function idbPut(db: IDBDatabase, key: IDBValidKey, value: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, 'readwrite');
		const req = tx.objectStore(IDB_STORE).put(value, key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

function idbDelete(db: IDBDatabase, key: IDBValidKey): Promise<void> {
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
 */
async function getOrCreateWrappingKey(db: IDBDatabase, userId: string | number): Promise<CryptoKey> {
	const idbKey = `wk_${userId}`;
	const existing = await idbGet<CryptoKey>(db, idbKey);
	if (existing) return existing;

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
 */
export async function getStoredPrivateKey(userId: string | number): Promise<string | null> {
	const db = await openKeyDB();

	interface EncryptedKeyRecord {
		iv: BufferSource;
		ciphertext: BufferSource;
	}
	const stored = await idbGet<EncryptedKeyRecord>(db, `pk_${userId}`);
	if (stored) {
		try {
			const wk = await getOrCreateWrappingKey(db, userId);
			const plainBuf = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: stored.iv },
				wk,
				stored.ciphertext
			);
			return new TextDecoder().decode(plainBuf);
		} catch {
			await clearStoredPrivateKey(userId);
			return null;
		}
	}

	return null;
}

/**
 * Retrieve the stored AGE public key for the given user.
 */
export async function getStoredPublicKey(userId: string | number): Promise<string | null> {
	const db = await openKeyDB();
	return await idbGet<string>(db, `pub_${userId}`);
}

/**
 * Encrypt and persist the AGE private key for the given user.
 * Optionally saves the corresponding public key unencrypted in IndexedDB.
 */
export async function storePrivateKey(
	userId: string | number,
	privateKey: string,
	publicKey: string | null = null
): Promise<void> {
	const db = await openKeyDB();
	const wk = await getOrCreateWrappingKey(db, userId);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		wk,
		new TextEncoder().encode(privateKey)
	);
	await idbPut(db, `pk_${userId}`, { iv, ciphertext });
	if (publicKey) {
		await idbPut(db, `pub_${userId}`, publicKey);
	}
}

/**
 * Look up the stored public key for a given user email, or fallback to the first
 * public key found in IndexedDB if there's only one user.
 */
export async function getPublicKeyForLogin(email: string): Promise<string | null> {
	if (email) {
		const normalized = email.toLowerCase().trim();
		const savedUserId = localStorage.getItem(`uid_${normalized}`);
		if (savedUserId) {
			const pubKey = await getStoredPublicKey(savedUserId);
			if (pubKey) return pubKey;
		}
	}
	try {
		const db = await openKeyDB();
		return new Promise<string | null>((resolve) => {
			const tx = db.transaction(IDB_STORE, 'readonly');
			const store = tx.objectStore(IDB_STORE);
			const req = store.openCursor();
			let foundPubKey: string | null = null;
			req.onsuccess = (e) => {
				const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
				if (cursor) {
					if (typeof cursor.key === 'string' && cursor.key.startsWith('pub_')) {
						foundPubKey = cursor.value;
						resolve(foundPubKey);
						return;
					}
					cursor.continue();
				} else {
					resolve(foundPubKey);
				}
			};
			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

/**
 * Remove both the encrypted private key blob, public key, and the wrapping key for a user.
 */
export async function clearStoredPrivateKey(userId: string | number): Promise<void> {
	const db = await openKeyDB();
	await Promise.all([
		idbDelete(db, `pk_${userId}`),
		idbDelete(db, `pub_${userId}`),
		idbDelete(db, `wk_${userId}`),
		idbDelete(db, String(userId)) // remove any legacy plaintext entry
	]);
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt plaintext using AES-GCM-256 with a hex-encoded key.
 * Returns a JSON string containing hex-encoded IV and ciphertext.
 */
export async function aesEncrypt(plaintext: string, keyHex: string): Promise<string> {
	const keyBytes = hexToBytes(keyHex);
	const key = await window.crypto.subtle.importKey(
		'raw',
		keyBytes as BufferSource,
		{ name: 'AES-GCM' },
		false,
		['encrypt']
	);
	const iv = window.crypto.getRandomValues(new Uint8Array(12));
	const ciphertextBuffer = await window.crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv as BufferSource },
		key,
		new TextEncoder().encode(plaintext)
	);
	return JSON.stringify({
		iv: bytesToHex(iv),
		ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer))
	});
}

/**
 * Decrypt ciphertext using AES-GCM-256 with a hex-encoded key.
 */
export async function aesDecrypt(encryptedJsonStr: string, keyHex: string): Promise<string> {
	const { iv: ivHex, ciphertext: cipherHex } = JSON.parse(encryptedJsonStr);
	const keyBytes = hexToBytes(keyHex);
	const key = await window.crypto.subtle.importKey(
		'raw',
		keyBytes as BufferSource,
		{ name: 'AES-GCM' },
		false,
		['decrypt']
	);
	const decryptedBuffer = await window.crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: hexToBytes(ivHex) as BufferSource },
		key,
		hexToBytes(cipherHex) as BufferSource
	);
	return new TextDecoder().decode(decryptedBuffer);
}
