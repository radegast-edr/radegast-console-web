<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import { initAgeWasm, generateKeypair, encrypt, decrypt, getStoredPrivateKey, storePrivateKey } from '$lib/crypto';
	import Spinner from '$lib/components/Spinner.svelte';

	let wasmReady = $state(false);
	let userId = $state<number | null>(null);

	// Receiver state
	let transferId = $state('');
	let polling = $state(false);
	let pollInterval: ReturnType<typeof setInterval> | undefined = undefined;

	// Sender state
	let senderTransferId = $state('');
	let senderSent = $state(false);



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
			} catch {
				// ignore
			}
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
						} catch {
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


</script>

<svelte:head>
	<title>Key Transfer - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-7">
		<div class="d-flex align-items-center justify-content-between mb-4">
			<h2 class="mb-0">Key Transfer</h2>
		</div>
		<p class="text-muted mb-4">Send your encryption keys to another browser or receive keys from another device.</p>

		{#if !wasmReady}
			<div class="d-flex align-items-center gap-2">
				<Spinner inline size="sm" text="Loading crypto library…" />
			</div>

		{:else}
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

			<!-- Receiver: this browser can also receive keys -->
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
								<Spinner inline size="sm" text="Waiting for sender… (expires in 10 minutes)" />
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Generate fresh keys option -->
			<div class="card mb-4">
				<div class="card-body">
					<h5 class="card-title">Generate New Keys on This Device</h5>
					<p class="text-muted mb-3">
						To generate a fresh encryption keypair, please visit your account Settings.
					</p>
					<a href="{base}/settings" class="btn btn-outline-secondary">
						Go to Settings
					</a>
				</div>
			</div>

			<p class="text-muted">
				No key in this browser? You can also
				<a href="{base}/keys/recovery">restore using your recovery key</a>.
			</p>
		{/if}
	</div>
</div>
