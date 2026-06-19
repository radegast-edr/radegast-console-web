<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import KeyIcon from '~icons/lucide/key';
	import SendIcon from '~icons/lucide/send';
	import DownloadIcon from '~icons/lucide/download';
	import AlertTriangleIcon from '~icons/lucide/alert-triangle';
	import CheckIcon from '~icons/lucide/check';
	import {
		api,
		type NotificationSettings,
		type UserKey,
		type MfaSettings,
		type MfaOtpSetupResponse,
	} from '$lib/api';
	import { showFlash, showError, user } from '$lib/store';
	import { initAgeWasm, generateKeypair, storePrivateKey, aesEncrypt, getStoredPublicKey } from '$lib/crypto';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	// Password change
	let oldPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let pwSaving = $state(false);

	// Notification prefs
	let notifications = $state<NotificationSettings | null>(null);
	let notifSaving = $state(false);

	// Encryption Keys Management
	let keys = $state<UserKey[]>([]);
	let keysLoading = $state(true);
	let wasmReady = $state(false);
	let userId = $state<number | null>(null);
	let currentLocalPubKey = $state<string | null>(null);

	let extendedEdrEnabled = $state(false);
	$effect(() => {
		if ($user) {
			extendedEdrEnabled = $user.extended_edr_enabled;
		}
	});

	let apiKeysEnabled = $state(false);
	$effect(() => {
		if ($user) {
			apiKeysEnabled = $user.api_keys_enabled;
		}
	});

	let aiAnalysisTool = $state('lumo-guest');
	let previousAiAnalysisTool = 'lumo-guest';
	$effect(() => {
		if ($user) {
			aiAnalysisTool = $user.ai_analysis_tool || 'lumo-guest';
			previousAiAnalysisTool = $user.ai_analysis_tool || 'lumo-guest';
		}
	});

	// Add key state
	let isRecovery = $state(false);
	let addKeyStep = $state<'idle' | 'generating' | 'show_recovery'>('idle'); // 'idle' | 'generating' | 'show_recovery'
	let generatedRecoveryKey = $state('');
	let newKeyName = $state('');

	// Custom Confirmation Modal state
	let showConfirmModal = $state(false);
	let modalTitle = $state('');
	let modalMessage = $state('');
	let confirmCallback = $state<(() => void) | null>(null);

	function openConfirmModal(title: string, message: string, callback: () => void): void {
		modalTitle = title;
		modalMessage = message;
		confirmCallback = () => {
			showConfirmModal = false;
			callback();
		};
		showConfirmModal = true;
	}

	onMount(async () => {
		try {
			notifications = await api.getNotifications();
		} catch (e: any) {
			showError('Failed to load notification settings: ' + e.message);
		}
		try {
			await initAgeWasm();
			wasmReady = true;
		} catch (e: any) {
			showError('Failed to initialize crypto library: ' + e.message);
		}
		try {
			const me = await api.me();
			userId = me.id;
		} catch (e) {
			// not logged in
		}
		await loadKeys();
		await loadMfaSettings();
	});

	async function loadKeys(): Promise<void> {
		keysLoading = true;
		try {
			keys = await api.listKeys();
			if (userId) {
				currentLocalPubKey = await getStoredPublicKey(userId);
			}
		} catch (e: any) {
			showError('Failed to load keys: ' + e.message);
		} finally {
			keysLoading = false;
		}
	}

	function promptDeleteKey(key: any): void {
		openConfirmModal(
			'Confirm Key Deletion',
			`Are you sure you want to delete the key "${key.name || 'Unnamed Key'}" (${key.public_key.substring(0, 10)}...)? Any logs encrypted using this key will become permanently unreadable unless you have a backup of the key. This action cannot be undone.`,
			async () => {
				try {
					await api.deleteKey(key.id);
					showFlash('Encryption key deleted.');
					await loadKeys();
				} catch (e: any) {
					showError('Failed to delete key: ' + e.message);
				}
			}
		);
	}

	function requestGenerateKey(): void {
		if (!newKeyName.trim()) {
			showError('Please enter a name for the new key pair.');
			return;
		}

		if (!isRecovery) {
			openConfirmModal(
				'Change Encryption Keys Warning',
				'You are about to change your active encryption keys. This browser will switch to using the new active key, and you will lose access to logs that were recorded prior to this public key creation. Do you want to proceed?',
				() => {
					executeGenerateKey();
				}
			);
		} else {
			executeGenerateKey();
		}
	}

	async function executeGenerateKey(): Promise<void> {
		addKeyStep = 'generating';
		try {
			const { publicKey, privateKey } = generateKeypair();

			if (isRecovery) {
				// Generate random 256-bit AES key
				const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
				const aesKeyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

				// Encrypt private key with AES key
				const encryptedPriv = await aesEncrypt(privateKey, aesKeyHex);

				// Register with backend
				await api.addKey({
					public_key: publicKey,
					encrypted_private_key: encryptedPriv,
					key_type: 'recovery',
					name: newKeyName.trim()
				});

				generatedRecoveryKey = aesKeyHex;
				addKeyStep = 'show_recovery';
				newKeyName = '';
			} else {
				// Register with backend
				await api.addKey({
					public_key: publicKey,
					key_type: 'secondary',
					name: newKeyName.trim()
				});

				if (userId === null) {
					throw new Error('User ID not set');
				}
				// Store private key locally in IndexedDB along with public key
				await storePrivateKey(userId, privateKey, publicKey);
				
				// Update current local public key ref
				currentLocalPubKey = publicKey;

				// Save email to userId mapping in case it's not set
				const me = await api.me();
				if (me && me.email) {
					localStorage.setItem(`uid_${me.email.toLowerCase().trim()}`, String(userId));
				}

				showFlash('Key pair generated successfully, registered, and set active.');
				addKeyStep = 'idle';
				newKeyName = '';
			}

			await loadKeys();
		} catch (e: any) {
			showError('Failed to generate key pair: ' + e.message);
			addKeyStep = 'idle';
		}
	}

	async function changePassword(): Promise<void> {
		if (newPassword !== confirmPassword) {
			showError('New passwords do not match.');
			return;
		}
		if (newPassword.length < 8) {
			showError('New password must be at least 8 characters.');
			return;
		}
		pwSaving = true;
		try {
			await api.changePassword(oldPassword, newPassword);
			showFlash('Password changed successfully.');
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (e: unknown) {
			showError((e as Error).message);
		} finally {
			pwSaving = false;
		}
	}

	async function saveNotifications(): Promise<void> {
		if (!notifications) return;
		notifSaving = true;
		try {
			notifications = await api.updateNotifications(notifications) as NotificationSettings;
			showFlash('Notification preferences saved.');
		} catch (e: unknown) {
			showError((e as Error).message);
		} finally {
			notifSaving = false;
		}
	}

	async function saveExtendedEdr(): Promise<void> {
		if (!$user) return;
		try {
			await api.client.PUT('/api/v1/user/extended-edr', {
				body: { extended_edr_enabled: extendedEdrEnabled }
			});
			$user.extended_edr_enabled = extendedEdrEnabled;
			showFlash('Extended EDR preference saved.');
		} catch (e: unknown) {
			showError((e as Error).message);
		}
	}

	async function saveApiKeys(): Promise<void> {
		if (!$user) return;
		try {
			await api.updateApiKeysEnabled(apiKeysEnabled);
			$user.api_keys_enabled = apiKeysEnabled;
			showFlash('API keys preference saved.');
		} catch (e: unknown) {
			showError((e as Error).message);
		}
	}

	async function saveAiAnalysisTool(newTool: string): Promise<void> {
		if (!$user) return;
		try {
			await api.client.PUT('/api/v1/user/ai-analysis-tool', {
				body: { ai_analysis_tool: newTool }
			});
			$user.ai_analysis_tool = newTool;
			showFlash('AI analysis tool preference saved.');
		} catch (e: unknown) {
			showError((e as Error).message);
		}
	}

	function handleAiToolChange(event: Event) {
		const selectEl = event.target as HTMLSelectElement;
		const targetValue = selectEl.value;
		
		if (typeof window !== 'undefined' && !localStorage.getItem('radegast_ai_tool_first_change')) {
			openConfirmModal(
				'Confirm AI Provider Change',
				'Lumo in guest mode was selected because they claim not to log any your queries, but before using the AI analysis you must trust the AI provider to not misuse your data. Do you want to proceed with this change?',
				() => {
					localStorage.setItem('radegast_ai_tool_first_change', 'true');
					aiAnalysisTool = targetValue;
					saveAiAnalysisTool(targetValue);
				}
			);
			// Revert select input visually
			selectEl.value = previousAiAnalysisTool;
		} else {
			aiAnalysisTool = targetValue;
			saveAiAnalysisTool(targetValue);
		}
	}

	let mfaSettings = $state<MfaSettings | null>(null);
	let mfaLoading = $state(true);
	let otpSetupActive = $state(false);
	let otpSetupData = $state<MfaOtpSetupResponse | null>(null);
	let hardwareTokenName = $state('');
	let hardwareTokenRegistering = $state(false);
	let otpCode = $state('');
	let hardwareTokenSetupActive = $state(false);

	async function loadMfaSettings(): Promise<void> {
		mfaLoading = true;
		try {
			mfaSettings = await api.getMfaSettings();
			const me = await api.me();
			$user = me;
		} catch (e: any) {
			showError('Failed to load MFA settings: ' + e.message);
		} finally {
			mfaLoading = false;
		}
	}

	async function startOtpSetup(): Promise<void> {
		try {
			otpSetupData = await api.setupMfaOtp() as MfaOtpSetupResponse;
			otpSetupActive = true;
		} catch (e: any) {
			showError('Failed to start OTP setup: ' + e.message);
		}
	}

	async function confirmOtpSetup(): Promise<void> {
		if (!otpCode.trim()) {
			showError('Please enter the verification code.');
			return;
		}
		try {
			await api.verifyMfaOtp(otpCode);
			showFlash('MFA OTP enabled successfully.');
			otpSetupActive = false;
			otpSetupData = null;
			otpCode = '';
			await loadMfaSettings();
		} catch (e: any) {
			showError('Failed to verify OTP: ' + e.message);
		}
	}

	async function disableOtp(): Promise<void> {
		openConfirmModal(
			'Disable Authenticator App MFA',
			'Are you sure you want to disable OTP MFA on your account? This might lower your security level below role requirements.',
			async () => {
				try {
					await api.disableMfaOtp();
					showFlash('OTP MFA disabled successfully.');
					await loadMfaSettings();
				} catch (e: any) {
					showError('Failed to disable OTP: ' + e.message);
				}
			}
		);
	}

	function bufferFromBase64url(str: string): ArrayBuffer {
		let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
		while (base64.length % 4) {
			base64 += '=';
		}
		const binary = window.atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}

	function base64urlFromBuffer(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		const base64 = window.btoa(binary);
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
	}

	async function registerHardwareToken(): Promise<void> {
		if (!hardwareTokenName.trim()) {
			showError('Please enter a name for the new Hardware token.');
			return;
		}
		hardwareTokenRegistering = true;
		try {
			interface CredentialOptions {
				challenge: string | ArrayBuffer;
				user: { id: string | ArrayBuffer };
				excludeCredentials?: Array<{ id: string | ArrayBuffer; [key: string]: unknown }>;
				[key: string]: unknown;
			}
			const setupRes = await api.setupMfaHardwareToken();
			const options = setupRes.options as unknown as CredentialOptions;

			options.challenge = bufferFromBase64url(options.challenge as string);
			options.user.id = bufferFromBase64url(options.user.id as string);
			if (options.excludeCredentials) {
				options.excludeCredentials = options.excludeCredentials.map((c) => ({
					...c,
					id: bufferFromBase64url(c.id as string)
				}));
			}

			const credential = await navigator.credentials.create({ publicKey: options as unknown as PublicKeyCredentialCreationOptions }) as PublicKeyCredential;
			const credentialResponse = credential.response as AuthenticatorAttestationResponse;

			const webauthnResponse = {
				id: credential.id,
				rawId: base64urlFromBuffer(credential.rawId),
				type: credential.type,
				response: {
					clientDataJSON: base64urlFromBuffer(credentialResponse.clientDataJSON),
					attestationObject: base64urlFromBuffer(credentialResponse.attestationObject),
				}
			};

			await api.verifyMfaHardwareToken(setupRes.registration_token, webauthnResponse, hardwareTokenName.trim());
			showFlash('Hardware token registered successfully!');
			hardwareTokenName = '';
			hardwareTokenSetupActive = false;
			await loadMfaSettings();
		} catch (e: unknown) {
			showError('Failed to register Hardware token: ' + (e as Error).message);
		} finally {
			hardwareTokenRegistering = false;
		}
	}

	async function deleteHardwareToken(id: string | number): Promise<void> {
		openConfirmModal(
			'Delete Security Key',
			'Are you sure you want to delete this security key? You will no longer be able to use it to log in.',
			async () => {
				try {
					await api.deleteMfaHardwareToken(Number(id));
					showFlash('Hardware token deleted successfully.');
					await loadMfaSettings();
				} catch (e: unknown) {
					showError('Failed to delete Hardware token: ' + (e as Error).message);
				}
			}
		);
	}
</script>

<svelte:head>
	<title>Settings - Radegast</title>
</svelte:head>

<h2 class="mb-4">User Settings</h2>

<div class="row g-4">
	<!-- Change Password -->
	<div class="col-md-6">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Change Password</h5></div>
			<div class="card-body">
				<form onsubmit={(e) => { e.preventDefault(); changePassword(); }}>
					<div class="mb-3">
						<label for="oldPassword" class="form-label">Current Password</label>
						<input
							type="password"
							class="form-control"
							id="oldPassword"
							bind:value={oldPassword}
							required
							autocomplete="current-password"
						/>
					</div>
					<div class="mb-3">
						<label for="newPassword" class="form-label">New Password</label>
						<input
							type="password"
							class="form-control"
							id="newPassword"
							bind:value={newPassword}
							minlength="8"
							required
							autocomplete="new-password"
						/>
					</div>
					<div class="mb-3">
						<label for="confirmPassword" class="form-label">Confirm New Password</label>
						<input
							type="password"
							class="form-control"
							id="confirmPassword"
							bind:value={confirmPassword}
							required
							autocomplete="new-password"
						/>
					</div>
					<button type="submit" class="btn btn-primary d-flex align-items-center gap-2" disabled={pwSaving}>
						{pwSaving ? 'Saving…' : 'Change Password'}
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- Email Notifications -->
	<div class="col-md-6">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Email Notifications</h5></div>
			<div class="card-body">
				{#if !notifications}
					<Spinner centered size="sm" color="primary" text="Loading notifications…" py={3} />
				{:else}
					<p class="text-muted small mb-3">Choose which events trigger email notifications.</p>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyLogin"
							bind:checked={notifications.notify_login}
						/>
						<label class="form-check-label" for="notifyLogin">New login alert</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyNewKeys"
							bind:checked={notifications.notify_new_keys}
						/>
						<label class="form-check-label" for="notifyNewKeys">New keys added</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyRecovery"
							bind:checked={notifications.notify_recovery_used}
						/>
						<label class="form-check-label" for="notifyRecovery">Recovery key used</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyTransfer"
							bind:checked={notifications.notify_keys_transferred}
						/>
						<label class="form-check-label" for="notifyTransfer">Keys transferred to another device</label>
					</div>
					<div class="form-check form-switch mb-3">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyDeviceLog"
							bind:checked={notifications.notify_device_log}
						/>
						<label class="form-check-label" for="notifyDeviceLog">New alert notification</label>
					</div>
					<div class="form-check form-switch mb-3">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyApiKeyModification"
							bind:checked={notifications.notify_api_key_modification}
						/>
						<label class="form-check-label" for="notifyApiKeyModification">API key modification</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyDowntimeMaintenance"
							bind:checked={notifications.notify_downtime_maintenance}
						>
						<label class="form-check-label" for="notifyDowntimeMaintenance">Platform downtime and maintenance emails</label>
					</div>
					<div class="form-check form-switch mb-3">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyNewsUpdates"
							bind:checked={notifications.notify_news_updates}
						/>
						<label class="form-check-label" for="notifyNewsUpdates">Platform news and updates</label>
					</div>
					<button class="btn btn-primary d-flex align-items-center gap-2" onclick={saveNotifications} disabled={notifSaving}>
						{notifSaving ? 'Saving…' : 'Save Preferences'}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="row g-4 mt-2">
	<!-- Device Alert Settings -->
	<div class="col-12">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Device Alert Settings</h5></div>
				{#if notifications}
					<div class="m-3">
						<label for="notificationLevel" class="form-label fw-semibold">Minimal alert severity</label>
						<select
							id="notificationLevel"
							class="form-select form-select-sm"
							bind:value={notifications.notification_level}
						>
							<option value="informational">Informational</option>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
						<div class="form-text text-muted small">
							All alerts with severity lower than this are hidden and marked as read.
						</div>
						<button class="btn btn-primary btn-sm mt-2" onclick={saveNotifications} disabled={notifSaving}>
							{notifSaving ? 'Saving…' : 'Save'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

<div class="row g-4 mt-2">
	<!-- Encryption Keys Card -->
	<div class="col-12">
		<div class="card">
			<div class="card-header d-flex justify-content-between align-items-center">
				<h5 class="mb-0">Encryption Keys</h5>
				<span class="badge bg-secondary">End-to-End Encryption</span>
			</div>
			<div class="card-body">
				<p class="text-muted small">
					Manage public keys linked to your account. Public keys are used by devices to encrypt logs for you.
					Private keys are stored securely in your browser's local database and never sent to the server.
				</p>

				{#if keysLoading}
					<Spinner centered size="sm" color="primary" text="Loading keys…" py={3} />
				{:else}
					<div class="table-responsive mb-4">
						<table class="table table-hover align-middle">
							<thead>
								<tr>
									<th style="width: 8%">ID</th>
									<th style="width: 17%">Name</th>
									<th style="width: 35%">Public Key</th>
									<th style="width: 15%">Type</th>
									<th style="width: 15%">Last Used</th>
									<th style="width: 10%" class="text-end">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each keys as key}
									<tr class={key.public_key === currentLocalPubKey ? 'table-primary fw-semibold' : ''}>
										<td><code>#{key.id}</code></td>
										<td>{key.name || 'Unnamed Key'}</td>
										<td>
											<span class="text-monospace text-break font-monospace" title={key.public_key}>
												{key.public_key.length > 30 ? key.public_key.substring(0, 15) + '...' + key.public_key.substring(key.public_key.length - 15) : key.public_key}
											</span>
										</td>
										<td>
											{#if key.key_type === 'recovery'}
												<span class="badge bg-danger">Recovery Key</span>
											{:else}
												<span class="badge bg-success">Active Key</span>
											{/if}
											{#if key.public_key === currentLocalPubKey}
												<span class="badge bg-primary ms-1" title="Used by this browser to decrypt logs">Current Browser</span>
											{/if}
										</td>
										<td>
											{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}
										</td>
										<td class="text-end">
											{#if key.public_key === currentLocalPubKey}
												<button class="btn btn-sm btn-outline-secondary" disabled title="Cannot delete key currently in use by this browser">
													Delete
												</button>
											{:else}
												<button class="btn btn-sm btn-outline-danger" onclick={() => promptDeleteKey(key)}>
													Delete
												</button>
											{/if}
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="6" class="text-muted text-center py-3">No encryption keys registered.</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<hr />

				<h5 class="mt-4 mb-3">Add New Encryption Key Pair</h5>
				{#if addKeyStep === 'idle'}
					<div class="row align-items-end g-3">
						<div class="col-md-4">
							<label for="newKeyName" class="form-label fw-semibold">Key Pair Name</label>
							<input
								type="text"
								class="form-control"
								id="newKeyName"
								placeholder="e.g. Work PC, Adam's Phone"
								bind:value={newKeyName}
								required
							/>
						</div>
						<div class="col-md-5">
							<div class="form-check mb-2">
								<input
									class="form-check-input"
									type="checkbox"
									id="isRecovery"
									bind:checked={isRecovery}
								/>
								<label class="form-check-label" for="isRecovery">
									<strong>Mark as recovery key</strong> (backup key with encrypted private key stored on server)
								</label>
							</div>
						</div>
						<div class="col-md-3 text-end">
							<button class="btn btn-primary w-100" onclick={requestGenerateKey} disabled={!wasmReady || keysLoading || !newKeyName.trim()}>
								Generate & Register
							</button>
						</div>
					</div>
				{:else if addKeyStep === 'generating'}
					<div class="d-flex align-items-center gap-2">
						<Spinner inline size="sm" color="primary" text="Generating fresh cryptographic keys inside browser…" />
					</div>
				{:else if addKeyStep === 'show_recovery'}
					<div class="alert alert-danger mb-0">
						<h5 class="alert-heading fw-bold"><AlertTriangleIcon style="width: 16px; height: 16px;" /> Save Your New Recovery Key Now</h5>
						<p class="small mb-3">
							This recovery key is a random AES key generated in your browser.
							It has been used to encrypt your backup private key, and the server only holds the encrypted version.
							<strong>Write this key down or save it in a password manager.</strong> You will never see it again.
						</p>
						<div class="mb-3">
							<label for="settings-recovery-key" class="form-label fw-bold">New Recovery Key (AES hex key):</label>
							<textarea
								id="settings-recovery-key"
								class="form-control font-monospace text-center fw-bold"
								rows="1"
								readonly
								value={generatedRecoveryKey}
							></textarea>
						</div>
						<button class="btn btn-danger btn-sm" onclick={() => { addKeyStep = 'idle'; generatedRecoveryKey = ''; }}>
							I have securely saved this recovery key
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
<div class="row g-4 mt-2">
	<!-- Key Transfer Section -->
	<div class="col-12">
		<div class="card">
			<div class="card-header d-flex justify-content-between align-items-center">
				<h5 class="mb-0">Key Transfer & Management</h5>
				<span class="badge bg-info">Browser Key Management</span>
			</div>
			<div class="card-body">
				<p class="text-muted small">
					Manage your private encryption keys across different browsers and devices. Transfer keys securely or generate new ones.
				</p>
				<div class="d-flex gap-3">
					<a href="{base}/keys/transfer" class="btn btn-primary d-flex align-items-center gap-2">
						<KeyIcon style="width: 18px; height: 18px;"/> Transfer Keys Between Browsers
					</a>
					<a href="{base}/keys/recovery" class="btn btn-outline-secondary d-flex align-items-center gap-2">
						<DownloadIcon style="width: 18px; height: 18px;"/> Recover Using Recovery Key
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
<div class="row g-4 mt-2">
	<!-- Multi-Factor Authentication (MFA) -->
	<div class="col-12">
		<div class="card">
			<div class="card-header d-flex justify-content-between align-items-center">
				<h5 class="mb-0">Multi-Factor Authentication (MFA)</h5>
				{#if mfaSettings}
					<span class="badge bg-secondary">Required Level: {mfaSettings.required_level.toUpperCase()}</span>
				{/if}
			</div>
			<div class="card-body">
				{#if mfaLoading}
					<Spinner centered size="sm" color="primary" text="Loading MFA preferences…" py={3} />
				{:else if mfaSettings}
					<p class="text-muted small">
						Configure additional security verification methods. Required MFA level for your role is <strong>{mfaSettings.required_level}</strong> (current session level: <strong>{mfaSettings.current_level}</strong>).
					</p>

					<div class="row g-4">
						<!-- OTP (Authenticator App) -->
						<div class="col-md-6">
							<div class="p-3 border rounded">
								<h6 class="fw-bold mb-2">Google Authenticator / TOTP</h6>
								<p class="text-muted small mb-3">Use a mobile authenticator app (like Google Authenticator or Authy) to scan a QR code and generate temporary verification codes.</p>

								{#if mfaSettings.otp_enabled}
									<div class="d-flex align-items-center gap-2 mb-3">
										<span class="badge bg-success">Enabled</span>
										<span class="text-muted small">Authenticator app active</span>
									</div>
									{#if (['otp', 'hardware_token', 'token'].includes(mfaSettings.required_level) && mfaSettings.hardware_tokens.length === 0)}
										<p class="text-muted small mb-0"><AlertTriangleIcon style="width: 16px; height: 16px;" /> Cannot disable — OTP is required for your role and you have no hardware token registered.</p>
									{:else}
										<button class="btn btn-outline-danger btn-sm" onclick={disableOtp}>
											Disable OTP
										</button>
									{/if}
								{:else if otpSetupActive && otpSetupData}
									<div class="mb-3 p-3 bg-light rounded text-center">
										<p class="small fw-semibold mb-2">1. Scan QR code or enter manual secret key:</p>
										<div class="bg-white p-2 border d-inline-block mb-3">
											<code class="d-block text-break small p-2" style="max-width: 250px; margin: 0 auto; white-space: normal;">{otpSetupData.provisioning_uri}</code>
										</div>
										<p class="small text-muted mb-2">Secret: <code>{otpSetupData.secret}</code></p>

										<div class="mt-3" style="max-width: 250px; margin: 0 auto;">
											<label for="otpCodeInput" class="form-label small fw-bold">2. Enter verification code:</label>
											<input type="text" id="otpCodeInput" class="form-control text-center font-monospace" placeholder="e.g. 123456" bind:value={otpCode} />
											<div class="mt-2 d-flex gap-2 justify-content-center">
												<button class="btn btn-sm btn-primary" onclick={confirmOtpSetup}>Verify & Enable</button>
												<button class="btn btn-sm btn-outline-secondary" onclick={() => { otpSetupActive = false; otpSetupData = null; }}>Cancel</button>
											</div>
										</div>
									</div>
								{:else}
									<div class="d-flex align-items-center gap-2 mb-3">
										<span class="badge bg-secondary">Disabled</span>
									</div>
									<button class="btn btn-primary btn-sm" onclick={startOtpSetup}>
										Setup Authenticator App
									</button>
								{/if}
							</div>
						</div>

						<!-- WebAuthn (Hardware Tokens / Security Keys) -->
						<div class="col-md-6">
							<div class="p-3 border rounded">
								<h6 class="fw-bold mb-2">Hardware Tokens / Security Keys</h6>
								<p class="text-muted small mb-3">Register a physical hardware security key utilizing standard WebAuthn/FIDO2 protocols for maximum security.</p>

								<div class="mb-3">
									{#if mfaSettings.hardware_tokens.length > 0}
										<div class="list-group mb-2">
											{#each mfaSettings.hardware_tokens as tk}
												<div class="list-group-item d-flex justify-content-between align-items-center p-2">
													<div class="d-flex align-items-center gap-2">
														<span class="fs-6">🔑</span>
														<span class="small fw-semibold">{tk.name}</span>
													</div>
													{#if !(['hardware_token', 'token'].includes(mfaSettings.required_level) && mfaSettings.hardware_tokens.length === 1)}
														<button class="btn btn-sm btn-outline-danger py-0 px-2 fs-6" onclick={() => deleteHardwareToken(tk.id)} title="Delete device">&times;</button>
													{:else}
														<span class="text-muted small" title="Required — cannot delete last hardware token">🔒</span>
													{/if}
												</div>
											{/each}
										</div>
									{:else}
										<span class="text-muted small d-block mb-2">No security keys registered.</span>
									{/if}
								</div>

								{#if hardwareTokenSetupActive}
									<div class="mb-3 p-3 bg-light rounded text-center">
										<div class="mb-3" style="max-width: 250px; margin: 0 auto;">
											<label for="tokenNameInput" class="form-label small fw-bold">Enter device name:</label>
											<input type="text" id="tokenNameInput" class="form-control form-control-sm text-center" placeholder="e.g. Work security key" bind:value={hardwareTokenName} />
											<div class="mt-2 d-flex gap-2 justify-content-center">
												<button class="btn btn-sm btn-primary" onclick={registerHardwareToken} disabled={hardwareTokenRegistering || !hardwareTokenName.trim()}>
													{hardwareTokenRegistering ? 'Inserting…' : 'Register Key'}
												</button>
												<button class="btn btn-sm btn-outline-secondary" onclick={() => { hardwareTokenSetupActive = false; hardwareTokenName = ''; }}>Cancel</button>
											</div>
										</div>
									</div>
								{:else}
									<button class="btn btn-primary btn-sm" onclick={() => hardwareTokenSetupActive = true}>
										Register Hardware token
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="row g-4 mt-2">
	<!-- Extended EDR Preferences Card -->
	<div class="col-12">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Extended EDR Preferences</h5></div>
			<div class="card-body">
				<div class="form-check mb-2">
					<input
						class="form-check-input"
						type="checkbox"
						id="extendedEdr"
						bind:checked={extendedEdrEnabled}
						onchange={saveExtendedEdr}
					/>
					<label class="form-check-label fw-bold" for="extendedEdr">Enable Extended EDR Features</label>
				</div>
				<p class="text-muted small mb-3 ms-4">
					Enables advanced threat triage (E2EE analyst notes, resolution dropdowns), bypassing automatic read-on-click behaviors.
				</p>
				<div class="form-check mb-2">
					<input
						class="form-check-input"
						type="checkbox"
						id="apiKeys"
						bind:checked={apiKeysEnabled}
						onchange={saveApiKeys}
					/>
					<label class="form-check-label fw-bold" for="apiKeys">Enable API Keys Support</label>
				</div>
				<p class="text-muted small mb-0 ms-4">
					Enables programmatic API keys generation for automated integrations with external tools.
				</p>
			</div>
		</div>
	</div>

	<!-- AI Analysis Preferences Card -->
	<div class="col-12">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">AI Analysis Preferences</h5></div>
			<div class="card-body">
				<div class="mb-3">
					<label class="form-label fw-bold" for="aiAnalysisTool">AI Analysis Tool Helper</label>
					<select
						class="form-select"
						id="aiAnalysisTool"
						value={aiAnalysisTool}
						onchange={handleAiToolChange}
					>
						<option value="lumo-guest">Lumo in Guest mode</option>
						<option value="lumo-member">Lumo in logged-in mode</option>
						<option value="mistral">Mistral</option>
						<option value="claude">Claude</option>
						<option value="chatgpt">ChatGPT</option>
						<option value="duckduckgo">DuckDuckGo</option>
						<option value="kagi">Kagi</option>
					</select>
				</div>
				<p class="text-muted small mb-0">
					Select the AI tool helper to guide where the alert AI analysis will lead to.
				</p>
			</div>
		</div>
	</div>

	<!-- Legal & Policies Card -->
	<div class="col-12 mb-4">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Legal & Policies</h5></div>
			<div class="card-body">
				<p class="text-muted small">You can review our legal policies and agreements at any time.</p>
				<div class="d-flex gap-3">
					<a href="{base}/terms" target="_blank" class="btn btn-outline-secondary btn-sm">Terms of Service</a>
					<a href="{base}/privacy" target="_blank" class="btn btn-outline-secondary btn-sm">Privacy Policy</a>
				</div>
			</div>
		</div>
	</div>
</div>

<Modal
	show={showConfirmModal}
	title={modalTitle}
	onClose={() => { showConfirmModal = false; }}
>
	<p class="mb-4 text-body">{modalMessage}</p>
	<div class="d-flex justify-content-end gap-2">
		<button type="button" class="btn btn-outline-secondary px-4 fw-semibold" onclick={() => { showConfirmModal = false; }}>
			No
		</button>
		<button type="button" class="btn btn-warning px-4 fw-semibold text-dark" onclick={confirmCallback}>
			Yes
		</button>
	</div>
</Modal>
