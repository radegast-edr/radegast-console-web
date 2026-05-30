<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let devices = $state([]);
	let showCreate = $state(false);
	let newDeviceName = $state('');
	let newDeviceToken = $state('');
	let newDeviceGroupId = $state('');
	/** @type {Array<{id: number, teamName: string, name: string}>} */
	let availableGroups = $state([]);
	let selectedOS = $state('linux');

	onMount(async () => {
		await loadDevices();
	});

	async function loadDevices() {
		try {
			devices = await api.listDevices();
		} catch (e) {
			showError(e.message);
		}
	}

	async function openCreateModal() {
		newDeviceToken = '';
		newDeviceName = '';
		newDeviceGroupId = '';
		availableGroups = [];
		selectedOS = 'linux';

		try {
			const teams = await api.listTeams();
			const grouped = await Promise.all(
				teams.map(async (team) => {
					const groups = await api.listTeamGroups(team.id);
					return groups.map((g) => ({ id: g.id, teamName: team.name, name: g.name }));
				})
			);
			availableGroups = grouped.flat();
			if (availableGroups.length > 0) newDeviceGroupId = String(availableGroups[0].id);
		} catch (e) {
			showError('Failed to load groups: ' + e.message);
		}

		showCreate = true;
	}

	async function createDevice() {
		if (!newDeviceGroupId) { showError('Please select a device group.'); return; }
		try {
			const result = await api.createDevice(newDeviceName, Number(newDeviceGroupId));
			newDeviceToken = result.token;
			newDeviceName = '';
			showCreate = false;
			await loadDevices();
			showFlash('Device created! Save the token shown below.');
		} catch (e) {
			showError(e.message);
		}
	}

	async function deleteDevice(id) {
		if (!confirm('Delete this device?')) return;
		try {
			await api.deleteDevice(id);
			await loadDevices();
			showFlash('Device deleted');
		} catch (e) {
			showError(e.message);
		}
	}
</script>

<svelte:head>
	<title>Devices - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2>Devices</h2>
	<button
		class="btn btn-primary"
		onclick={openCreateModal}>Add Device</button
	>
</div>

{#if newDeviceToken}
	{@const backendUrl = api.getBackendUrl().replace(/\/$/, '')}
	<div class="card border-warning mb-4 shadow-sm">
		<div class="card-header bg-warning-subtle text-warning-emphasis py-3">
			<h5 class="mb-0 fw-bold">Device Created: Setup Agent</h5>
		</div>
		<div class="card-body">
			<div class="mb-3">
				<label class="form-label fw-semibold">1. Select Target Operating System:</label>
				<div class="btn-group d-block" role="group">
					<button
						type="button"
						class="btn {selectedOS === 'linux' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => (selectedOS = 'linux')}
					>
						Linux
					</button>
					<button
						type="button"
						class="btn {selectedOS === 'windows' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => (selectedOS = 'windows')}
					>
						Windows
					</button>
				</div>
			</div>

			{#if selectedOS === 'linux'}
				<div class="mb-3">
					<label class="form-label fw-semibold">2. Run this command on your Linux device as root:</label>
					<div class="input-group">
						<code class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							curl -sSL "{backendUrl}/device/install?os=linux" | sudo RADEGAST_TOKEN="{newDeviceToken}" sh
						</code>
					</div>
					<small class="form-text text-muted">
						This will verify system requirements, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and configure systemd services.
					</small>
				</div>
			{:else}
				<div class="mb-3">
					<label class="form-label fw-semibold">2. Run this command on your Windows device in an Administrator PowerShell prompt:</label>
					<div class="input-group">
						<code class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							$env:RADEGAST_TOKEN="{newDeviceToken}"; iwr -useb "{backendUrl}/device/install?os=windows" -OutFile install.bat; .\install.bat
						</code>
					</div>
					<small class="form-text text-muted">
						This will download portable Python, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and register background Scheduled Tasks.
					</small>
				</div>
			{/if}

			<button class="btn btn-secondary btn-sm" onclick={() => (newDeviceToken = '')}>
				Dismiss
			</button>
		</div>
	</div>
{/if}

<table class="table table-striped">
	<thead>
		<tr>
			<th>ID</th>
			<th>Name</th>
			<th>Actions</th>
		</tr>
	</thead>
	<tbody>
		{#each devices as device}
			<tr>
				<td>{device.id}</td>
				<td>
					<a href="{base}/devices/{device.id}">{device.name}</a>
					{#if !device.signature_public_key}
						<span class="badge bg-danger ms-2" title="Unsigned device! Signing key is not set.">Unsigned</span>
					{/if}
				</td>
				<td>
					<button
						class="btn btn-sm btn-outline-danger"
						onclick={() => deleteDevice(device.id)}>Delete</button
					>
				</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="text-muted">No devices found</td></tr>
		{/each}
	</tbody>
</table>

<Modal show={showCreate} title="Add Device" onClose={() => (showCreate = false)}>
	<form onsubmit={(e) => { e.preventDefault(); createDevice(); }}>
		<div class="mb-3">
			<label for="deviceName" class="form-label">Device Name</label>
			<input
				type="text"
				class="form-control"
				id="deviceName"
				bind:value={newDeviceName}
				required
			/>
		</div>
		<div class="mb-3">
			<label for="deviceGroup" class="form-label">Device Group</label>
			{#if availableGroups.length === 0}
				<div class="text-muted small">
					No groups available. Create a team and add a group first.
				</div>
			{:else}
				<select class="form-select" id="deviceGroup" bind:value={newDeviceGroupId} required>
					{#each availableGroups as g}
						<option value={String(g.id)}>{g.teamName} / {g.name}</option>
					{/each}
				</select>
			{/if}
		</div>
		<button type="submit" class="btn btn-primary" disabled={availableGroups.length === 0}>
			Create Device
		</button>
	</form>
</Modal>
