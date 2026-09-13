import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decryptAllowlistEntries, encryptAllowlistEntry } from './preventionAllowlistHelpers';
import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn(),
	getStoredPrivateKey: vi.fn(),
	decrypt: vi.fn(),
	encrypt: vi.fn()
}));

describe('preventionAllowlistHelpers', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('encryptAllowlistEntry', () => {
		it('throws if groupPublicKey is missing', async () => {
			await expect(encryptAllowlistEntry('/usr/bin/', 'desc', null)).rejects.toThrow(
				'Group public key not available for encryption'
			);
		});

		it('encrypts value and description using group public key', async () => {
			vi.mocked(encrypt).mockImplementation((plain, _keys) => `Enc(${plain})`);
			const result = await encryptAllowlistEntry('/usr/bin/', 'system path', 'PubKey');
			expect(initAgeWasm).toHaveBeenCalled();
			expect(result).toEqual({
				value: 'Enc(/usr/bin/)',
				description: 'Enc(system path)'
			});
		});

		it('handles null description', async () => {
			vi.mocked(encrypt).mockImplementation((plain, _keys) => `Enc(${plain})`);
			const result = await encryptAllowlistEntry('sshd', null, 'PubKey');
			expect(result).toEqual({
				value: 'Enc(sshd)',
				description: null
			});
		});
	});

	describe('decryptAllowlistEntries', () => {
		it('returns empty list for empty input', async () => {
			const result = await decryptAllowlistEntries([], 'GroupPrivKey', 10);
			expect(result).toEqual([]);
		});

		it('returns placeholder when user private key or group private key is missing', async () => {
			vi.mocked(getStoredPrivateKey).mockResolvedValue(null);
			const entries = [{ value: 'CipherVal', description: 'CipherDesc', entry_type: 'path' as const }];
			const result = await decryptAllowlistEntries(entries, 'GroupPrivKey', 10);
			expect(result).toEqual([
				{ value: '[Encrypted]', description: '[Encrypted]', entry_type: 'path' }
			]);
		});

		it('decrypts allowlist entries correctly', async () => {
			const entries = [
				{ value: 'EncPath', description: 'EncDesc', entry_type: 'path' as const },
				{ value: 'EncImg', description: null, entry_type: 'image' as const }
			];

			vi.mocked(getStoredPrivateKey).mockResolvedValue('UserPrivKey');
			vi.mocked(decrypt).mockImplementation((ciphertext, _key) => {
				if (ciphertext === 'GroupPrivKeyCipher') return 'GroupPrivKeyPlain';
				if (ciphertext === 'EncPath') return '/usr/bin/';
				if (ciphertext === 'EncDesc') return 'Desc';
				if (ciphertext === 'EncImg') return 'sshd';
				return ciphertext;
			});

			const result = await decryptAllowlistEntries(entries, 'GroupPrivKeyCipher', 10);
			expect(initAgeWasm).toHaveBeenCalled();
			expect(result).toEqual([
				{ value: '/usr/bin/', description: 'Desc', entry_type: 'path' },
				{ value: 'sshd', description: null, entry_type: 'image' }
			]);
		});

		it('handles decryption failure gracefully', async () => {
			const entries = [{ value: 'BadCipher', description: 'BadDesc', entry_type: 'path' as const }];
			vi.mocked(getStoredPrivateKey).mockResolvedValue('UserPrivKey');
			vi.mocked(decrypt).mockImplementation((ciphertext, _key) => {
				if (ciphertext === 'GroupPrivKeyCipher') return 'GroupPrivKeyPlain';
				throw new Error('Decryption error');
			});

			const result = await decryptAllowlistEntries(entries, 'GroupPrivKeyCipher', 10);
			expect(result).toEqual([
				{ value: '[Decryption Failed]', description: '[Decryption Failed]', entry_type: 'path' }
			]);
		});
	});
});
