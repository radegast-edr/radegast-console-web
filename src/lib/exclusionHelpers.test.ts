import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	agentVersionSupportsE2EE,
	applyExclusionToGroup,
	decryptExclusion,
	decryptExclusionsList,
	decryptWithGroupKeys,
	describeLastChange,
	encryptExclusion,
	encryptExclusionFields,
	groupSupportsE2EE,
	isUndecrypted,
	lastChangeAuthor,
	loadExclusionLibrary,
	loadGroupPrivateKeys,
	removeExclusionFromGroup,
	updateExclusionContent
} from './exclusionHelpers';
import { api, ApiError } from '$lib/api';
import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';

vi.mock('$lib/api', () => ({
	ApiError: class ApiError extends Error {
		status: number;
		constructor(message: string, status: number) {
			super(message);
			this.status = status;
		}
	},
	api: {
		getGroup: vi.fn(),
		me: vi.fn(),
		listGroups: vi.fn(),
		listExclusions: vi.fn(),
		updateExclusion: vi.fn(),
		getExclusionRecipients: vi.fn(),
		applyExclusionToGroup: vi.fn(),
		removeExclusionFromGroup: vi.fn()
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

describe('reusable exclusion helpers', () => {
	const fields = { name: 'Name', jsonata_query: 'Query', description: 'Desc' };
	const plainExclusion = { id: 7, version: 3, encrypted: false, group_count: 2 };
	const encryptedExclusion = { id: 7, version: 3, encrypted: true, group_count: 2 };
	const goodDevices = [{ agent_version: 'python 0.5.0' }];

	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(encrypt).mockImplementation((plain, keys) => `Enc(${plain}|${keys.join(',')})`);
	});

	describe('agentVersionSupportsE2EE / groupSupportsE2EE', () => {
		it('accepts python >= 0.5.0 and other agents, rejects old or unknown versions', () => {
			expect(agentVersionSupportsE2EE('python 0.5.0')).toBe(true);
			expect(agentVersionSupportsE2EE('python 1.0.0')).toBe(true);
			expect(agentVersionSupportsE2EE('rust 0.1.0')).toBe(true);
			expect(agentVersionSupportsE2EE('python 0.4.9')).toBe(false);
			expect(agentVersionSupportsE2EE('python 0.5')).toBe(false);
			expect(agentVersionSupportsE2EE('python a.b.c')).toBe(false);
			expect(agentVersionSupportsE2EE('unknown')).toBe(false);
			expect(agentVersionSupportsE2EE(null)).toBe(false);
		});

		it('requires group keys and supported agents', () => {
			expect(groupSupportsE2EE({ id: 1, public_key: 'pub', private_key: 'priv', devices: goodDevices })).toBe(true);
			expect(groupSupportsE2EE({ id: 1, public_key: 'pub', private_key: 'priv', devices: [] })).toBe(true);
			expect(groupSupportsE2EE({ id: 1, public_key: null, private_key: 'priv', devices: goodDevices })).toBe(false);
			expect(
				groupSupportsE2EE({ id: 1, public_key: 'pub', private_key: 'priv', devices: [{ agent_version: 'python 0.4.0' }] })
			).toBe(false);
		});
	});

	describe('encryptExclusionFields', () => {
		it('encrypts every field once for all unique recipients', async () => {
			const result = await encryptExclusionFields(fields, ['a', 'b', 'a', '']);
			expect(result).toEqual({ name: 'Enc(Name|a,b)', jsonata_query: 'Enc(Query|a,b)', description: 'Enc(Desc|a,b)' });
		});

		it('keeps an empty description empty', async () => {
			const result = await encryptExclusionFields({ ...fields, description: null }, ['a']);
			expect(result.description).toBeNull();
		});

		it('fails without recipients', async () => {
			await expect(encryptExclusionFields(fields, [''])).rejects.toThrow('No group public keys');
		});
	});

	describe('decryptWithGroupKeys', () => {
		const groups = [
			{ id: 1, name: 'A' },
			{ id: 2, name: 'B' }
		];

		it('returns plaintext exclusions unchanged', () => {
			const result = decryptWithGroupKeys({ ...fields, encrypted: false, groups }, new Map());
			expect(result).toEqual(fields);
		});

		it('tries the key of every group until one works', () => {
			vi.mocked(decrypt).mockImplementation((cipher, key) => {
				if (key !== 'key2') throw new Error('wrong key');
				return `Dec(${cipher})`;
			});
			const keys = new Map([
				[1, 'key1'],
				[2, 'key2']
			]);
			const result = decryptWithGroupKeys({ ...fields, encrypted: true, groups }, keys);
			expect(result).toEqual({ name: 'Dec(Name)', jsonata_query: 'Dec(Query)', description: 'Dec(Desc)' });
		});

		it('returns null when no key can decrypt', () => {
			const result = decryptWithGroupKeys({ ...fields, encrypted: true, groups }, new Map());
			expect(result).toBeNull();
		});
	});

	describe('loadGroupPrivateKeys', () => {
		it('decrypts the group keys the user can open', async () => {
			vi.mocked(getStoredPrivateKey).mockResolvedValue('UserPriv');
			vi.mocked(decrypt).mockImplementation((cipher) => {
				if (cipher === 'bad') throw new Error('not a recipient');
				return `Plain(${cipher})`;
			});
			const keys = await loadGroupPrivateKeys(
				[
					{ id: 1, private_key: 'g1' },
					{ id: 2, private_key: 'bad' },
					{ id: 3, private_key: null }
				],
				10
			);
			expect([...keys.entries()]).toEqual([[1, 'Plain(g1)']]);
		});

		it('returns no keys without a stored user key', async () => {
			vi.mocked(getStoredPrivateKey).mockResolvedValue(null);
			const keys = await loadGroupPrivateKeys([{ id: 1, private_key: 'g1' }], 10);
			expect(keys.size).toBe(0);
		});
	});

	describe('updateExclusionContent', () => {
		it('sends plaintext content with the current version', async () => {
			await updateExclusionContent(plainExclusion as any, fields, 'hard');
			expect(api.getExclusionRecipients).not.toHaveBeenCalled();
			expect(api.updateExclusion).toHaveBeenCalledWith(7, { version: 3, exclusion_type: 'hard', ...fields });
		});

		it('re-encrypts for the current recipients', async () => {
			vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 3, public_keys: ['k1', 'k2'] });
			await updateExclusionContent(encryptedExclusion as any, fields, 'soft');
			expect(api.updateExclusion).toHaveBeenCalledWith(7, {
				version: 3,
				exclusion_type: 'soft',
				name: 'Enc(Name|k1,k2)',
				jsonata_query: 'Enc(Query|k1,k2)',
				description: 'Enc(Desc|k1,k2)'
			});
		});

		it('reports a conflict when the exclusion changed in the meantime', async () => {
			vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 4, public_keys: ['k1', 'k2'] });
			await expect(updateExclusionContent(encryptedExclusion as any, fields, 'hard')).rejects.toBeInstanceOf(ApiError);
			expect(api.updateExclusion).not.toHaveBeenCalled();
		});

		it('refuses a recipient list that does not match the groups', async () => {
			vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 3, public_keys: ['k1', 'k2', 'intruder'] });
			await expect(updateExclusionContent(encryptedExclusion as any, fields, 'hard')).rejects.toThrow('do not match');
			expect(api.updateExclusion).not.toHaveBeenCalled();
		});
	});

	describe('applyExclusionToGroup', () => {
		const target = { id: 5, public_key: 'k5', private_key: 'p5', devices: goodDevices };

		it('applies plaintext exclusions without content', async () => {
			await applyExclusionToGroup(plainExclusion as any, fields, target);
			expect(api.applyExclusionToGroup).toHaveBeenCalledWith(7, 5, { version: 3 });
		});

		it('adds the target group key to the recipients', async () => {
			vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 3, public_keys: ['k1', 'k2'] });
			await applyExclusionToGroup(encryptedExclusion as any, fields, target);
			expect(api.applyExclusionToGroup).toHaveBeenCalledWith(7, 5, {
				version: 3,
				name: 'Enc(Name|k1,k2,k5)',
				jsonata_query: 'Enc(Query|k1,k2,k5)',
				description: 'Enc(Desc|k1,k2,k5)'
			});
		});

		it('refuses groups that cannot receive encrypted exclusions', async () => {
			await expect(
				applyExclusionToGroup(encryptedExclusion as any, fields, { ...target, devices: [{ agent_version: 'python 0.4.0' }] })
			).rejects.toThrow('cannot receive encrypted exclusions');
			expect(api.applyExclusionToGroup).not.toHaveBeenCalled();
		});
	});

	describe('removeExclusionFromGroup', () => {
		const group = { id: 2, public_key: 'k2' };

		it('removes plaintext exclusions without content', async () => {
			vi.mocked(api.removeExclusionFromGroup).mockResolvedValue({ message: 'ok', deleted: false });
			expect(await removeExclusionFromGroup(plainExclusion as any, fields, group)).toBe(false);
			expect(api.removeExclusionFromGroup).toHaveBeenCalledWith(7, 2, { version: 3 });
		});

		it('does not re-encrypt when removing the last group', async () => {
			vi.mocked(api.removeExclusionFromGroup).mockResolvedValue({ message: 'ok', deleted: true });
			const last = { ...encryptedExclusion, group_count: 1 };
			expect(await removeExclusionFromGroup(last as any, fields, group)).toBe(true);
			expect(api.getExclusionRecipients).not.toHaveBeenCalled();
		});

		it('re-encrypts for the remaining groups', async () => {
			vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 3, public_keys: ['k1', 'k2'] });
			vi.mocked(api.removeExclusionFromGroup).mockResolvedValue({ message: 'ok', deleted: false });
			await removeExclusionFromGroup(encryptedExclusion as any, fields, group);
			expect(api.removeExclusionFromGroup).toHaveBeenCalledWith(7, 2, {
				version: 3,
				name: 'Enc(Name|k1)',
				jsonata_query: 'Enc(Query|k1)',
				description: 'Enc(Desc|k1)'
			});
		});

		it("fails when the group's key is not a recipient", async () => {
			vi.mocked(api.getExclusionRecipients).mockResolvedValue({ version: 3, public_keys: ['k1', 'k3'] });
			await expect(removeExclusionFromGroup(encryptedExclusion as any, fields, group)).rejects.toThrow('not among');
			expect(api.removeExclusionFromGroup).not.toHaveBeenCalled();
		});
	});

	describe('loadExclusionLibrary', () => {
		it('loads groups and decrypts exclusions with the available group keys', async () => {
			vi.mocked(api.listExclusions).mockResolvedValue([
				{ id: 1, name: 'cipher', jsonata_query: 'cipherQ', description: null, encrypted: true, groups: [{ id: 1, name: 'A' }] },
				{ id: 2, name: 'plain', jsonata_query: 'q', description: null, encrypted: false, groups: [{ id: 2, name: 'B' }] }
			] as any);
			vi.mocked(api.listGroups).mockResolvedValue([{ id: 1 }, { id: 2 }] as any);
			vi.mocked(api.getGroup).mockImplementation(async (id: number) => {
				if (id === 2) throw new Error('gone');
				return { id: 1, name: 'A', private_key: 'g1' } as any;
			});
			vi.mocked(getStoredPrivateKey).mockResolvedValue('UserPriv');
			vi.mocked(decrypt).mockImplementation((cipher) => `Dec(${cipher})`);

			const result = await loadExclusionLibrary(10);
			expect(result.groups.map((g) => g.id)).toEqual([1]);
			expect(result.exclusions[0].decrypted).toEqual({ name: 'Dec(cipher)', jsonata_query: 'Dec(cipherQ)', description: null });
			expect(result.exclusions[1].decrypted).toEqual({ name: 'plain', jsonata_query: 'q', description: null });
		});
	});

	describe('last change formatting', () => {
		it('describes each action', () => {
			const base = { at: null, by_user_id: 1, by_email: 'a@b.c', group_id: null, group_name: null };
			expect(describeLastChange({ ...base, action: 'created' })).toBe('Created');
			expect(describeLastChange({ ...base, action: 'updated' })).toBe('Edited');
			expect(describeLastChange({ ...base, action: 'applied', group_id: 3, group_name: 'Servers' })).toBe('Applied to Servers');
			expect(describeLastChange({ ...base, action: 'removed', group_id: 3, group_name: null })).toBe('Removed from a deleted group');
			expect(describeLastChange({ ...base, action: 'migrated' })).toBe('Created before change tracking');
			expect(describeLastChange(null)).toBe('');
		});

		it('names the author', () => {
			const base = { at: null, by_user_id: null, group_id: null, group_name: null };
			expect(lastChangeAuthor({ ...base, action: 'updated', by_email: 'a@b.c' })).toBe('a@b.c');
			expect(lastChangeAuthor({ ...base, action: 'updated', by_email: null })).toBe('Deleted user');
			expect(lastChangeAuthor({ ...base, action: 'migrated', by_email: null })).toBe('Unknown');
		});
	});
});

describe('isUndecrypted', () => {
	it('detects ciphertext and decryption placeholders on encrypted exclusions', () => {
		const age = '-----BEGIN AGE ENCRYPTED FILE-----\nabc';
		expect(isUndecrypted({ encrypted: true, name: age, jsonata_query: age })).toBe(true);
		expect(isUndecrypted({ encrypted: true, name: '[Encrypted]', jsonata_query: '[Encrypted]' })).toBe(true);
		expect(isUndecrypted({ encrypted: true, name: '[Encrypted] abc...', jsonata_query: '[Decryption Failed]' })).toBe(true);
		expect(isUndecrypted({ encrypted: true, name: 'Backups', jsonata_query: 'rule.name = "x"' })).toBe(false);
		expect(isUndecrypted({ encrypted: false, name: '[Encrypted]', jsonata_query: 'q' })).toBe(false);
	});
});

