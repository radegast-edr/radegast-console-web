<script lang="ts">
	import { base } from '$app/paths';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import { onMount, type Snippet } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { user } from '$lib/store';
	import { api, type UserInfo } from '$lib/api';
	import { initAgeWasm, generateKeypair, storePrivateKey, aesEncrypt } from '$lib/crypto';

	import { page } from '$app/stores';

	let { children } = $props<{ children: Snippet }>();

	// Routes that are fully public (no auth needed)
	const PUBLIC_PREFIXES = ['/login', '/register', '/verify', '/terms', '/privacy'];

	// Automatic key generation states
	let generatingKeys = $state(false);
	let setupError = $state('');
	let showRecoveryModal = $state(false);
	let recoveryKey = $state('');
	let confirmed = $state(false);

	onMount(async () => {
		const path = $page.url.pathname;
		const relativePath = path.startsWith(base) ? path.slice(base.length) : path;

		if (PUBLIC_PREFIXES.some((p) => relativePath.startsWith(p))) return;

		try {
			const me = await api.me();
			$user = me;
		} catch {
			goto(`${base}/login`);
		}
	});

	$effect(() => {
		const path = $page.url.pathname;
		const relativePath = path.startsWith(base) ? path.slice(base.length) : path;
		if (PUBLIC_PREFIXES.some((p) => relativePath.startsWith(p))) return;

		const currentUser = $user;
		if (currentUser && !currentUser.has_keys && !generatingKeys && !showRecoveryModal && !setupError) {
			autoSetupKeys(currentUser);
		}
	});

	async function autoSetupKeys(me: UserInfo): Promise<void> {
		generatingKeys = true;
		setupError = '';
		try {
			await initAgeWasm();
			
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
			await client.POST('/api/v1/auth/keys/setup', {
				body: {
					public_key: mainPub,
					recovery_public_key: recoveryPub,
					recovery_encrypted_private_key: encryptedRecoveryPriv,
					name: 'Primary Key'
				}
			});

			// 6. Store main private and public key in IndexedDB keyed by user ID
			await storePrivateKey(me.id, mainPriv, mainPub);

			// Save userId for this email
			if (me.email) {
				localStorage.setItem(`uid_${me.email.toLowerCase().trim()}`, String(me.id));
			}

			// Show AES recovery key to user
			recoveryKey = aesKeyHex;
			showRecoveryModal = true;

			// Refresh user store
			const { data: me2 } = await client.GET('/api/v1/auth/me', {});
			$user = me2!;
		} catch (e: any) {
			setupError = 'Automatic key setup failed: ' + e.message;
		} finally {
			generatingKeys = false;
		}
	}

	beforeNavigate(({ cancel }) => {
		if (showRecoveryModal) {
			if (!confirm('Are you sure you want to leave? Your recovery key will be lost if you have not saved it.')) {
				cancel();
			}
		}
	});

	function handleBeforeUnload(event: BeforeUnloadEvent): string | undefined {
		if (showRecoveryModal) {
			event.preventDefault();
			return 'Are you sure you want to leave? Your recovery key will be lost if you have not saved it.';
		}
	}
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<Navbar />
<main class="container-fluid px-4 mt-4">
	{#if $user && $user.mfa_setup_missing}
		<div class="alert alert-danger shadow-sm border-0 d-flex align-items-center gap-3 mb-4" style="border-radius: 12px; padding: 1.25rem;">
			<div class="fs-3">⚠️</div>
			<div>
				<h6 class="fw-bold mb-1 text-danger">Multi-Factor Authentication (MFA) Setup Required</h6>
				<p class="mb-0 small text-dark-emphasis">
					Your account role (<strong>{$user.role}</strong>) requires MFA level <strong>{$user.mfa_required_level}</strong>, but you have not configured any compatible MFA methods yet.
					Please navigate to <a href="{base}/settings" class="fw-bold text-danger text-decoration-underline">Settings</a> to register an authenticator app or Yubikey.
				</p>
			</div>
		</div>
	{/if}
	{@render children()}
</main>

{#if generatingKeys}
	<div class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white" style="z-index: 1999; opacity: 0.9;">
		<div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
		<h5 class="fw-bold">Securing your account…</h5>
		<p class="text-muted small">Generating end-to-end encryption key pairs inside your browser.</p>
	</div>
{/if}

{#if setupError}
	<div class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white" style="z-index: 1999;">
		<div class="alert alert-danger max-width-md mx-3 text-center" style="max-width: 500px;">
			<h5 class="fw-bold mb-2">Setup Failed</h5>
			<p>{setupError}</p>
			<button class="btn btn-primary btn-sm px-4" onclick={() => { setupError = ''; client.GET('/api/v1/auth/me', {}).then(({ data: me }) => autoSetupKeys(me!)); }}>
				Retry Key Generation
			</button>
		</div>
	</div>
{/if}

{#if showRecoveryModal}
	<div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.65); backdrop-filter: blur(5px); z-index: 2000;">
		<div class="modal-dialog modal-dialog-centered">
			<div class="modal-content border-0 shadow-lg" style="border-radius: 16px; overflow: hidden;">
				<div class="modal-header bg-danger text-white border-0 py-3">
					<h5 class="modal-title fw-bold mb-0">⚠️ Save Your Recovery Key</h5>
				</div>
				<div class="modal-body p-4">
					<p class="text-muted small">
						Your account has been secured with End-to-End Encryption. We've generated your encryption keys automatically.
					</p>
					<div class="alert alert-warning py-2 small border-0 mb-3" style="border-radius: 8px;">
						This is the <strong>only time</strong> you'll see this key.
						If you clear your browser data or log in on a new device, you will need this key to read your logs.
					</div>
					<div class="mb-3">
						<label for="layout-recovery-key" class="form-label fw-bold small text-secondary">Recovery Key (AES recovery key):</label>
						<textarea
							id="layout-recovery-key"
							class="form-control font-monospace text-center fw-bold bg-light py-2"
							rows="1"
							readonly
							value={recoveryKey}
							style="letter-spacing: 0.5px; font-size: 1.05rem; border-radius: 8px;"
						></textarea>
					</div>
					<div class="form-check mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="layoutConfirmSaved"
							bind:checked={confirmed}
						/>
						<label class="form-check-label small text-muted" for="layoutConfirmSaved">
							I have securely saved this recovery key in a safe location.
						</label>
					</div>
				</div>
				<div class="modal-footer border-0 bg-light py-3">
					<button class="btn btn-danger px-4 w-100 fw-bold" onclick={() => { showRecoveryModal = false; window.location.reload(); }} disabled={!confirmed} style="border-radius: 8px; py-2">
						I've Saved It — Proceed to App
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
