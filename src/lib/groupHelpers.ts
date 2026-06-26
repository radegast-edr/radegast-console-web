import { api } from './api';
import { initAgeWasm, decrypt, encrypt } from './crypto';

/**
 * Attempts to decrypt the group's private key using the user's private key,
 * fetch the updated recipient public keys for the group, re-encrypt it,
 * and save it back to the server.
 * Returns true if the refresh succeeded, or throws an error if it failed.
 */
export async function refreshGroupKeys(
	groupId: number,
	groupName: string,
	encryptedPrivateKey: string,
	publicKey: string,
	userPrivateKey: string
): Promise<boolean> {
	try {
		await initAgeWasm();
		const groupPriv = decrypt(encryptedPrivateKey, userPrivateKey);
		const pubKeys = await api.getGroupRecipientPublicKeys(groupId);
		const encPriv = encrypt(groupPriv, pubKeys);
		await api.setupGroupKeys(groupId, {
			public_key: publicKey,
			private_key: encPriv
		});
		console.info(`Successfully refreshed keys for group ${groupName}`);
		return true;
	} catch (err) {
		console.error(`Failed to refresh keys for group ${groupName}:`, err);
		throw err;
	}
}
