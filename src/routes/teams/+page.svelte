<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let teams = $state([]);
	let showCreate = $state(false);
	let newTeamName = $state('');

	onMount(async () => {
		await loadTeams();
	});

	async function loadTeams() {
		try {
			teams = await api.listTeams();
		} catch (e) {
			showError(e.message);
		}
	}

	async function createTeam() {
		try {
			await api.createTeam({
				name: newTeamName,
				permission_pack: 'write',
				permission_invite: 'write',
				permission_admin: 'write',
				permission_logs: 'read'
			});
			showCreate = false;
			newTeamName = '';
			await loadTeams();
			showFlash('Team created successfully');
		} catch (e) {
			showError(e.message);
		}
	}
</script>

<svelte:head>
	<title>Teams - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2>Teams</h2>
	<button class="btn btn-primary" onclick={() => (showCreate = true)}>Create Team</button>
</div>

<div class="list-group">
	{#each teams as team}
		<a href="/teams/{team.id}" class="list-group-item list-group-item-action">
			<div class="d-flex justify-content-between align-items-center">
				<h5 class="mb-1">{team.name}</h5>
				<div>
					{#if team.permission_pack}
						<span class="badge bg-primary me-1">Pack: {team.permission_pack}</span>
					{/if}
					{#if team.permission_logs}
						<span class="badge bg-info me-1">Logs: {team.permission_logs}</span>
					{/if}
					{#if team.permission_admin}
						<span class="badge bg-warning me-1">Admin</span>
					{/if}
				</div>
			</div>
		</a>
	{:else}
		<p class="text-muted">No teams yet.</p>
	{/each}
</div>

<Modal show={showCreate} title="Create Team" onClose={() => (showCreate = false)}>
	<form onsubmit={(e) => { e.preventDefault(); createTeam(); }}>
		<div class="mb-3">
			<label for="teamName" class="form-label">Team Name</label>
			<input type="text" class="form-control" id="teamName" bind:value={newTeamName} required />
		</div>
		<button type="submit" class="btn btn-primary">Create</button>
	</form>
</Modal>
