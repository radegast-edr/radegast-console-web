import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	initAgeWasm,
	generateKeypair,
	encrypt,
	decrypt,
	storePrivateKey,
	getStoredPrivateKey,
	getStoredPublicKey,
	clearStoredPrivateKey,
	getPublicKeyForLogin,
	aesEncrypt,
	aesDecrypt
} from './crypto';

// In-memory mock storage for IndexedDB
let mockDbStore: Record<string, any> = {};

const mockIndexedDB = {
	open: () => {
		const req = {
			onsuccess: null as any,
			onerror: null as any,
			onupgradeneeded: null as any,
			result: {
				objectStoreNames: {
					contains: () => true
				},
				transaction: () => ({
					objectStore: () => ({
						get: (key: string) => {
							const getReq = {
								onsuccess: null as any,
								onerror: null as any,
								result: mockDbStore[key]
							};
							setTimeout(() => {
								if (getReq.onsuccess) getReq.onsuccess();
							}, 0);
							return getReq;
						},
						put: (val: any, key: string) => {
							mockDbStore[key] = val;
							const putReq = {
								onsuccess: null as any,
								onerror: null as any
							};
							setTimeout(() => {
								if (putReq.onsuccess) putReq.onsuccess();
							}, 0);
							return putReq;
						},
						delete: (key: string) => {
							delete mockDbStore[key];
							const delReq = {
								onsuccess: null as any,
								onerror: null as any
							};
							setTimeout(() => {
								if (delReq.onsuccess) delReq.onsuccess();
							}, 0);
							return delReq;
						},
						openCursor: () => {
							const keys = Object.keys(mockDbStore);
							let index = 0;
							const cursorReq = {
								onsuccess: null as any,
								onerror: null as any,
								result: null as any
							};
							const getCursorResult = (): any => {
								if (index >= keys.length) return null;
								const key = keys[index];
								return {
									key,
									value: mockDbStore[key],
									continue: () => {
										index++;
										cursorReq.result = getCursorResult();
										if (cursorReq.onsuccess) {
											cursorReq.onsuccess({ target: cursorReq });
										}
									}
								};
							};
							cursorReq.result = getCursorResult();
							setTimeout(() => {
								if (cursorReq.onsuccess) cursorReq.onsuccess({ target: cursorReq });
							}, 0);
							return cursorReq;
						}
					})
				})
			}
		};
		setTimeout(() => {
			if (req.onsuccess) req.onsuccess({ target: req });
		}, 0);
		return req;
	}
};

describe('crypto', () => {
	beforeEach(() => {
		mockDbStore = {};
		vi.stubGlobal('indexedDB', mockIndexedDB);

		// Mock the window/global Go runtime for WASM
		vi.stubGlobal('Go', class {
			importObject = {};
			run() {}
		});
		vi.stubGlobal('WebAssembly', {
			instantiateStreaming: async () => ({
				instance: {}
			})
		});

		// Mock AGE functions
		vi.stubGlobal('generateX25519Identity', () => ({
			publicKey: 'age1pubkey123',
			privateKey: 'AGE-SECRET-KEY-1PRIVKEY123'
		}));
		vi.stubGlobal('encrypt', (recipients: string, plaintext: string) => {
			if (plaintext.includes('fail')) {
				return { output: '', error: 'encryption failed' };
			}
			return { output: `enc(${plaintext})` };
		});
		vi.stubGlobal('decrypt', (privateKey: string, ciphertext: string) => {
			if (ciphertext.includes('fail')) {
				return { output: '', error: 'decryption failed' };
			}
			return { output: ciphertext.replace('enc(', '').replace(')', '') };
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('initAgeWasm & keypair & encrypt/decrypt wrapper', () => {
		it('throws error when generateKeypair/encrypt/decrypt are called before WASM is ready', () => {
			expect(() => generateKeypair()).toThrow('agewasm not initialized');
			expect(() => encrypt('test', ['pubkey'])).toThrow('agewasm not initialized');
			expect(() => decrypt('ciphertext', 'privkey')).toThrow('agewasm not initialized');
		});

		it('succeeds after WASM is initialized', async () => {
			// Mock fetch for script/wasm loading
			vi.stubGlobal('fetch', async () => ({
				arrayBuffer: async () => new ArrayBuffer(0)
			}));
			// Stub loadScript behavior by defining window.Go inside loadScript's promise,
			// but we already stubbed Go globally, so that's fine.
			
			await initAgeWasm();
			
			const keys = generateKeypair();
			expect(keys).toEqual({
				publicKey: 'age1pubkey123',
				privateKey: 'AGE-SECRET-KEY-1PRIVKEY123'
			});

			const ct = encrypt('hello world', ['age1pubkey123']);
			expect(ct).toBe('enc(hello world)');

			const pt = decrypt(ct, 'AGE-SECRET-KEY-1PRIVKEY123');
			expect(pt).toBe('hello world');
		});

		it('throws when AGE encrypt or decrypt fails in Go runtime', async () => {
			await initAgeWasm();
			expect(() => encrypt('fail', ['age1pubkey123'])).toThrow('encryption failed');
			expect(() => decrypt('enc(fail)', 'AGE-SECRET-KEY-1PRIVKEY123')).toThrow('decryption failed');
		});
	});

	describe('IndexedDB Key Storage', () => {
		it('returns null when no keys are stored', async () => {
			const priv = await getStoredPrivateKey('user1');
			expect(priv).toBeNull();
			const pub = await getStoredPublicKey('user1');
			expect(pub).toBeNull();
		});

		it('stores and retrieves private and public keys', async () => {
			await storePrivateKey('user1', 'AGE-SECRET-KEY-1PRIVKEY123', 'age1pubkey123');

			const priv = await getStoredPrivateKey('user1');
			expect(priv).toBe('AGE-SECRET-KEY-1PRIVKEY123');

			const pub = await getStoredPublicKey('user1');
			expect(pub).toBe('age1pubkey123');
		});

		it('clears stored keys', async () => {
			await storePrivateKey('user1', 'AGE-SECRET-KEY-1PRIVKEY123', 'age1pubkey123');
			await clearStoredPrivateKey('user1');

			const priv = await getStoredPrivateKey('user1');
			expect(priv).toBeNull();
			const pub = await getStoredPublicKey('user1');
			expect(pub).toBeNull();
		});

		it('falls back when loading public key for login', async () => {
			// Stub localStorage
			const storage: Record<string, string> = {};
			vi.stubGlobal('localStorage', {
				getItem: (key: string) => storage[key] || null,
				setItem: (key: string, val: string) => { storage[key] = val; },
				removeItem: (key: string) => { delete storage[key]; }
			});

			// No emails mapping yet
			let pub = await getPublicKeyForLogin('test@example.com');
			expect(pub).toBeNull();

			// Store keys for a user
			await storePrivateKey('user123', 'AGE-SECRET-KEY-1PRIVKEY123', 'age1pubkey123');
			
			// Map email to user ID in localStorage
			localStorage.setItem('uid_test@example.com', 'user123');
			pub = await getPublicKeyForLogin('test@example.com');
			expect(pub).toBe('age1pubkey123');

			// Fallback: If localStorage is empty, openCursor finds first pub key
			localStorage.removeItem('uid_test@example.com');
			pub = await getPublicKeyForLogin('test@example.com');
			// Since pub_user123 is stored in IndexedDB, cursor should find it
			expect(pub).toBe('age1pubkey123');
		});
	});

	describe('AES-GCM helpers (aesEncrypt & aesDecrypt)', () => {
		it('encrypts and decrypts a message using a hex-encoded key', async () => {
			const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 256-bit hex
			const plaintext = 'Secret database credentials';
			
			const cipherJsonStr = await aesEncrypt(plaintext, keyHex);
			const parsed = JSON.parse(cipherJsonStr);
			expect(parsed).toHaveProperty('iv');
			expect(parsed).toHaveProperty('ciphertext');

			const decrypted = await aesDecrypt(cipherJsonStr, keyHex);
			expect(decrypted).toBe(plaintext);
		});
	});
});
