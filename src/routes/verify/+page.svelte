<script>
	import { base } from '$app/paths';
	import { api } from '$lib/api.js';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let state = $state('loading'); // 'loading' | 'success' | 'error'
	let errorMessage = $state('');

	onMount(async () => {
		const token = $page.url.searchParams.get('token');
		if (!token) {
			state = 'error';
			errorMessage = 'No verification token found in the link. Please check your email and try again.';
			return;
		}
		try {
			await api.verifyEmail(token);
			state = 'success';
		} catch (e) {
			state = 'error';
			errorMessage = e.message || 'The verification link is invalid or has expired. Please register again.';
		}
	});
</script>

<svelte:head>
	<title>Verify Email — Radegast EDR</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-6 col-lg-4 text-center">
		{#if state === 'loading'}
			<div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
				<span class="visually-hidden">Verifying…</span>
			</div>
			<p class="text-muted">Verifying your email address…</p>

		{:else if state === 'success'}
			<div class="mb-4" style="font-size: 4rem;">✅</div>
			<h2 class="fw-bold mb-2">Email Verified</h2>
			<p class="text-muted mb-4">Your account is now active. You can log in and start using Radegast EDR.</p>
			<a href="{base}/login" class="btn btn-primary px-5">Go to Login</a>

		{:else}
			<div class="mb-4" style="font-size: 4rem;">❌</div>
			<h2 class="fw-bold mb-2">Verification Failed</h2>
			<p class="text-muted mb-4">{errorMessage}</p>
			<a href="{base}/register" class="btn btn-outline-primary px-5">Back to Register</a>
		{/if}
	</div>
</div>
