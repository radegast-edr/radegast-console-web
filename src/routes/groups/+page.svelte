<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showError } from '$lib/store.js';

	let groups = $state([]);

	onMount(async () => {
		try {
			groups = await api.listGroups();
		} catch (e) {
			showError(e.message);
		}
	});
</script>

<svelte:head>
	<title>Device Groups - Radegast</title>
</svelte:head>

<h2 class="mb-4">Device Groups</h2>

{#if groups.length === 0}
	<p class="text-muted">No device groups found. Create groups from a team's page.</p>
{:else}
	<table class="table table-striped">
		<thead>
			<tr>
				<th>ID</th>
				<th>Name</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each groups as group}
				<tr>
					<td>{group.id}</td>
					<td><a href="{base}/groups/{group.id}">{group.name}</a></td>
					<td><a href="{base}/groups/{group.id}" class="btn btn-sm btn-outline-primary">Manage</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
