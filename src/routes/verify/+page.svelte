<script lang="ts">
	import { base } from '$app/paths';
	import { api } from '$lib/api';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Spinner from '$lib/components/Spinner.svelte';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');

	onMount(async () => {
		const token = $page.url.searchParams.get('token');
		if (!token) {
			status = 'error';
			errorMessage = 'No verification token found in the link. Please check your email and try again.';
			return;
		}
		try {
			await api.verifyEmail(token);
			status = 'success';
		} catch (e) {
			status = 'error';
			errorMessage = (e as Error).message || 'The verification link is invalid or has expired. Please register again.';
		}
	});
</script>

<svelte:head>
	<title>Verify Email — Radegast EDR</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-6 col-lg-4 text-center">
		{#if status === 'loading'}
			<Spinner centered size="lg" color="primary" text="Verifying your email address…" py={3} />

		{:else if status === 'success'}
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
