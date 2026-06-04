<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type Group, type Team } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';

	let groups = $state<Group[]>([]);
	let showCreate = $state(false);
	let newGroupName = $state('');
	let newGroupTeamId = $state('');
	let availableTeams = $state<Team[]>([]);

	onMount(async () => {
		await loadGroups();
	});

	async function loadGroups(): Promise<void> {
		try {
			const data = await api.listGroups();
			groups = data;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function openCreateModal(): Promise<void> {
		newGroupName = '';
		newGroupTeamId = '';
		availableTeams = [];
		try {
			const data = await api.listTeams();
			availableTeams = data;
			if (availableTeams.length > 0) {
				newGroupTeamId = String(availableTeams[0].id);
			}
		} catch (e) {
			showError('Failed to load teams: ' + (e as Error).message);
		}
		showCreate = true;
	}

	async function createGroup(): Promise<void> {
		if (!newGroupTeamId) {
			showError('Please select a team.');
			return;
		}
		try {
			await api.createTeamGroup(Number(newGroupTeamId), newGroupName);
			newGroupName = '';
			showCreate = false;
			await loadGroups();
			showFlash('Device group created successfully');
		} catch (e) {
			showError((e as Error).message);
		}
	}
</script>

<svelte:head>
	<title>Device Groups - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2>Device Groups</h2>
	<button class="btn btn-primary" onclick={openCreateModal}>Add Group</button>
</div>

{#if groups.length === 0}
	<p class="text-muted">No device groups found. Create one to get started.</p>
{:else}
	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>Name</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each groups as group}
				<tr>
					<td><a href="{base}/groups/{group.id}">{group.name}</a></td>
					<td><a href="{base}/groups/{group.id}" class="btn btn-sm btn-outline-primary">Manage</a></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<Modal show={showCreate} title="Add Device Group" onClose={() => (showCreate = false)}>
	<form onsubmit={(e) => { e.preventDefault(); createGroup(); }}>
		<div class="mb-3">
			<label for="groupName" class="form-label">Group Name</label>
			<input
				type="text"
				class="form-control"
				id="groupName"
				bind:value={newGroupName}
				required
			/>
		</div>
		<div class="mb-3">
			<label for="teamSelect" class="form-label">Team</label>
			{#if availableTeams.length === 0}
				<div class="text-muted small">
					No teams available. Create a team first.
				</div>
			{:else}
				<select class="form-select" id="teamSelect" bind:value={newGroupTeamId} required>
					{#each availableTeams as team}
						<option value={String(team.id)}>{team.name}</option>
					{/each}
				</select>
			{/if}
		</div>
		<button type="submit" class="btn btn-primary" disabled={availableTeams.length === 0}>
			Create Group
		</button>
	</form>
</Modal>
