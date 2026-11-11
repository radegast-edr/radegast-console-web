import { api, ApiError, type Exclusion, type GroupDetail } from '$lib/api';
import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';

export interface DecryptableExclusion {
	name: string;
	jsonata_query: string;
	description?: string | null;
	encrypted: boolean;
}

/**
 * Decrypts a single exclusion's fields using the private key of one of its groups.
 * If decryption fails, the private key is missing or no group is given, returns original values.
 */
export async function decryptExclusion(
	exclusion: DecryptableExclusion,
	groupId: number | null
): Promise<{ name: string; jsonata_query: string; description: string }> {
	if (!exclusion.encrypted || groupId === null) {
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
	return encryptExclusionFields({ name, jsonata_query: query, description }, [groupPublicKey]);
}

/**
 * True when an encrypted exclusion could not be decrypted: its fields still hold the AGE
 * ciphertext or one of the placeholders set by the decrypt helpers. Such an exclusion must
 * not be edited, otherwise the placeholder text would be saved as its new content.
 */
export function isUndecrypted(exclusion: { encrypted: boolean; name: string; jsonata_query: string }): boolean {
	if (!exclusion.encrypted) return false;
	const looksEncrypted = (v: string) =>
		v.startsWith('-----BEGIN AGE ENCRYPTED FILE-----') || v.startsWith('[Encrypted]') || v === '[Decryption Failed]';
	return looksEncrypted(exclusion.name) || looksEncrypted(exclusion.jsonata_query);
}

// ---------------------------------------------------------------------------
// Reusable exclusions: one exclusion applied to several device groups.
//
// An encrypted exclusion holds a single AGE ciphertext per field, encrypted for the
// public key of every group it is applied to. Changing the content or the set of groups
// therefore re-encrypts the fields for the new list of recipients.
// ---------------------------------------------------------------------------

export interface ExclusionFields {
	name: string;
	jsonata_query: string;
	description: string | null;
}

type VersionedExclusion = Pick<Exclusion, 'id' | 'version' | 'encrypted' | 'group_count'>;

interface GroupWithKeys {
	id: number;
	public_key?: string | null;
	private_key?: string | null;
	devices?: { agent_version?: string | null }[] | null;
}

/**
 * Python agents older than 0.5.0 (and agents with an unknown version) cannot decrypt exclusions.
 */
export function agentVersionSupportsE2EE(version: string | null | undefined): boolean {
	if (!version) return false;
	const trimmed = version.trim();
	if (!trimmed || trimmed.toLowerCase() === 'unknown') return false;
	if (trimmed.startsWith('python ')) {
		const parts = trimmed.substring(7).trim().split('.').map(Number);
		if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) return false;
		const [major, minor] = parts;
		return major > 0 || minor >= 5;
	}
	return true;
}

/**
 * A group can receive encrypted exclusions when its keys are set up and all of its agents support E2EE.
 */
export function groupSupportsE2EE(group: GroupWithKeys): boolean {
	if (!group.public_key || !group.private_key) return false;
	return (group.devices ?? []).every((d) => agentVersionSupportsE2EE(d.agent_version));
}

/**
 * Encrypt all exclusion fields for the given AGE recipients.
 */
export async function encryptExclusionFields(fields: ExclusionFields, publicKeys: string[]): Promise<ExclusionFields> {
	const recipients = [...new Set(publicKeys.filter(Boolean))];
	if (recipients.length === 0) {
		throw new Error('No group public keys available for encryption');
	}
	await initAgeWasm();
	return {
		name: encrypt(fields.name, recipients),
		jsonata_query: encrypt(fields.jsonata_query, recipients),
		description: fields.description ? encrypt(fields.description, recipients) : null
	};
}

/**
 * Current recipients of an encrypted exclusion. Guards against a recipient list that does not
 * match the number of groups the exclusion is applied to.
 */
async function currentRecipients(exclusion: VersionedExclusion): Promise<string[]> {
	const recipients = await api.getExclusionRecipients(exclusion.id);
	if (recipients.version !== exclusion.version) {
		throw new ApiError('The exclusion was changed by someone else. Reload it and try again.', 409);
	}
	if (recipients.public_keys.length !== exclusion.group_count) {
		throw new Error('The encryption keys of the exclusion groups do not match its groups');
	}
	return recipients.public_keys;
}

/**
 * Decrypt the private keys of the given groups with the current user's key.
 * Groups the user cannot decrypt are skipped.
 */
export async function loadGroupPrivateKeys(groups: GroupWithKeys[], userId: number | string): Promise<Map<number, string>> {
	const keys = new Map<number, string>();
	const userPriv = await getStoredPrivateKey(userId);
	if (!userPriv) return keys;
	await initAgeWasm();
	for (const g of groups) {
		if (!g.private_key) continue;
		try {
			keys.set(g.id, decrypt(g.private_key, userPriv));
		} catch {
			// The user is not a recipient of this group key (yet)
		}
	}
	return keys;
}

/**
 * Decrypt an exclusion with the key of any group it is applied to.
 * Returns null if none of the available group keys can decrypt it.
 */
export function decryptWithGroupKeys(
	exclusion: Pick<Exclusion, 'name' | 'jsonata_query' | 'description' | 'encrypted' | 'groups'>,
	groupKeys: Map<number, string>
): ExclusionFields | null {
	if (!exclusion.encrypted) {
		return {
			name: exclusion.name,
			jsonata_query: exclusion.jsonata_query,
			description: exclusion.description ?? null
		};
	}
	for (const g of exclusion.groups ?? []) {
		const key = groupKeys.get(g.id);
		if (!key) continue;
		try {
			return {
				name: decrypt(exclusion.name, key),
				jsonata_query: decrypt(exclusion.jsonata_query, key),
				description: exclusion.description ? decrypt(exclusion.description, key) : null
			};
		} catch {
			// Try the next group key
		}
	}
	return null;
}

/**
 * Update the content of an exclusion in every group it is applied to (keeps its ID).
 */
export async function updateExclusionContent(
	exclusion: VersionedExclusion,
	fields: ExclusionFields,
	exclusionType: 'hard' | 'soft'
): Promise<Exclusion> {
	const content = exclusion.encrypted ? await encryptExclusionFields(fields, await currentRecipients(exclusion)) : fields;
	return api.updateExclusion(exclusion.id, { version: exclusion.version, exclusion_type: exclusionType, ...content });
}

/**
 * Apply an existing exclusion to another device group.
 */
export async function applyExclusionToGroup(
	exclusion: VersionedExclusion,
	fields: ExclusionFields,
	group: GroupWithKeys
): Promise<Exclusion> {
	if (!exclusion.encrypted) {
		return api.applyExclusionToGroup(exclusion.id, group.id, { version: exclusion.version });
	}
	if (!groupSupportsE2EE(group) || !group.public_key) {
		throw new Error('This group cannot receive encrypted exclusions (missing keys or agents older than python 0.5.0)');
	}
	const recipients = [...(await currentRecipients(exclusion)), group.public_key];
	const content = await encryptExclusionFields(fields, recipients);
	return api.applyExclusionToGroup(exclusion.id, group.id, { version: exclusion.version, ...content });
}

/**
 * Remove an exclusion from a device group. Removing it from its last group deletes it.
 * Returns true if the exclusion was deleted.
 */
export async function removeExclusionFromGroup(
	exclusion: VersionedExclusion,
	fields: ExclusionFields,
	group: GroupWithKeys
): Promise<boolean> {
	if (!exclusion.encrypted || exclusion.group_count <= 1) {
		const res = await api.removeExclusionFromGroup(exclusion.id, group.id, { version: exclusion.version });
		return res.deleted ?? false;
	}
	const current = await currentRecipients(exclusion);
	const remaining = current.filter((k) => k !== group.public_key);
	if (remaining.length !== current.length - 1) {
		throw new Error("The group's key is not among the exclusion's encryption keys");
	}
	const content = await encryptExclusionFields(fields, remaining);
	const res = await api.removeExclusionFromGroup(exclusion.id, group.id, { version: exclusion.version, ...content });
	return res.deleted ?? false;
}

/**
 * Load all exclusions visible to the user together with the details of their groups,
 * decrypted where possible.
 */
export async function loadExclusionLibrary(userId: number | string): Promise<{
	exclusions: (Exclusion & { decrypted: ExclusionFields | null })[];
	groups: GroupDetail[];
}> {
	const [exclusions, groupList] = await Promise.all([api.listExclusions(), api.listGroups()]);
	const details = await Promise.all(
		groupList.map(async (g) => {
			try {
				return await api.getGroup(g.id);
			} catch (e) {
				console.error(`Failed to load group ${g.id}:`, e);
				return null;
			}
		})
	);
	const groups = details.filter((g): g is GroupDetail => g !== null);
	const groupKeys = exclusions.some((e) => e.encrypted) ? await loadGroupPrivateKeys(groups, userId) : new Map<number, string>();
	return {
		exclusions: exclusions.map((e) => ({ ...e, decrypted: decryptWithGroupKeys(e, groupKeys) })),
		groups
	};
}

/**
 * Human readable description of an exclusion's last change.
 */
export function describeLastChange(change: Exclusion['last_change']): string {
	if (!change) return '';
	const group = change.group_name ?? (change.group_id ? 'a deleted group' : '');
	switch (change.action) {
		case 'created':
			return 'Created';
		case 'updated':
			return 'Edited';
		case 'applied':
			return group ? `Applied to ${group}` : 'Applied to a group';
		case 'removed':
			return group ? `Removed from ${group}` : 'Removed from a group';
		case 'migrated':
			return 'Created before change tracking';
		default:
			return change.action;
	}
}

/**
 * Who made the last change ("Deleted user" when the account no longer exists).
 */
export function lastChangeAuthor(change: Exclusion['last_change']): string {
	if (!change) return '';
	if (change.by_email) return change.by_email;
	return change.action === 'migrated' ? 'Unknown' : 'Deleted user';
}
