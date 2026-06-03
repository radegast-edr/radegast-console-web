<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import { initAgeWasm, storePrivateKey, aesDecrypt } from '$lib/crypto';

	let recoveryKey = $state('');
	let success = $state(false);
	let wasmReady = $state(false);
	let userId = $state<number | null>(null);

	onMount(async () => {
		try {
			await initAgeWasm();
			wasmReady = true;
		} catch (e) {
			showError('Failed to load crypto library: ' + (e as Error).message);
		}
		try {
			const me = await api.me();
			userId = me.id;
		} catch {
			// not logged in — layout will redirect
		}
	});

	async function recover(): Promise<void> {
		try {
			const keys = await api.recoverKeys();
			let decryptedKey: string | null = null;
			let matchedPublicKey: string | null = null;
			for (const key of keys) {
				if (!key.encrypted_private_key) continue;
				try {
					decryptedKey = await aesDecrypt(key.encrypted_private_key, recoveryKey.trim());
					if (decryptedKey) {
						matchedPublicKey = key.public_key;
						break;
					}
				} catch (e) {
					// continue
				}
			}
			if (!decryptedKey || !matchedPublicKey || userId === null) {
				throw new Error('No matching recovery key found or decryption failed.');
			}
			await storePrivateKey(userId, decryptedKey, matchedPublicKey);
			success = true;
			showFlash('Keys recovered successfully! Private key stored in browser.');
		} catch (e) {
			showError('Recovery failed — check that you entered the correct recovery key.');
		}
	}
</script>

<svelte:head>
	<title>Key Recovery - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6">
		<h2 class="mb-4">Key Recovery</h2>

		{#if success}
			<div class="alert alert-success">
				Your private key has been recovered and stored in this browser. You can now decrypt logs.
			</div>
			<a href="{base}/" class="btn btn-primary">Go to Dashboard</a>
		{:else}
			<p class="text-muted">
				Enter the AGE recovery key that was shown when you first set up your account.
			</p>
			<form onsubmit={(e) => { e.preventDefault(); recover(); }}>
				<div class="mb-3">
					<label for="recoveryKey" class="form-label">Recovery Key</label>
					<textarea
						class="form-control font-monospace"
						id="recoveryKey"
						rows="3"
						bind:value={recoveryKey}
						placeholder="AGE-SECRET-KEY-1..."
						required
					></textarea>
				</div>
				<button type="submit" class="btn btn-primary" disabled={!wasmReady}>
					{wasmReady ? 'Recover Keys' : 'Loading…'}
				</button>
			</form>
		{/if}
	</div>
</div>
