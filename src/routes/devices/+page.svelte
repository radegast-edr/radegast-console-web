<script>
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
	<div class="alert alert-warning">
		<h5>Device Token (shown once)</h5>
		<code class="d-block p-2 bg-dark text-light rounded">{newDeviceToken}</code>
		<p class="mt-2 mb-0">Copy this token and configure it in your rustinel wrapper.</p>
		<button class="btn btn-sm btn-outline-secondary mt-2" onclick={() => (newDeviceToken = '')}
			>Dismiss</button
		>
	</div>
{/if}

<table class="table table-striped">
	<thead>
		<tr>
			<th>ID</th>
			<th>Name</th>
			<th>Signing Key</th>
			<th>Actions</th>
		</tr>
	</thead>
	<tbody>
		{#each devices as device}
			<tr>
				<td>{device.id}</td>
				<td><a href="/devices/{device.id}">{device.name}</a></td>
				<td>
					{#if device.signature_public_key}
						<span class="badge bg-success">Set</span>
					{:else}
						<span class="badge bg-secondary">Not set</span>
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
