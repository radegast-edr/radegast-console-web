<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '@fontsource/open-sans';
	import 'hack-font/build/web/hack.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import GlobalConfirm from '$lib/components/GlobalConfirm.svelte';
	import { onMount, type Snippet } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { user, showOnboarding } from '$lib/store';
	import { api, type UserInfo } from '$lib/api';
	import { initAgeWasm, generateKeypair, storePrivateKey, aesEncrypt, getStoredPrivateKey, getStoredPublicKey } from '$lib/crypto';
	import OnboardingTour from '$lib/components/OnboardingTour.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '@iconify/svelte';


	import { page } from '$app/state';
	import BoxiconsNoEntry from '~icons/boxicons/no-entry';
	import MaterialSymbolsKey from '~icons/material-symbols/key';
	import Spinner from '$lib/components/Spinner.svelte';
	import GroupKeyRefresher from '$lib/components/GroupKeyRefresher.svelte';

	let showNoKeyBanner = $state(false);

	$effect(() => {
		const currentUser = $user;
		const path = page.url.pathname;
		const relativePath = path.startsWith(base) ? path.slice(base.length) : path;
		const isBannerPage = relativePath === '/' || relativePath === '' || relativePath === '/alerts' || relativePath === '/hunt';

		if (currentUser && isBannerPage) {
			Promise.all([
				getStoredPrivateKey(currentUser.id),
				getStoredPublicKey(currentUser.id),
				api.listKeys().catch(() => [])
			]).then(([privKey, pubKey, serverKeys]) => {
				if (!privKey || !pubKey || !currentUser.has_keys) {
					showNoKeyBanner = true;
				} else {
					const isKeyActive = serverKeys.some((k) => k.public_key === pubKey);
					showNoKeyBanner = !isKeyActive;
				}
			}).catch(() => {
				showNoKeyBanner = true;
			});
		} else {
			showNoKeyBanner = false;
		}
	});

	let { children } = $props<{ children: Snippet }>();

	// Routes that are fully public (no auth needed)
	const PUBLIC_PREFIXES = ['/login', '/register', '/verify', '/terms', '/privacy', '/reset-password', '/unsubscribe', '/delete-account', '/server-error'];

	// Automatic key generation states
	let generatingKeys = $state(false);
	let setupError = $state('');
	let showRecoveryModal = $state(false);
	let recoveryKey = $state('');
	let confirmed = $state(false);

	onMount(async () => {
		const path = page.url.pathname;
		const relativePath = path.startsWith(base) ? path.slice(base.length) : path;

		if (PUBLIC_PREFIXES.some((p) => relativePath.startsWith(p))) return;

		try {
			const me = await api.me();
			$user = me;
		} catch (err: any) {
			if (err?.status >= 500 || err?.name === 'TypeError' || err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch')) {
				goto(`${base}/server-error`);
			} else if (err?.status === 401 || err?.status === 403 || !err?.status) {
				const nextPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
				const search = page.url.search;
				const target = encodeURIComponent(`${nextPath}${search}`);
				goto(`${base}/login?next=${target}`);
			}
		}
	});

	$effect(() => {
		const path = page.url.pathname;
		const relativePath = path.startsWith(base) ? path.slice(base.length) : path;
		if (PUBLIC_PREFIXES.some((p) => relativePath.startsWith(p))) return;

		const currentUser = $user;
		if (currentUser && !currentUser.has_keys && !generatingKeys && !showRecoveryModal && !setupError) {
			autoSetupKeys(currentUser);
		}
	});

	$effect(() => {
		const path = page.url.pathname;
		const relativePath = path.startsWith(base) ? path.slice(base.length) : path;
		if (PUBLIC_PREFIXES.some((p) => relativePath.startsWith(p))) return;

		const currentUser = $user;
		if (
			currentUser &&
			currentUser.has_keys &&
			currentUser.onboarding_completed === false &&
			!generatingKeys &&
			!showRecoveryModal &&
			!setupError &&
			!$showOnboarding
		) {
			showOnboarding.set(true);
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
			await api.setupKeys({
				public_key: mainPub,
				recovery_public_key: recoveryPub,
				recovery_encrypted_private_key: encryptedRecoveryPriv,
				name: 'Primary Key'
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
			const me2 = await api.me();
			$user = me2;
		} catch (e: any) {
			setupError = 'Automatic key setup failed: ' + e.message;
		} finally {
			generatingKeys = false;
		}
	}

	let navigateToUrl: string | null = null;

	beforeNavigate(({ cancel, to }) => {
		if (showRecoveryModal && !navigateToUrl) {
			cancel();
			askConfirm('Are you sure you want to leave? Your recovery key will be lost if you have not saved it.').then(confirmed => {
				if (confirmed && to) {
					navigateToUrl = to.url.href;
					goto(to.url.href);
				}
			});
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

<div class="d-flex flex-column flex-md-row" style="min-height: 100vh; overflow-x: hidden;">
	{#if $user}
		<Sidebar />
		<main class="w-100 bg-body d-flex flex-column flex-grow-1 main-content">
			<div class="container-fluid px-4 mt-4">
				{#if $user.mfa_setup_missing}
					<div class="alert alert-danger d-flex align-items-center gap-3 mb-4" style="padding: 1.25rem;">
						<div class="fs-3"><BoxiconsNoEntry /></div>
						<div>
							<h6 class="fw-bold mb-1">Multi-Factor Authentication (MFA) Setup Required</h6>
							<p class="mb-0 small text-body-secondary">
								Your account role (<strong>{$user.role}</strong>) requires MFA level <strong>{$user.mfa_required_level}</strong>, but you have not configured any compatible MFA methods yet.
								Please navigate to <a href="{base}/settings" class="fw-bold text-decoration-underline">Settings</a> to register an authenticator app or Yubikey.
							</p>
						</div>
					</div>
				{/if}
				{#if showNoKeyBanner}
					<div class="alert alert-warning d-flex align-items-center gap-3 mb-4" style="padding: 1.25rem;">
						<div class="fs-3"><MaterialSymbolsKey /></div>
						<div>
							<h6 class="fw-bold mb-1 text-warning-emphasis">Local Encryption Key Missing</h6>
							<p class="mb-0 small text-body-secondary">
								You do not have your private encryption key configured locally on this browser. You won't be able to decrypt device logs.
								Please visit the <a href="{base}/keys/transfer" class="fw-bold text-decoration-underline text-warning-emphasis">Key Transfer & Restoration</a> page to configure it.
							</p>
						</div>
					</div>
				{/if}
				<GroupKeyRefresher />
				{@render children()}
			</div>
		</main>
	{:else}
		<div class="d-flex flex-column w-100">
			<Sidebar />
			<main class="container-fluid px-4 mt-4">
				{@render children()}
			</main>
		</div>
	{/if}
</div>

<GlobalConfirm />

{#if $showOnboarding}
	<OnboardingTour />
{/if}


{#if generatingKeys}
	<div class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white" style="z-index: 1999; opacity: 0.9;">
		<div class="mb-3">
			<Spinner size="lg" color="primary" />
		</div>
		<h5 class="fw-bold">Securing your account…</h5>
		<p class="text-muted small">Generating end-to-end encryption key pairs inside your browser.</p>
	</div>
{/if}

{#if setupError}
	<div class="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white" style="z-index: 1999;">
		<div class="alert alert-danger max-width-md mx-3 text-center" style="max-width: 500px;">
			<h5 class="fw-bold mb-2">Setup Failed</h5>
			<p>{setupError}</p>
			<button class="btn btn-primary btn-sm px-4" onclick={() => { setupError = ''; api.me().then((me) => autoSetupKeys(me)); }}>
				Retry Key Generation
			</button>
		</div>
	</div>
{/if}

<Modal show={showRecoveryModal} title="Save Your Recovery Key" preventClose={true}>
	<div class="p-1">
		<div class="d-flex align-items-center gap-2 mb-3 text-danger">
			<Icon icon="lucide:shield-alert" class="fs-4" />
			<h6 class="fw-bold mb-0">Save Your Recovery Key Required</h6>
		</div>
		<p class="text-body-secondary small">
			Your account has been secured with End-to-End Encryption. We've generated your encryption keys automatically.
		</p>
		<div class="alert alert-warning py-2 small border-0 mb-3">
			This is the <strong>only time</strong> you'll see this key.
			If you clear your browser data or log in on a new device, you will need this key to read your logs.
		</div>
		<div class="mb-3">
			<label for="layout-recovery-key" class="form-label fw-bold small text-body-secondary">Recovery Key (AES recovery key):</label>
			<textarea
				id="layout-recovery-key"
				class="form-control font-monospace text-center fw-bold bg-body-secondary py-2"
				rows="1"
				readonly
				value={recoveryKey}
				style="letter-spacing: 0.5px; font-size: 1.05rem;"
			></textarea>
		</div>
		<div class="form-check mb-4">
			<input
				class="form-check-input"
				type="checkbox"
				id="layoutConfirmSaved"
				bind:checked={confirmed}
			/>
			<label class="form-check-label small text-body-secondary" for="layoutConfirmSaved">
				I have securely saved this recovery key in a safe location.
			</label>
		</div>
		<div class="pt-3 border-top">
			<button class="btn btn-danger px-4 w-100 fw-bold" onclick={() => { showRecoveryModal = false; window.location.reload(); }} disabled={!confirmed}>
				I've Saved It — Proceed to App
			</button>
		</div>
	</div>
</Modal>

<style>
	.main-content {
		overflow-y: auto;
		max-height: 100vh;
	}
	@media (max-width: 767.98px) {
		.main-content {
			overflow-y: visible;
			max-height: none;
		}
	}
</style>
