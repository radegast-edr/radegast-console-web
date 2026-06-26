import { api } from '$lib/api';
import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';

export interface DecryptableExclusion {
	name: string;
	jsonata_query: string;
	description?: string | null;
	encrypted: boolean;
}

/**
 * Decrypts a single exclusion's fields using the group's private key.
 * If decryption fails or private key is missing, returns original values.
 */
export async function decryptExclusion(
	exclusion: DecryptableExclusion,
	groupId: number
): Promise<{ name: string; jsonata_query: string; description: string }> {
	if (!exclusion.encrypted) {
		return {
			name: exclusion.name,
			jsonata_query: exclusion.jsonata_query,
			description: exclusion.description || ''
		};
	}

	try {
		const groupDetail = await api.getGroup(groupId);
		if (!groupDetail.private_key) {
			throw new Error('Group private key not available');
		}
		const me = await api.me();
		const userPriv = await getStoredPrivateKey(me.id);
		if (!userPriv) {
			throw new Error('User private key not available');
		}

		await initAgeWasm();
		const groupPriv = decrypt(groupDetail.private_key, userPriv);
		return {
			name: decrypt(exclusion.name, groupPriv),
			jsonata_query: decrypt(exclusion.jsonata_query, groupPriv),
			description: exclusion.description ? decrypt(exclusion.description, groupPriv) : ''
		};
	} catch (e) {
		console.error('Failed to decrypt exclusion:', e);
		return {
			name: exclusion.name,
			jsonata_query: exclusion.jsonata_query,
			description: exclusion.description || ''
		};
	}
}

/**
 * Decrypts a list of exclusions for a group.
 * Resolves the issue where WASM was not initialized before decrypting the group's private key.
 */
export async function decryptExclusionsList<T extends DecryptableExclusion>(
	exclusions: T[],
	groupPrivateKey: string | null | undefined,
	userId: number | string
): Promise<T[]> {
	if (!exclusions || exclusions.length === 0) return [];

	const userPriv = await getStoredPrivateKey(userId);
	if (!userPriv || !groupPrivateKey) {
		return exclusions.map((e) =>
			e.encrypted
				? {
						...e,
						name: '[Encrypted]',
						jsonata_query: '[Encrypted]',
						description: '[Encrypted]'
					}
				: e
		);
	}

	try {
		await initAgeWasm();
		const groupPriv = decrypt(groupPrivateKey, userPriv);
		return exclusions.map((e) => {
			if (!e.encrypted) return e;
			try {
				return {
					...e,
					name: decrypt(e.name, groupPriv),
					jsonata_query: decrypt(e.jsonata_query, groupPriv),
					description: e.description ? decrypt(e.description, groupPriv) : null
				};
			} catch {
				return {
					...e,
					name: `[Encrypted] ${e.name.substring(0, 10)}...`,
					jsonata_query: '[Decryption Failed]',
					description: '[Decryption Failed]'
				};
			}
		});
	} catch (e) {
		console.error('Failed to decrypt exclusions list:', e);
		return exclusions.map((e) =>
			e.encrypted
				? {
						...e,
						name: '[Encrypted]',
						jsonata_query: '[Encrypted]',
						description: '[Encrypted]'
					}
				: e
		);
	}
}

/**
 * Encrypts exclusion fields using the group's public key if encrypted is true.
 */
export async function encryptExclusion(
	name: string,
	query: string,
	description: string | null,
	encrypted: boolean,
	groupPublicKey: string | null | undefined
): Promise<{ name: string; jsonata_query: string; description: string | null }> {
	if (!encrypted) {
		return { name, jsonata_query: query, description };
	}
	if (!groupPublicKey) {
		throw new Error('Group public key not available for encryption');
	}
	await initAgeWasm();
	return {
		name: encrypt(name, [groupPublicKey]),
		jsonata_query: encrypt(query, [groupPublicKey]),
		description: description ? encrypt(description, [groupPublicKey]) : null
	};
}
