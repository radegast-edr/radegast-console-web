<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api.js';
	import { showError } from '$lib/store.js';
	import { initAgeWasm, generateKeypair, storePrivateKey, aesEncrypt } from '$lib/crypto.js';

	let step = $state('init'); // 'init' | 'generating' | 'show_recovery' | 'done'
	let recoveryKey = $state('');
	let confirmed = $state(false);
	let error = $state('');
	let userId = $state(null);
	let keyName = $state('Primary Key');

	onMount(async () => {
		try {
			await initAgeWasm();
			const me = await api.me();
			userId = me.id;
			await generateAndSetupKeys();
		} catch (e) {
			error = 'Failed to load crypto library: ' + e.message;
		}
	});

	async function generateAndSetupKeys() {
		if (!keyName.trim()) {
			error = 'Please enter a name for your key pair';
			return;
		}
		step = 'generating';
		error = '';

		try {
			// 1. Generate main AGE keypair (used for encrypting logs)
			const { publicKey: mainPub, privateKey: mainPriv } = generateKeypair();

			// 2. Generate recovery AGE keypair
			const { publicKey: recoveryPub, privateKey: recoveryPriv } = generateKeypair();

			// 3. Generate random 256-bit AES key
			const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
			const aesKeyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

			// 4. AES-GCM-256 encrypt recovery private key with the AES key
			const encryptedRecoveryPriv = await aesEncrypt(recoveryPriv, aesKeyHex);

			// 5. Submit to backend
			await api.setupKeys({
				public_key: mainPub,
				recovery_public_key: recoveryPub,
				recovery_encrypted_private_key: encryptedRecoveryPriv,
				name: keyName.trim()
			});

			// 6. Store main private and public key in IndexedDB keyed by user ID
			await storePrivateKey(userId, mainPriv, mainPub);

			// Save userId for this email
			const me = await api.me();
			if (me && me.email) {
				localStorage.setItem(`uid_${me.email.toLowerCase().trim()}`, userId);
			}

			// 7. Show AES recovery key to user (this is the only time it's shown)
			recoveryKey = aesKeyHex;
			step = 'show_recovery';
		} catch (e) {
			error = e.message;
			step = 'ready';
		}
	}

	function finishSetup() {
		goto(`${base}/`);
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
					<div class="mb-3">
						<label for="keyName" class="form-label fw-bold">Name this key pair</label>
						<input
							type="text"
							class="form-control"
							id="keyName"
							placeholder="e.g. My Laptop, Work PC"
							bind:value={keyName}
							required
						/>
						<div class="form-text">Give this key pair a friendly name to identify it later.</div>
					</div>
					<button class="btn btn-primary" onclick={generateAndSetupKeys} disabled={!keyName.trim()}>
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
				<label for="setup-recovery-key" class="form-label fw-bold">Recovery Key (AES recovery key):</label>
				<textarea
					id="setup-recovery-key"
					class="form-control font-monospace mb-3"
					rows="2"
					readonly
					value={recoveryKey}
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
