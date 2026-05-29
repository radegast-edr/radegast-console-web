<script>
	import { page } from '$app/stores';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';

	let group = $state(null);
	let allTeams = $state([]);
	let allDevices = $state([]);
	let addTeamId = $state('');
	let addDeviceId = $state('');

	// inline rename
	let editingName = $state(false);
	let editName = $state('');

	$effect(() => {
		loadGroup($page.params.id);
	});

	async function loadGroup(id) {
		try {
			const [g, teams, devices] = await Promise.all([
				api.getGroup(id),
				api.listTeams(),
				api.listDevices()
			]);
			group = g;

			const groupTeamIds = new Set((g.teams ?? []).map((t) => t.id));
			allTeams = teams.filter((t) => !groupTeamIds.has(t.id));
			addTeamId = allTeams.length > 0 ? String(allTeams[0].id) : '';

			const groupDeviceIds = new Set((g.devices ?? []).map((d) => d.id));
			allDevices = devices.filter((d) => !groupDeviceIds.has(d.id));
			addDeviceId = allDevices.length > 0 ? String(allDevices[0].id) : '';
		} catch (e) {
			showError(e.message);
		}
	}

	function startRename() {
		editName = group.name;
		editingName = true;
	}

	async function saveName() {
		try {
			await api.renameGroup(group.id, editName);
			editingName = false;
			await loadGroup(group.id);
			showFlash('Group renamed');
		} catch (e) {
			showError(e.message);
		}
	}

	async function unlinkTeam(teamId) {
		try {
			await api.unlinkGroupFromTeam(group.id, teamId);
			showFlash('Team unlinked from group');
			await loadGroup(group.id);
		} catch (e) {
			showError(e.message);
		}
	}

	async function linkTeam() {
		if (!addTeamId) return;
		try {
			await api.linkGroupToTeam(Number(addTeamId), group.id);
			showFlash('Team linked');
			await loadGroup(group.id);
		} catch (e) {
			showError(e.message);
		}
	}

	async function removeDevice(deviceId) {
		try {
			await api.removeDeviceFromGroupViaGroup(group.id, deviceId);
			showFlash('Device removed from group');
			await loadGroup(group.id);
		} catch (e) {
			showError(e.message);
		}
	}

	async function addDevice() {
		if (!addDeviceId) return;
		try {
			await api.addDeviceToGroupViaGroup(group.id, Number(addDeviceId));
			showFlash('Device added to group');
			await loadGroup(group.id);
		} catch (e) {
			showError(e.message);
		}
	}
</script>

<svelte:head>
	<title>{group?.name ?? 'Group'} - Radegast</title>
</svelte:head>

{#if group}
	<div class="mb-4">
		<a href="/groups" class="btn btn-outline-secondary btn-sm mb-2">← Back to Groups</a>
		<div class="d-flex align-items-center gap-2 mt-1">
			{#if editingName}
				<input class="form-control form-control-lg w-auto" bind:value={editName} />
				<button class="btn btn-success btn-sm" onclick={saveName}>Save</button>
				<button class="btn btn-outline-secondary btn-sm" onclick={() => (editingName = false)}>Cancel</button>
			{:else}
				<h2 class="mb-0">{group.name}</h2>
				<button class="btn btn-outline-secondary btn-sm" onclick={startRename} title="Rename group">✎</button>
			{/if}
		</div>
	</div>

	<!-- Teams section -->
	<div class="card mb-4">
		<div class="card-header"><h5 class="mb-0">Teams</h5></div>
		<div class="card-body">
			{#if (group.teams ?? []).length === 0}
				<p class="text-muted">No teams linked to this group.</p>
			{:else}
				<table class="table table-sm mb-3">
					<thead>
						<tr>
							<th>Team</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each group.teams as team}
							{@const isLast = (group.teams ?? []).length <= 1}
							<tr>
								<td><a href="/teams/{team.id}">{team.name}</a></td>
								<td>
									<span
										class="d-inline-block"
										title={isLast ? 'Cannot remove the last team from a group' : ''}
									>
										<button
											class="btn btn-sm btn-outline-danger"
											onclick={() => unlinkTeam(team.id)}
											disabled={isLast}
											style={isLast ? 'pointer-events:none' : ''}>Unlink</button
										>
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="d-flex gap-2 align-items-center">
				{#if allTeams.length > 0}
					<select class="form-select form-select-sm" bind:value={addTeamId}>
						{#each allTeams as t}
							<option value={String(t.id)}>{t.name}</option>
						{/each}
					</select>
					<button class="btn btn-sm btn-primary" onclick={linkTeam}>Link Team</button>
				{:else}
					<span class="text-muted small">All your teams are already linked to this group.</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Devices section -->
	<div class="card mb-4">
		<div class="card-header"><h5 class="mb-0">Devices</h5></div>
		<div class="card-body">
			{#if (group.devices ?? []).length === 0}
				<p class="text-muted">No devices in this group.</p>
			{:else}
				<table class="table table-sm mb-3">
					<thead>
						<tr>
							<th>Device</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each group.devices as device}
							<tr>
								<td><a href="/devices/{device.id}">{device.name}</a></td>
								<td>
									<button
										class="btn btn-sm btn-outline-danger"
										onclick={() => removeDevice(device.id)}>Remove</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="d-flex gap-2 align-items-center">
				{#if allDevices.length > 0}
					<select class="form-select form-select-sm" bind:value={addDeviceId}>
						{#each allDevices as d}
							<option value={String(d.id)}>{d.name}</option>
						{/each}
					</select>
					<button class="btn btn-sm btn-primary" onclick={addDevice}>Add Device</button>
				{:else}
					<span class="text-muted small">All your devices are already in this group.</span>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<p>Loading…</p>
{/if}
