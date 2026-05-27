<script>
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import { storePrivateKey } from '$lib/crypto.js';

	let recoveryKey = $state('');
	let success = $state(false);

	async function recover() {
		try {
			const result = await api.recoverKeys(recoveryKey);
			storePrivateKey(result.private_key);
			success = true;
			showFlash('Keys recovered successfully! Private key stored in browser.');
		} catch (e) {
			showError(e.message);
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
				Enter the recovery key that was shown to you when you first set up your account.
			</p>
			<form onsubmit={(e) => { e.preventDefault(); recover(); }}>
				<div class="mb-3">
					<label for="recoveryKey" class="form-label">Recovery Key</label>
					<input
						type="text"
						class="form-control font-monospace"
						id="recoveryKey"
						bind:value={recoveryKey}
						placeholder="Base64 recovery key..."
						required
					/>
				</div>
				<button type="submit" class="btn btn-primary">Recover Keys</button>
			</form>
		{/if}
	</div>
</div>
