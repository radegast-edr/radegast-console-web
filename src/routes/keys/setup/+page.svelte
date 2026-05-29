<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api.js';
	import { showError } from '$lib/store.js';
	import { initAgeWasm, generateKeypair, encrypt, storePrivateKey } from '$lib/crypto.js';

	let step = $state('init'); // 'init' | 'generating' | 'show_recovery' | 'done'
	let recoveryPrivateKey = $state('');
	let confirmed = $state(false);
	let error = $state('');
	let userId = $state(null);

	onMount(async () => {
		try {
			await initAgeWasm();
			const me = await api.me();
			userId = me.id;
			step = 'ready';
		} catch (e) {
			error = 'Failed to load crypto library: ' + e.message;
		}
	});

	async function generateAndSetupKeys() {
		step = 'generating';
		error = '';

		try {
			// 1. Generate main AGE keypair (used for encrypting logs)
			const { publicKey: mainPub, privateKey: mainPriv } = generateKeypair();

			// 2. Generate recovery AGE keypair (user saves the private key)
			const { publicKey: recoveryPub, privateKey: recoveryPriv } = generateKeypair();

			// 3. AGE-encrypt main private key with recovery public key
			const encryptedMainPriv = encrypt(mainPriv, [recoveryPub]);

			// 4. Submit to backend
			await api.setupKeys({
				public_key: mainPub,
				encrypted_private_key: encryptedMainPriv
			});

			// 5. Store main private key in IndexedDB keyed by user ID
			await storePrivateKey(userId, mainPriv);

			// 6. Show recovery key to user (this is the only time it's shown)
			recoveryPrivateKey = recoveryPriv;
			step = 'show_recovery';
		} catch (e) {
			error = e.message;
			step = 'ready';
		}
	}

	function finishSetup() {
		goto('/');
	}
</script>

<svelte:head>
	<title>Key Setup - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-7">
		<h2 class="mb-4">Key Setup</h2>

		{#if error}
			<div class="alert alert-danger">{error}</div>
		{/if}

		{#if step === 'init'}
			<div class="d-flex justify-content-center">
				<div class="spinner-border text-primary" role="status">
					<span class="visually-hidden">Loading crypto library…</span>
				</div>
			</div>

		{:else if step === 'ready'}
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">Generate Your Encryption Keys</h5>
					<p class="text-muted">
						Your private key is generated in this browser and never sent to the server.
						A recovery key will be shown once — store it somewhere safe.
					</p>
					<button class="btn btn-primary" onclick={generateAndSetupKeys}>
						Generate Keys
					</button>
				</div>
			</div>

		{:else if step === 'generating'}
			<div class="d-flex justify-content-center align-items-center gap-3">
				<div class="spinner-border text-primary" role="status">
					<span class="visually-hidden">Generating…</span>
				</div>
				<span>Generating keys…</span>
			</div>

		{:else if step === 'show_recovery'}
			<div class="alert alert-danger">
				<h5>⚠️ Save Your Recovery Key Now</h5>
				<p>
					This is the <strong>only time</strong> you'll see this key.
					If you lose your private key, you'll need this to recover access.
					Store it in a password manager or write it down.
				</p>
				<label class="form-label fw-bold">Recovery Key (AGE private key):</label>
				<textarea
					class="form-control font-monospace mb-3"
					rows="3"
					readonly
					value={recoveryPrivateKey}
				></textarea>
				<div class="form-check mb-3">
					<input
						class="form-check-input"
						type="checkbox"
						id="confirmSaved"
						bind:checked={confirmed}
					/>
					<label class="form-check-label" for="confirmSaved">
						I have saved my recovery key in a secure location.
					</label>
				</div>
				<button class="btn btn-danger" onclick={finishSetup} disabled={!confirmed}>
					I've Saved It — Continue to Dashboard
				</button>
			</div>
		{/if}
	</div>
</div>
