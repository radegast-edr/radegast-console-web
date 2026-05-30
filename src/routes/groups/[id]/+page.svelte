<script>
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let group = $state(null);
	let allTeams = $state([]);
	let allDevices = $state([]);
	let addTeamId = $state('');
	let addDeviceId = $state('');

	// User teams and Pack Write Permissions
	let userTeams = $state([]);
	let hasPackWrite = $derived.by(() => {
		if (!group || userTeams.length === 0) return false;
		const userTeamIds = new Set(userTeams.map(t => t.id));
		return (group.teams ?? []).some(t => userTeamIds.has(t.id) && t.permission_pack === 'write');
	});

	// Pack Management State
	let enabledPacks = $state([]);
	let showEnablePackModal = $state(false);
	let availablePacks = $state([]);
	let selectedPackId = $state('');
	let packVersions = $state([]);
	let selectedVersionId = $state('');
	let autoupdate = $state(true);

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
			userTeams = teams;

			const groupTeamIds = new Set((g.teams ?? []).map((t) => t.id));
			allTeams = teams.filter((t) => !groupTeamIds.has(t.id));
			addTeamId = allTeams.length > 0 ? String(allTeams[0].id) : '';

			const groupDeviceIds = new Set((g.devices ?? []).map((d) => d.id));
			allDevices = devices.filter((d) => !groupDeviceIds.has(d.id));
			addDeviceId = allDevices.length > 0 ? String(allDevices[0].id) : '';

			await loadEnabledPacks(id);
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

	async function loadEnabledPacks(groupId) {
		try {
			enabledPacks = await api.listEnabledPacks(groupId);
		} catch (e) {
			showError(e.message);
		}
	}

	async function disablePack(enabledId) {
		if (!confirm('Disable this pack for the group?')) return;
		try {
			await api.disablePack(group.id, enabledId);
			showFlash('Pack disabled');
			await loadEnabledPacks(group.id);
		} catch (e) {
			showError(e.message);
		}
	}

	async function openEnablePack() {
		try {
			availablePacks = await api.listPacks();
			selectedPackId = availablePacks.length > 0 ? String(availablePacks[0].id) : '';
			packVersions = [];
			selectedVersionId = '';
			autoupdate = true;
			if (selectedPackId) {
				await loadVersionsForSelectedPack(Number(selectedPackId));
			}
			showEnablePackModal = true;
		} catch (e) {
			showError(e.message);
		}
	}

	async function handlePackChange(e) {
		const packId = Number(e.target.value);
		await loadVersionsForSelectedPack(packId);
	}

	async function loadVersionsForSelectedPack(packId) {
		try {
			packVersions = await api.listVersions(packId);
			selectedVersionId = packVersions.length > 0 ? String(packVersions[0].id) : '';
		} catch (e) {
			showError(e.message);
		}
	}

	async function enablePack() {
		if (!selectedVersionId) {
			showError('Please select a version');
			return;
		}
		try {
			await api.enablePack(group.id, Number(selectedVersionId), autoupdate);
			showEnablePackModal = false;
			showFlash('Pack enabled successfully');
			await loadEnabledPacks(group.id);
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
		<a href="{base}/groups" class="btn btn-outline-secondary btn-sm mb-2">← Back to Groups</a>
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
								<td><a href="{base}/teams/{team.id}">{team.name}</a></td>
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
								<td><a href="{base}/devices/{device.id}">{device.name}</a></td>
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

	<!-- Packs section -->
	<div class="card mb-4">
		<div class="card-header d-flex justify-content-between align-items-center">
			<h5 class="mb-0">Enabled Packs</h5>
			{#if hasPackWrite}
				<button class="btn btn-sm btn-primary" onclick={openEnablePack}>Enable Pack</button>
			{/if}
		</div>
		<div class="card-body">
			{#if enabledPacks.length === 0}
				<p class="text-muted">No packs enabled for this group.</p>
			{:else}
				<table class="table table-sm mb-0 align-middle">
					<thead>
						<tr>
							<th>Pack Name</th>
							<th>Version</th>
							<th>Autoupdate</th>
							{#if hasPackWrite}
								<th></th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each enabledPacks as pe}
							<tr>
								<td class="fw-bold">{pe.pack_name}</td>
								<td><span class="badge bg-success">{pe.version}</span></td>
								<td>
									{#if pe.autoupdate}
										<span class="text-success">✓ Yes</span>
									{:else}
										<span class="text-muted">✗ No</span>
									{/if}
								</td>
								{#if hasPackWrite}
									<td>
										<button
											class="btn btn-sm btn-outline-danger"
											onclick={() => disablePack(pe.id)}>Disable</button
										>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	<!-- Enable Pack Modal -->
	<Modal show={showEnablePackModal} title="Enable Pack for Group" onClose={() => (showEnablePackModal = false)}>
		<form onsubmit={(e) => { e.preventDefault(); enablePack(); }}>
			<div class="mb-3">
				<label for="selectPack" class="form-label">Select Pack</label>
				<select class="form-select" id="selectPack" bind:value={selectedPackId} onchange={handlePackChange} required>
					{#each availablePacks as p}
						<option value={String(p.id)}>{p.name}</option>
					{/each}
				</select>
			</div>
			<div class="mb-3">
				<label for="selectVersion" class="form-label">Select Version</label>
				{#if packVersions.length === 0}
					<p class="text-danger small">No versions available for this pack. Upload a version first.</p>
				{:else}
					<select class="form-select" id="selectVersion" bind:value={selectedVersionId} required>
						{#each packVersions as v}
							<option value={String(v.id)}>{v.version}</option>
						{/each}
					</select>
				{/if}
			</div>
			<div class="form-check mb-3">
				<input class="form-check-input" type="checkbox" id="autoupdate" bind:checked={autoupdate} />
				<label class="form-check-label" for="autoupdate">
					Automatically update to newer versions
				</label>
			</div>
			<button type="submit" class="btn btn-primary" disabled={packVersions.length === 0}>Enable Pack</button>
		</form>
	</Modal>
{:else}
	<p>Loading…</p>
{/if}
