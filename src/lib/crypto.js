/**
 * AGE encryption/decryption using agewasm.
 * Expects agewasm dist files to be served from /agewasm/.
 * Uses the Go WASM implementation from https://github.com/MarinX/agewasm
 */

let wasmReady = false;

/**
 * Initialize the agewasm module.
 * Call this once on app startup or before first crypto operation.
 */
export async function initAgeWasm() {
	if (wasmReady) return;

	if (!window.Go) {
		await loadScript('/agewasm/wasm_exec.js');
	}

	const go = new window.Go();
	const result = await WebAssembly.instantiateStreaming(
		fetch('/agewasm/main.wasm'),
		go.importObject
	);
	go.run(result.instance);
	wasmReady = true;
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
 * Generate an AGE keypair.
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateKeypair() {
	if (!wasmReady) throw new Error('agewasm not initialized');
	const result = window.ageKeygen();
	return {
		publicKey: result.publicKey,
		privateKey: result.privateKey
	};
}

/**
 * Encrypt plaintext for one or more AGE public key recipients.
 * @param {string} plaintext
 * @param {string[]} publicKeys - AGE public keys
 * @returns {string} encrypted (armored)
 */
export function encrypt(plaintext, publicKeys) {
	if (!wasmReady) throw new Error('agewasm not initialized');
	return window.ageEncrypt(plaintext, publicKeys);
}

/**
 * Decrypt AGE-encrypted ciphertext with a private key.
 * @param {string} ciphertext - armored AGE ciphertext
 * @param {string} privateKey - AGE private key
 * @returns {string} decrypted plaintext
 */
export function decrypt(ciphertext, privateKey) {
	if (!wasmReady) throw new Error('agewasm not initialized');
	return window.ageDecrypt(ciphertext, privateKey);
}

// --- Local storage helpers for private key ---

const PRIVATE_KEY_STORAGE_KEY = 'radegast_age_private_key';

export function getStoredPrivateKey() {
	return localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
}

export function storePrivateKey(privateKey) {
	localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, privateKey);
}

export function clearStoredPrivateKey() {
	localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
}
