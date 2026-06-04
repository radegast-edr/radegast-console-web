<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { showFlash } from '$lib/store';



	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state(false);
	let acceptedPolicies = $state(false);

	let turnstileSiteKey = $state<string | null>(null);
	let turnstileToken = $state<string | null>(null);

	onMount(async () => {
		try {
			const config = await api.getAuthConfig() as { turnstile_site_key?: string | null };
			turnstileSiteKey = config.turnstile_site_key || null;
			if (turnstileSiteKey) {
				const checkTurnstile = setInterval(() => {
					if ((window as any).turnstile) {
						clearInterval(checkTurnstile);
						(window as any).turnstile.render('#cf-turnstile-container', {
							sitekey: turnstileSiteKey,
							callback: (token: string) => {
								turnstileToken = token;
							},
							'error-callback': () => {
								error = 'Failed to load or solve CAPTCHA. Please try again.';
							},
							'expired-callback': () => {
								turnstileToken = null;
							}
						});
					}
				}, 100);
			}
		} catch (e) {
			console.error('Failed to load auth config:', e);
		}
	});

	async function handleRegister(): Promise<void> {
		error = '';
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}
		if (!acceptedPolicies) {
			error = 'You must accept the Terms of Service and Privacy Policy to register.';
			return;
		}
		if (turnstileSiteKey && !turnstileToken) {
			error = 'Please complete the Cloudflare Turnstile challenge';
			return;
		}
		try {
			await api.register(email, password, turnstileToken);
			success = true;
			showFlash('Registration successful! Check your email to verify your account.');
		} catch (e: any) {
			error = e.message;
			// Reset Turnstile on failure if rendered
			if ((window as any).turnstile && turnstileSiteKey) {
				(window as any).turnstile.reset('#cf-turnstile-container');
				turnstileToken = null;
			}
		}
	}
</script>

<svelte:head>
	<title>Register - Radegast</title>
	{#if turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6 col-lg-4">
		<h2 class="mb-4">Register</h2>
		{#if success}
			<div class="alert alert-success">
				Registration successful! Please check your email and click the verification link.
			</div>
			<p class="text-center"><a href="{base}/login">Go to Login</a></p>
		{:else}
			{#if error}
				<div class="alert alert-danger">{error}</div>
			{/if}
			<form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
				<div class="mb-3">
					<label for="email" class="form-label">Email</label>
					<input type="email" class="form-control" id="email" bind:value={email} required autocomplete="email" />
				</div>
				<div class="mb-3">
					<label for="password" class="form-label">Password</label>
					<input
						type="password"
						class="form-control"
						id="password"
						bind:value={password}
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</div>
				<div class="mb-3">
					<label for="confirm" class="form-label">Confirm Password</label>
					<input
						type="password"
						class="form-control"
						id="confirm"
						bind:value={confirmPassword}
						required
						autocomplete="new-password"
					/>
				</div>
				<div class="mb-3 form-check">
					<input
						type="checkbox"
						class="form-check-input"
						id="acceptPolicies"
						bind:checked={acceptedPolicies}
						required
					/>
					<label class="form-check-label small text-muted" for="acceptPolicies">
						I accept the <a href="{base}/terms" target="_blank" onclick={(e) => e.stopPropagation()}>Terms of Service</a> and <a href="{base}/privacy" target="_blank" onclick={(e) => e.stopPropagation()}>Privacy Policy</a>
					</label>
				</div>
				{#if turnstileSiteKey}
					<div class="mb-3 d-flex justify-content-center">
						<div id="cf-turnstile-container"></div>
					</div>
				{/if}
				<div class="mb-3 d-flex justify-content-center">
					<div class="alert alert-warning">
						Radegast is currently in open beta.
						What is currently available is fully functional and we are actively working on improving the experience.
						Primarily, current detection packs are a demo of how the detection system works and we are working on improving them and adding more.
					</div>
				</div>
				<button type="submit" class="btn btn-primary w-100">Register</button>
			</form>
			<p class="mt-3 text-center">
				Already have an account? <a href="{base}/login">Login</a>
			</p>
		{/if}
	</div>
</div>
