<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';

	let statusParam = $derived(page.url.searchParams.get('status'));
</script>

<svelte:head>
	<title>Server Error - Radegast</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-8 col-lg-6 text-center">
		<div class="card p-4 shadow-sm bg-body-tertiary">
			<div class="mb-3 text-danger">
				<Icon icon="lucide:server-crash" style="font-size: 3.5rem;" />
			</div>
			<h2 class="mb-3 fw-bold">
				{#if statusParam && statusParam !== 'network_error'}
					{statusParam} - Server Error
				{:else if statusParam === 'network_error'}
					Connection Error
				{:else}
					Server Error
				{/if}
			</h2>
			<p class="text-body-secondary mb-4">
				{#if statusParam === 'network_error'}
					Unable to connect to the Radegast backend service. Please check your network connection or verify that the server is running.
				{:else}
					The Radegast backend encountered an unexpected error and could not complete your request. Your session credentials are safe.
				{/if}
			</p>
			<div class="d-flex justify-content-center gap-3">
				<button class="btn btn-primary d-inline-flex align-items-center gap-2" onclick={() => window.location.reload()}>
					<Icon icon="lucide:refresh-cw" />
					<span>Try Again</span>
				</button>
				<a href="{base}/" class="btn btn-outline-secondary d-inline-flex align-items-center gap-2">
					<Icon icon="lucide:home" />
					<span>Dashboard</span>
				</a>
				<a href="{base}/login" class="btn btn-link text-decoration-none d-inline-flex align-items-center gap-1">
					<span>Go to Login</span>
				</a>
			</div>
		</div>
	</div>
</div>
