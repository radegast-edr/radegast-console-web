<script lang="ts">
	import { base } from '$app/paths';
	import { api } from '$lib/api';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');

	onMount(async () => {
		const token = $page.url.searchParams.get('token');
		if (!token) {
			status = 'error';
			errorMessage = 'No invitation token found in the link. Please check your email and try again.';
			return;
		}
		try {
			const res = await api.acceptInvite(token) as any;
			status = 'success';
			if (res && res.message) {
				errorMessage = res.message;
			}
		} catch (e) {
			status = 'error';
			errorMessage = (e as Error).message || 'The invitation link is invalid or has expired.';
		}
	});
</script>

<svelte:head>
	<title>Accept Team Invitation — Radegast EDR</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-6 col-lg-5 text-center">
		{#if status === 'loading'}
			<div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
				<span class="visually-hidden">Joining…</span>
			</div>
			<p class="text-muted">Joining the team…</p>

		{:else if status === 'success'}
			<div class="mb-4" style="font-size: 4rem;">🎉</div>
			<h2 class="fw-bold mb-2">Invitation Accepted</h2>
			<p class="text-muted mb-4">{errorMessage || 'You have successfully joined the team.'}</p>
			<a href="{base}/" class="btn btn-primary px-5">Go to Dashboard</a>

		{:else}
			<div class="mb-4" style="font-size: 4rem;">❌</div>
			<h2 class="fw-bold mb-2">Invitation Failed</h2>
			<p class="text-muted mb-4">{errorMessage}</p>
			<a href="{base}/" class="btn btn-outline-primary px-5">Go to Dashboard</a>
		{/if}
	</div>
</div>
