<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let devices = $state([]);
	let showCreate = $state(false);
	let newDeviceName = $state('');
	let newDeviceToken = $state('');

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

	async function createDevice() {
		try {
			const result = await api.createDevice(newDeviceName);
			newDeviceToken = result.token;
			newDeviceName = '';
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
		onclick={() => {
			showCreate = true;
			newDeviceToken = '';
		}}>Add Device</button
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
				<td>{device.name}</td>
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
		<button type="submit" class="btn btn-primary">Create Device</button>
	</form>
</Modal>
