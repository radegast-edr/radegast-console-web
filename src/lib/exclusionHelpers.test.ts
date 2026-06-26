import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decryptExclusion, decryptExclusionsList, encryptExclusion } from './exclusionHelpers';
import { api } from '$lib/api';
import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';

vi.mock('$lib/api', () => ({
	api: {
		getGroup: vi.fn(),
		me: vi.fn()
	}
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn(),
	getStoredPrivateKey: vi.fn(),
	decrypt: vi.fn(),
	encrypt: vi.fn()
}));

describe('exclusionHelpers', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('decryptExclusion', () => {
		it('returns unencrypted exclusion as is', async () => {
			const exclusion = {
				name: 'Test Name',
				jsonata_query: 'rule.name = "Test"',
				description: 'Desc',
				encrypted: false
			};
			const result = await decryptExclusion(exclusion, 1);
			expect(result).toEqual({
				name: 'Test Name',
				jsonata_query: 'rule.name = "Test"',
				description: 'Desc'
			});
		});

		it('decrypts E2EE exclusion correctly when keys are available', async () => {
			const exclusion = {
				name: 'EncryptedName',
				jsonata_query: 'EncryptedQuery',
				description: 'EncryptedDesc',
				encrypted: true
			};

			vi.mocked(api.getGroup).mockResolvedValue({
				id: 1,
				private_key: 'GroupPrivKeyCipher'
			} as any);
			vi.mocked(api.me).mockResolvedValue({ id: 10 } as any);
			vi.mocked(getStoredPrivateKey).mockResolvedValue('UserPrivKey');
			vi.mocked(decrypt).mockImplementation((ciphertext, _key) => {
				if (ciphertext === 'GroupPrivKeyCipher') return 'GroupPrivKeyPlain';
				if (ciphertext === 'EncryptedName') return 'DecryptedName';
				if (ciphertext === 'EncryptedQuery') return 'DecryptedQuery';
				if (ciphertext === 'EncryptedDesc') return 'DecryptedDesc';
				return ciphertext;
			});

			const result = await decryptExclusion(exclusion, 1);
			expect(initAgeWasm).toHaveBeenCalled();
			expect(result).toEqual({
				name: 'DecryptedName',
				jsonata_query: 'DecryptedQuery',
				description: 'DecryptedDesc'
			});
		});

		it('returns original values if decryption fails', async () => {
			const exclusion = {
				name: 'EncryptedName',
				jsonata_query: 'EncryptedQuery',
				description: 'EncryptedDesc',
				encrypted: true
			};

			vi.mocked(api.getGroup).mockRejectedValue(new Error('API Error'));

			const result = await decryptExclusion(exclusion, 1);
			expect(result).toEqual({
				name: 'EncryptedName',
				jsonata_query: 'EncryptedQuery',
				description: 'EncryptedDesc'
			});
		});
	});

	describe('decryptExclusionsList', () => {
		it('returns empty list for empty input', async () => {
			const result = await decryptExclusionsList([], 'GroupPrivKey', 10);
			expect(result).toEqual([]);
		});

		it('decrypts multiple exclusions correctly', async () => {
			const exclusions = [
				{ name: 'EncryptedName1', jsonata_query: 'Query1', description: 'Desc1', encrypted: true },
				{ name: 'UnencryptedName', jsonata_query: 'Query2', description: 'Desc2', encrypted: false }
			];

			vi.mocked(getStoredPrivateKey).mockResolvedValue('UserPrivKey');
			vi.mocked(decrypt).mockImplementation((ciphertext, _key) => {
				if (ciphertext === 'GroupPrivKeyCipher') return 'GroupPrivKeyPlain';
				if (ciphertext === 'EncryptedName1') return 'DecryptedName1';
				return ciphertext;
			});

			const result = await decryptExclusionsList(exclusions, 'GroupPrivKeyCipher', 10);
			expect(initAgeWasm).toHaveBeenCalled();
			expect(result).toEqual([
				{ name: 'DecryptedName1', jsonata_query: 'Query1', description: 'Desc1', encrypted: true },
				{ name: 'UnencryptedName', jsonata_query: 'Query2', description: 'Desc2', encrypted: false }
			]);
		});
	});

	describe('encryptExclusion', () => {
		it('returns unencrypted exclusion without calls to wasm', async () => {
			const result = await encryptExclusion('Name', 'Query', 'Desc', false, null);
			expect(result).toEqual({
				name: 'Name',
				jsonata_query: 'Query',
				description: 'Desc'
			});
			expect(initAgeWasm).not.toHaveBeenCalled();
		});

		it('encrypts fields using group public key', async () => {
			vi.mocked(encrypt).mockImplementation((plain, _keys) => `Enc(${plain})`);
			const result = await encryptExclusion('Name', 'Query', 'Desc', true, 'PubKey');
			expect(initAgeWasm).toHaveBeenCalled();
			expect(result).toEqual({
				name: 'Enc(Name)',
				jsonata_query: 'Enc(Query)',
				description: 'Enc(Desc)'
			});
		});
	});
});
