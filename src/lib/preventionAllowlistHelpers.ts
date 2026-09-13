import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';

export interface DecryptableAllowlistEntry {
	value: string;
	description?: string | null;
	entry_type: 'path' | 'image';
}

/**
 * Encrypts prevention allowlist entry value and description using the group's public key.
 */
export async function encryptAllowlistEntry(
	value: string,
	description: string | null,
	groupPublicKey: string | null | undefined
): Promise<{ value: string; description: string | null }> {
	if (!groupPublicKey) {
		throw new Error('Group public key not available for encryption');
	}
	await initAgeWasm();
	return {
		value: encrypt(value, [groupPublicKey]),
		description: description ? encrypt(description, [groupPublicKey]) : null
	};
}

/**
 * Decrypts a list of prevention allowlist entries for a group using the group's private key.
 */
export async function decryptAllowlistEntries<T extends DecryptableAllowlistEntry>(
	entries: T[],
	groupPrivateKey: string | null | undefined,
	userId: number | string
): Promise<T[]> {
	if (!entries || entries.length === 0) return [];

	const userPriv = await getStoredPrivateKey(userId);
	if (!userPriv || !groupPrivateKey) {
		return entries.map((e) => ({
			...e,
			value: '[Encrypted]',
			description: e.description ? '[Encrypted]' : null
		}));
	}

	try {
		await initAgeWasm();
		const groupPriv = decrypt(groupPrivateKey, userPriv);
		return entries.map((e) => {
			try {
				return {
					...e,
					value: decrypt(e.value, groupPriv),
					description: e.description ? decrypt(e.description, groupPriv) : null
				};
			} catch {
				return {
					...e,
					value: '[Decryption Failed]',
					description: e.description ? '[Decryption Failed]' : null
				};
			}
		});
	} catch (err) {
		console.error('Failed to decrypt allowlist entries:', err);
		return entries.map((e) => ({
			...e,
			value: '[Encrypted]',
			description: e.description ? '[Encrypted]' : null
		}));
	}
}
