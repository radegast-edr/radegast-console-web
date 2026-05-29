<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import { initAgeWasm, decrypt, storePrivateKey } from '$lib/crypto.js';

	let recoveryKey = $state('');
	let success = $state(false);
	let wasmReady = $state(false);

	onMount(async () => {
		try {
			await initAgeWasm();
			wasmReady = true;
		} catch (e) {
			showError('Failed to load crypto library: ' + e.message);
		}
	});

	async function recover() {
		try {
			const result = await api.recoverKeys();
			// Decrypt the stored encrypted private key using the AGE recovery private key
			const mainPriv = decrypt(result.encrypted_private_key, recoveryKey.trim());
			storePrivateKey(mainPriv);
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
			<a href="/" class="btn btn-primary">Go to Dashboard</a>
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
