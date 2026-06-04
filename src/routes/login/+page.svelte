<script lang="ts">
	import { base } from '$app/paths';
	import { api } from '$lib/api';
	import { user, showError } from '$lib/store';
	import { goto } from '$app/navigation';
	import { getPublicKeyForLogin } from '$lib/crypto';

	let email = $state('');
	let password = $state('');
	let error = $state('');

	let step = $state<'credentials' | 'mfa'>('credentials'); // 'credentials' | 'mfa'
	let mfaToken = $state('');
	let mfaMethods = $state<string[]>([]);
	let selectedMethod = $state('');
	let otpCode = $state('');
	let mfaLoading = $state(false);

	async function handleLogin(): Promise<void> {
		error = '';
		try {
			const pubKey = await getPublicKeyForLogin(email);
			const res = await api.login(email, password, pubKey) as { status?: string; mfa_token?: string; methods?: string[] };

			if (res && res.status === 'mfa_required') {
				mfaToken = res.mfa_token || '';
				mfaMethods = res.methods || [];
				selectedMethod = mfaMethods[0] || '';
				step = 'mfa';
				if (selectedMethod === 'hardware_token') {
					handleHardwareTokenAuth();
				}
				return;
			}

			await completeLogin();
		} catch (e: any) {
			error = e.message;
		}
	}

	async function completeLogin(): Promise<void> {
		const me = await api.me();
		$user = me;
		if (me && me.id) {
			localStorage.setItem(`uid_${email.toLowerCase().trim()}`, String(me.id));
		}
		goto(`${base}/`);
	}

	async function handleOtpAuth(): Promise<void> {
		error = '';
		mfaLoading = true;
		try {
			await api.verifyMfa(mfaToken, 'otp', otpCode);
			await completeLogin();
		} catch (e: any) {
			error = e.message;
		} finally {
			mfaLoading = false;
		}
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

	async function handleHardwareTokenAuth(): Promise<void> {
		error = '';
		mfaLoading = true;
		try {
			interface AssertionOptions {
				challenge: string | ArrayBuffer;
				allowCredentials?: Array<{ id: string | ArrayBuffer; [key: string]: unknown }>;
				[key: string]: unknown;
			}
			const authOptionsRes = await api.getMfaHardwareTokenAssertionOptions(mfaToken);
			const options = authOptionsRes.options as unknown as AssertionOptions;

			options.challenge = bufferFromBase64url(options.challenge as string);
			if (options.allowCredentials) {
				options.allowCredentials = options.allowCredentials.map((c) => ({
					...c,
					id: bufferFromBase64url(c.id as string)
				}));
			}

			const assertion = await navigator.credentials.get({ publicKey: options as unknown as PublicKeyCredentialRequestOptions }) as PublicKeyCredential;
			const assertionResponse = assertion.response as AuthenticatorAssertionResponse;

			const webauthnResponse = {
				id: assertion.id,
				rawId: base64urlFromBuffer(assertion.rawId),
				type: assertion.type,
				response: {
					clientDataJSON: base64urlFromBuffer(assertionResponse.clientDataJSON),
					authenticatorData: base64urlFromBuffer(assertionResponse.authenticatorData),
					signature: base64urlFromBuffer(assertionResponse.signature),
					userHandle: assertionResponse.userHandle ? base64urlFromBuffer(assertionResponse.userHandle) : null,
				}
			};

			await api.verifyMfa(mfaToken, 'hardware_token', null, authOptionsRes.assertion_token, webauthnResponse);
			await completeLogin();
		} catch (e: any) {
			error = e.message;
		} finally {
			mfaLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6 col-lg-4">
		<h2 class="mb-4">Login</h2>
		{#if error}
			<div class="alert alert-danger">{error}</div>
		{/if}

		{#if step === 'credentials'}
			<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
				<div class="mb-3">
					<label for="email" class="form-label">Email</label>
					<input type="email" class="form-control" id="email" bind:value={email} required autocomplete="email" />
				</div>
				<div class="mb-3">
					<label for="password" class="form-label">Password</label>
					<input type="password" class="form-control" id="password" bind:value={password} required autocomplete="current-password" />
				</div>
				<button type="submit" class="btn btn-primary w-100">Login</button>
			</form>
			<p class="mt-3 text-center">
				Don't have an account? <a href="{base}/register">Register</a>
			</p>
		{:else if step === 'mfa'}
			<div class="card p-3 shadow-sm border-0 bg-light">
				<h5 class="fw-bold text-center mb-3">🔒 MFA Verification</h5>
				<p class="text-muted small text-center mb-4">Your account is secured with Multi-Factor Authentication. Please select a verification method.</p>

				{#if mfaMethods.length > 1}
					<div class="btn-group w-100 mb-4" role="group">
						{#each mfaMethods as method}
							<input type="radio" class="btn-check" name="mfamethod" id="btnradio_{method}" autocomplete="off" checked={selectedMethod === method} onclick={() => selectedMethod = method} />
							<label class="btn btn-outline-secondary btn-sm" for="btnradio_{method}">{method.toUpperCase()}</label>
						{/each}
					</div>
				{/if}

				{#if selectedMethod === 'otp'}
					<form onsubmit={(e) => { e.preventDefault(); handleOtpAuth(); }}>
						<div class="mb-3">
							<label for="otpCode" class="form-label fw-semibold small">Enter code from authenticator app</label>
							<input type="text" class="form-control text-center font-monospace" id="otpCode" placeholder="e.g. 123456" bind:value={otpCode} required />
						</div>
						<button type="submit" class="btn btn-primary w-100" disabled={mfaLoading}>
							{mfaLoading ? 'Verifying…' : 'Verify Code'}
						</button>
					</form>
				{:else if selectedMethod === 'hardware_token'}
					<div class="text-center py-2">
						<button class="btn btn-primary w-100" onclick={handleHardwareTokenAuth} disabled={mfaLoading}>
							{mfaLoading ? 'Awaiting Device…' : 'Authenticate with Hardware token'}
						</button>
					</div>
				{/if}

				<button class="btn btn-link btn-sm text-decoration-none mt-3" onclick={() => step = 'credentials'}>
					&larr; Back to login
				</button>
			</div>
		{/if}
	</div>
</div>
