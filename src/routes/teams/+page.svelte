<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type Team } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';

	let teams = $state<Team[]>([]);
	let showCreate = $state(false);
	let newTeamName = $state('');

	onMount(async () => {
		await loadTeams();
	});

	async function loadTeams(): Promise<void> {
		try {
			teams = await api.listTeams();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function createTeam(): Promise<void> {
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
			showError((e as Error).message);
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

{#if teams.length === 0}
	<p class="text-muted">No teams yet.</p>
{:else}
	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>Name</th>
				<th>Permissions</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each teams as team}
				<tr>
					<td>
						<a href="{base}/teams/{team.id}">{team.name}</a>
					</td>
					<td>
						{#if team.permission_pack}
							<span class="badge bg-primary me-1">Pack: {team.permission_pack}</span>
						{/if}
						{#if team.permission_logs}
							<span class="badge bg-info me-1">Logs: {team.permission_logs}</span>
						{/if}
						{#if team.permission_admin}
							<span class="badge bg-warning me-1">Admin</span>
						{/if}
					</td>
					<td>
						<a href="{base}/teams/{team.id}" class="btn btn-sm btn-outline-primary">Manage</a>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<Modal show={showCreate} title="Create Team" onClose={() => (showCreate = false)}>
	<form onsubmit={(e) => { e.preventDefault(); createTeam(); }}>
		<div class="mb-3">
			<label for="teamName" class="form-label">Team Name</label>
			<input type="text" class="form-control" id="teamName" bind:value={newTeamName} required />
		</div>
		<button type="submit" class="btn btn-primary">Create</button>
	</form>
</Modal>
