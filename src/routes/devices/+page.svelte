<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type Device, type Team, type Group } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';
	import { isDeviceActive, formatFullDateTime } from '$lib/utils';
	import AgentSetupInstructions from '$lib/components/AgentSetupInstructions.svelte';

	let devices = $state<Device[]>([]);
	let showCreate = $state(false);
	let newDeviceName = $state('');
	let newDeviceToken = $state('');
	let newDeviceGroupId = $state('');
	let availableGroups = $state<Array<{id: number, teamName: string, name: string}>>([]);

	onMount(async () => {
		await loadDevices();
	});

	async function loadDevices(): Promise<void> {
		try {
			const data = await api.listDevices();
			devices = data;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function openCreateModal(): Promise<void> {
		newDeviceToken = '';
		newDeviceName = '';
		newDeviceGroupId = '';
		availableGroups = [];

		try {
			const teams = await api.listTeams();
			const grouped = await Promise.all(
				teams.map(async (team) => {
					const groups = await api.listTeamGroups(Number(team.id));
					return groups.map((g) => ({ id: g.id, teamName: team.name, name: g.name }));
				})
			);
			availableGroups = grouped.flat();
			if (availableGroups.length > 0) newDeviceGroupId = String(availableGroups[0].id);
		} catch (e) {
			showError('Failed to load groups: ' + (e as Error).message);
		}

		showCreate = true;
	}

	async function createDevice(): Promise<void> {
		if (!newDeviceGroupId) { showError('Please select a device group.'); return; }
		try {
			const result = await api.createDevice(newDeviceName, Number(newDeviceGroupId));
			newDeviceToken = result.token;
			newDeviceName = '';
			showCreate = false;
			await loadDevices();
			showFlash('Device created! Save the token shown below.');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deleteDevice(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this device?')) return;
		try {
			await api.deleteDevice(Number(id));
			await loadDevices();
			showFlash('Device deleted');
		} catch (e) {
			showError((e as Error).message);
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

<AgentSetupInstructions
	token={newDeviceToken}
	deviceName={newDeviceName}
	onDismiss={() => (newDeviceToken = '')}
/>

<table class="table table-hover align-middle">
	<thead>
		<tr>
			<th>Name</th>
			<th>Status</th>
			<th>Agent Version</th>
			<th>Rustinel Version</th>
			<th>Actions</th>
		</tr>
	</thead>
	<tbody>
		{#each devices as device}
			<tr>
				<td>
					<a href="{base}/devices/{device.id}">{device.name}</a>
					{#if !device.signature_public_key}
						<span class="badge bg-danger ms-2" title="Unsigned device! Signing key is not set.">Unsigned</span>
					{/if}
				</td>
				<td>
					{#if isDeviceActive(device.last_seen)}
						<span class="badge bg-success">Online</span>
					{:else}
						<span class="badge bg-secondary">Offline</span>
						{#if device.last_seen}
							<span class="small ms-2">Last seen: {formatFullDateTime(device.last_seen)}</span>
						{/if}
					{/if}
				</td>
				<td>{device.agent_version ?? 'N/A'}</td>
				<td>{device.rustinel_version ?? 'N/A'}</td>
				<td>
					<button
						class="btn btn-sm btn-outline-danger"
						onclick={() => deleteDevice(device.id)}>Delete</button
					>
				</td>
			</tr>
		{:else}
			<tr><td colspan="5" class="text-muted">No devices found</td></tr>
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
