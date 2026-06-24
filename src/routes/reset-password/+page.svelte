<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { api } from '$lib/api';
	import { showFlash } from '$lib/store';
	import Spinner from '$lib/components/Spinner.svelte';

	let email = $state('');
	let error = $state('');
	let success = $state(false);
	let successMessage = $state('');
	let loading = $state(false);

	let token = $state<string | null>(null);
	let turnstileSiteKey = $state<string | null>(null);
	let turnstileToken = $state<string | null>(null);

	onMount(async () => {
		token = $page.url.searchParams.get('token');
		if (token) {
			loading = true;
			try {
				const res = await api.confirmPasswordReset(token) as { message: string };
				successMessage = res.message || 'Your password has been reset successfully. Please check your email for the new password.';
				success = true;
			} catch (e: any) {
				error = e.message || 'Failed to reset password. The link may have expired or is invalid.';
			} finally {
				loading = false;
			}
		} else {
			try {
				const config = await api.getAuthConfig() as { turnstile_site_key?: string | null };
				turnstileSiteKey = config.turnstile_site_key || null;
				if (turnstileSiteKey) {
					const checkTurnstile = setInterval(() => {
						if ((window as any).turnstile) {
							clearInterval(checkTurnstile);
							(window as any).turnstile.render('#cf-turnstile-container', {
								sitekey: turnstileSiteKey,
								callback: (t: string) => {
									turnstileToken = t;
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
		}
	});

	async function handleRequestReset(): Promise<void> {
		error = '';
		if (turnstileSiteKey && !turnstileToken) {
			error = 'Please complete the Cloudflare Turnstile challenge';
			return;
		}
		loading = true;
		try {
			const res = await api.requestPasswordReset(email, turnstileToken) as { message: string };
			success = true;
			successMessage = res.message || 'If the account exists, a password reset link has been sent to your email.';
			showFlash(successMessage);
		} catch (e: any) {
			error = e.message;
			if ((window as any).turnstile && turnstileSiteKey) {
				(window as any).turnstile.reset('#cf-turnstile-container');
				turnstileToken = null;
			}
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password - Radegast</title>
	{#if turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6 col-lg-4">
		<h2 class="mb-4">Reset Password</h2>

		{#if loading}
			<div class="text-center py-5">
				<Spinner centered text={token ? "Confirming password reset..." : "Sending password reset request..."} />
			</div>
		{:else if success}
			<div class="alert alert-success">
				{successMessage}
			</div>
			<p class="text-center"><a href="{base}/login">Go to Login</a></p>
		{:else}
			{#if error}
				<div class="alert alert-danger">{error}</div>
			{/if}

			{#if token}
				<p class="text-muted small text-center mb-4">
					There was a problem resetting your password. The link might have expired or been used already.
				</p>
				<p class="text-center">
					<a href="{base}/reset-password">Request a new reset link</a>
				</p>
			{:else}
				<form onsubmit={(e) => { e.preventDefault(); handleRequestReset(); }}>
					<p class="text-muted small mb-3">
						Enter your email address and we'll send you a link to reset your password.
					</p>
					<div class="mb-3">
						<label for="email" class="form-label">Email</label>
						<input type="email" class="form-control" id="email" bind:value={email} required autocomplete="email" />
					</div>

					{#if turnstileSiteKey}
						<div class="mb-3 d-flex justify-content-center">
							<div id="cf-turnstile-container"></div>
						</div>
					{/if}

					<button type="submit" class="btn btn-primary w-100">Send Reset Link</button>
				</form>
				<p class="mt-3 text-center">
					Remembered your password? <a href="{base}/login">Login</a>
				</p>
			{/if}
		{/if}
	</div>
</div>
