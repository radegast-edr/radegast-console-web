<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
</script>

<svelte:head>
	<title>{page.status} Error - Radegast</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-8 col-lg-6 text-center">
		<div class="card p-4 shadow-sm bg-body-tertiary">
			<div class="mb-3 text-danger">
				{#if page.status === 404}
					<Icon icon="lucide:file-question" style="font-size: 3.5rem;" />
				{:else}
					<Icon icon="lucide:server-crash" style="font-size: 3.5rem;" />
				{/if}
			</div>
			<h2 class="mb-3 fw-bold">
				{page.status} - {page.status === 404 ? 'Page Not Found' : (page.status >= 500 ? 'Server Error' : 'Error')}
			</h2>
			<p class="text-body-secondary mb-4">
				{page.error?.message || (page.status === 404 ? 'The requested page could not be found.' : 'An unexpected error occurred.')}
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
			</div>
		</div>
	</div>
</div>
