<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import { initAgeWasm, generateKeypair, encrypt, decrypt, getStoredPrivateKey, storePrivateKey, aesEncrypt } from '$lib/crypto';

	let wasmReady = $state(false);
	let hasKey = $state(false);
	let hasKeysOnServer = $state<boolean | null>(null); // null = unknown
	let userId = $state<number | null>(null);

	// Receiver state
	let transferId = $state('');
	let polling = $state(false);
	let pollInterval: ReturnType<typeof setInterval> | undefined = undefined;

	// Sender state
	let senderTransferId = $state('');
	let senderSent = $state(false);

	// Generate-new-keys state
	let genStep = $state<'generating' | 'show_recovery' | ''>(''); // '' | 'generating' | 'show_recovery'
	let genRecoveryPrivateKey = $state('');
	let genAsSecondary = $state(false);
	let genConfirmed = $state(false);
	let genError = $state('');

	const EPH_PRIV_KEY = 'radegast_transfer_eph_priv';

	onMount(() => {
		const loadData = async () => {
			try {
				await initAgeWasm();
				wasmReady = true;
			} catch (e) {
				showError('Failed to load crypto library: ' + (e as Error).message);
			}
			try {
				const me = await api.me();
				userId = me.id;
				hasKeysOnServer = me.has_keys;
			} catch {
				hasKeysOnServer = false;
			}
			hasKey = userId !== null ? !!(await getStoredPrivateKey(userId)) : false;
		};
		loadData();
		return () => { if (pollInterval !== undefined) clearInterval(pollInterval); };
	});

	// ── Receiver side ───────────────────────────────────────────────

	async function startReceiving(): Promise<void> {
		const { publicKey: ephPub, privateKey: ephPriv } = generateKeypair();
		sessionStorage.setItem(EPH_PRIV_KEY, ephPriv);

		const result = await api.transferInitiate(ephPub);
		transferId = result.transfer_id;
		polling = true;
		pollInterval = setInterval(pollTransfer, 3000);
	}

	async function pollTransfer(): Promise<void> {
		try {
			const status = await api.transferGet(String(transferId));
			if (status.status === 'completed' && status.encrypted_private_key) {
				if (pollInterval !== undefined) {
					clearInterval(pollInterval);
					pollInterval = undefined;
				}
				polling = false;

				const ephPriv = sessionStorage.getItem(EPH_PRIV_KEY);
				sessionStorage.removeItem(EPH_PRIV_KEY);

				if (!ephPriv) throw new Error('Ephemeral private key missing from session storage');

				const mainPriv = decrypt(status.encrypted_private_key!, ephPriv);
				
				let matchedPubKey: string | null = null;
				try {
					const allKeys = await api.listKeys();
					const testMsg = 'match-check';
					for (const key of allKeys) {
						try {
							const cipher = encrypt(testMsg, [key.public_key]);
							const dec = decrypt(cipher, mainPriv);
							if (dec === testMsg) {
								matchedPubKey = key.public_key;
								break;
							}
						} catch (e) {
							// ignore and continue
						}
					}
				} catch (e) {
					console.error("Failed to match public key during transfer:", e);
				}

				if (userId === null) {
					throw new Error('User ID not set');
				}
				await storePrivateKey(userId, mainPriv, matchedPubKey);
				showFlash('Key transferred successfully!');
				goto(`${base}/`);
			}
		} catch (e) {
			if (pollInterval !== undefined) {
				clearInterval(pollInterval);
				pollInterval = undefined;
			}
			polling = false;
			showError('Transfer failed or expired: ' + (e as Error).message);
		}
	}

	// ── Sender side ─────────────────────────────────────────────────

	async function sendKey(): Promise<void> {
		if (userId === null) {
			showError('User ID not set');
			return;
		}
		try {
			const transfer = await api.transferGet(String(senderTransferId.trim()));
			const receiverPub = transfer.receiver_age_public_key;

			const mainPriv = await getStoredPrivateKey(userId);
			if (!mainPriv) { showError('No private key in this browser.'); return; }

			const encryptedPayload = encrypt(mainPriv, [receiverPub]);
			await api.transferComplete(String(senderTransferId.trim()), encryptedPayload);
			senderSent = true;
			showFlash('Key sent! The other browser should receive it shortly.');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function generateNewKeys(): Promise<void> {
		genStep = 'generating';
		genError = '';

		try {
			// Generate a fresh main AGE keypair
			const { publicKey: mainPub, privateKey: mainPriv } = generateKeypair();

			// Generate random 256-bit AES key
			const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
			const aesKeyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

			if (genAsSecondary) {
				// Encrypt main private key with AES key
				const encryptedMainPriv = await aesEncrypt(mainPriv, aesKeyHex);
				// Add alongside existing keys as a secondary key
				await api.setupSecondaryKey({ public_key: mainPub, encrypted_private_key: encryptedMainPriv });
			} else {
				// Setup keys: generate recovery AGE keypair, encrypt recovery private key with AES key
				const { publicKey: recoveryPub, privateKey: recoveryPriv } = generateKeypair();
				const encryptedRecoveryPriv = await aesEncrypt(recoveryPriv, aesKeyHex);

				// Fresh start: delete old keys then create new main key
				if (hasKeysOnServer) {
					await api.deleteKeys();
				}
				await api.setupKeys({ public_key: mainPub, recovery_public_key: recoveryPub, recovery_encrypted_private_key: encryptedRecoveryPriv });
			}

			if (userId === null) {
				throw new Error('User ID not set');
			}
			await storePrivateKey(userId, mainPriv);
			genRecoveryPrivateKey = aesKeyHex;
			genStep = 'show_recovery';
		} catch (e) {
			genError = (e as Error).message;
			genStep = '';
		}
	}
</script>

<svelte:head>
	<title>Key Transfer - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-7">
		<h2 class="mb-4">Key Transfer</h2>

		{#if !wasmReady}
			<div class="d-flex align-items-center gap-2">
				<div class="spinner-border spinner-border-sm" role="status"></div>
				<span>Loading crypto library…</span>
			</div>

		{:else if hasKey}
			<!-- Sender: this browser has the key -->
			<div class="card mb-4">
				<div class="card-body">
					<h5 class="card-title">Send Key to Another Browser</h5>
					<p class="text-muted">
						On the other browser, open this page and click "Receive Key". It will show a
						Transfer ID — enter it below.
					</p>
					{#if senderSent}
						<div class="alert alert-success mb-0">
							Key sent! The other browser will receive it within seconds.
						</div>
					{:else}
						<div class="input-group">
							<input
								type="text"
								class="form-control font-monospace"
								bind:value={senderTransferId}
								placeholder="Transfer ID (UUID)…"
							/>
							<button class="btn btn-primary" onclick={sendKey} disabled={!senderTransferId.trim()}>
								Send Key
							</button>
						</div>
					{/if}
				</div>
			</div>

		{:else}
			<!-- Receiver: this browser has no key -->
			<div class="card mb-4">
				<div class="card-body">
					<h5 class="card-title">Receive Key from Another Browser</h5>
					<p class="text-muted">
						Click below to generate a transfer session. Then go to the browser that has your key,
						open this page, and enter the Transfer ID shown here.
					</p>
					{#if !transferId}
						<button class="btn btn-primary" onclick={startReceiving}>
							Start Receiving
						</button>
					{:else if polling}
						<div class="alert alert-info">
							<strong>Transfer ID:</strong>
							<code class="d-block mt-1 fs-6">{transferId}</code>
							<hr />
							<div class="d-flex align-items-center gap-2">
								<div class="spinner-border spinner-border-sm" role="status"></div>
								Waiting for sender… (expires in 10 minutes)
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Generate fresh keys option -->
			<div class="card mb-4">
				<div class="card-body">
					<h5 class="card-title">Generate New Keys on This Device</h5>
					<p class="text-muted">
						Generate a fresh keypair directly in this browser without transferring from another
						device.
					</p>

					{#if genError}
						<div class="alert alert-danger">{genError}</div>
					{/if}

					{#if genStep === ''}
						<div class="form-check mb-3">
							<input
								class="form-check-input"
								type="checkbox"
								id="genAsSecondary"
								bind:checked={genAsSecondary}
							/>
							<label class="form-check-label" for="genAsSecondary">
								Register as a secondary key (keep existing keys active)
							</label>
						</div>
						{#if !genAsSecondary && hasKeysOnServer}
							<div class="alert alert-warning py-2 mb-3">
								⚠️ This will delete your existing keys. Any data encrypted with the old key
								will no longer be accessible.
							</div>
						{/if}
						<button class="btn btn-outline-secondary" onclick={generateNewKeys}>
							Generate New Keys
						</button>

					{:else if genStep === 'generating'}
						<div class="d-flex align-items-center gap-2">
							<div class="spinner-border spinner-border-sm" role="status"></div>
							<span>Generating keys…</span>
						</div>

					{:else if genStep === 'show_recovery'}
						<div class="alert alert-danger">
							<h6>⚠️ Save Your Recovery Key Now</h6>
							<p class="mb-2">
								This is the <strong>only time</strong> you'll see this key. Store it in a
								password manager or write it down.
							</p>
							<label for="transfer-recovery-key" class="form-label fw-bold">Recovery Key (AES recovery key):</label>
							<textarea
								id="transfer-recovery-key"
								class="form-control font-monospace mb-3"
								rows="2"
								readonly
								value={genRecoveryPrivateKey}
							></textarea>
							<div class="form-check mb-3">
								<input
									class="form-check-input"
									type="checkbox"
									id="genConfirmed"
									bind:checked={genConfirmed}
								/>
								<label class="form-check-label" for="genConfirmed">
									I have saved my recovery key in a secure location.
								</label>
							</div>
							<button
								class="btn btn-danger"
								onclick={() => goto(`${base}/`)}
								disabled={!genConfirmed}
							>
								I've Saved It — Continue
							</button>
						</div>
					{/if}
				</div>
			</div>

			<p class="text-muted">
				No key in this browser? You can also
				<a href="{base}/keys/recovery">restore using your recovery key</a>.
			</p>
		{/if}
	</div>
</div>
