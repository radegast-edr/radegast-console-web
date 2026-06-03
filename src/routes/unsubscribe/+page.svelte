<script lang="ts">
	import { base } from '$app/paths';
	import { api } from '$lib/api';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');
	let successMessage = $state('You have been successfully unsubscribed.');
	let isExpired = $state(false);

	onMount(async () => {
		const token = $page.url.searchParams.get('token');
		if (!token) {
			status = 'error';
			errorMessage = 'No unsubscribe token found in the link. Please check your email and try again.';
			return;
		}
		try {
			const res = await api.unsubscribe(token);
			successMessage = res.message || 'You have been successfully unsubscribed.';
			status = 'success';
		} catch (e) {
			status = 'error';
			errorMessage = (e as Error).message || 'The unsubscribe link is invalid or has expired.';
			if (errorMessage.toLowerCase().includes('expired') || errorMessage.toLowerCase().includes('log in') || errorMessage.toLowerCase().includes('manual')) {
				isExpired = true;
			}
		}
	});
</script>

<svelte:head>
	<title>Unsubscribe — Radegast EDR</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-6 col-lg-5 text-center">
		{#if status === 'loading'}
			<div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
				<span class="visually-hidden">Unsubscribing…</span>
			</div>
			<p class="text-muted">Processing your unsubscribe request…</p>

		{:else if status === 'success'}
			<div class="mb-4" style="font-size: 4rem;">🔕</div>
			<h2 class="fw-bold mb-2">Unsubscribed</h2>
			<p class="text-muted mb-4">{successMessage}</p>
			<a href="{base}/login" class="btn btn-primary px-5">Go to Login</a>

		{:else}
			<div class="mb-4" style="font-size: 4rem;">⚠️</div>
			<h2 class="fw-bold mb-2">Unsubscribe Failed</h2>
			<p class="text-muted mb-4">{errorMessage}</p>
			{#if isExpired}
				<a href="{base}/login" class="btn btn-primary px-5 mb-2">Go to Login</a>
			{:else}
				<a href="{base}/login" class="btn btn-outline-primary px-5">Back to Login</a>
			{/if}
		{/if}
	</div>
</div>
