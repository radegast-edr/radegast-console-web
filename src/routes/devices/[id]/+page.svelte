<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { api, type DeviceDetail, type Group } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import { isDeviceActive, formatFullDateTime } from '$lib/utils';
	import AgentSetupInstructions from '$lib/components/AgentSetupInstructions.svelte';

	let device = $state<DeviceDetail | null>(null);
	let allGroups = $state<Group[]>([]);
	let addGroupId = $state('');
	let newDeviceToken = $state('');

	// inline rename
	let editingName = $state(false);
	let editName = $state('');

	$effect(() => {
		loadDevice($page.params.id ?? '');
	});

	async function loadDevice(id: string | number): Promise<void> {
		try {
			const [deviceData, groupsData] = await Promise.all([
				api.getDevice(Number(id)),
				api.listGroups()
			]);
			device = deviceData;
			allGroups = groupsData;
			const deviceGroupIds = new Set((device?.groups || []).map((g: { id: number }) => g.id));
			allGroups = allGroups.filter((g) => !deviceGroupIds.has(g.id));
			addGroupId = allGroups.length > 0 ? String(allGroups[0].id) : '';
		} catch (e) {
			showError((e as Error).message);
		}
	}

	function startRename(): void {
		if (device) {
			editName = device.name;
			editingName = true;
		}
	}

	async function saveName(): Promise<void> {
		if (!device) return;
		try {
			await api.renameDevice(Number(device.id), editName);
			editingName = false;
			await loadDevice(device.id);
			showFlash('Device renamed');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function removeFromGroup(groupId: string | number): Promise<void> {
		if (!device) return;
		try {
			await api.removeDeviceFromGroupViaGroup(Number(groupId), Number(device.id));
			showFlash('Removed from group');
			await loadDevice(device.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function addToGroup(): Promise<void> {
		if (!addGroupId || !device) return;
		try {
			await api.addDeviceToGroupViaGroup(Number(addGroupId), Number(device.id));
			showFlash('Added to group');
			await loadDevice(device.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function confirmReinstall(): Promise<void> {
		if (!device) return;
		const msg = 'Are you sure you want to reinstall this device? The token will be changed, but the signing key cannot be changed and must be backed-up manually if moving to another device.';
		if (!await askConfirm(msg)) return;
		try {
			const res = await api.reinstallDevice(Number(device.id));
			newDeviceToken = res.token;
			showFlash('Device token reset. Please follow the instructions to install the agent.');
		} catch (e) {
			showError((e as Error).message);
		}
	}
</script>

<svelte:head>
	<title>{device?.name ?? 'Device'} - Radegast</title>
</svelte:head>

{#if device}
	<div class="mb-4">
		<div class="d-flex justify-content-between align-items-center mb-2">
			<a href="{base}/devices" class="btn btn-outline-secondary btn-sm">← Back to Devices</a>
			<button class="btn btn-warning btn-sm" onclick={confirmReinstall}>Reinstall Device</button>
		</div>
		<div class="d-flex align-items-center gap-2 mt-1">
			{#if editingName}
				<input class="form-control form-control-lg w-auto" bind:value={editName} />
				<button class="btn btn-success btn-sm" onclick={saveName}>Save</button>
				<button class="btn btn-outline-secondary btn-sm" onclick={() => (editingName = false)}>Cancel</button>
			{:else}
				<h2 class="mb-0">{device.name}</h2>
				<button class="btn btn-outline-secondary btn-sm" onclick={startRename} title="Rename device">✎</button>
			{/if}
		</div>
		<p class="text-muted mt-1">
			Status:
			{#if isDeviceActive(device.last_seen)}
				<span class="badge bg-success">Online</span>
			{:else}
				<span class="badge bg-secondary">Offline</span>
				<span class="small ms-2">Last seen: {formatFullDateTime(device.last_seen)}</span>
			{/if}
			<span class="mx-2">|</span>
			Signing key:
			{#if device.signature_public_key}
				<span class="badge bg-success">Set</span>
			{:else}
				<span class="badge bg-secondary">Not set</span>
			{/if}
			<span class="mx-2">|</span>
			Agent: <span class="badge bg-info text-dark">{device.agent_version ?? 'N/A'}</span>
			<span class="mx-2">|</span>
			Rustinel: <span class="badge bg-info text-dark">{device.rustinel_version ?? 'N/A'}</span>
			<span class="mx-2">|</span>
			OS: <span class="badge bg-info text-dark">{device.os ?? 'N/A'}</span>
		</p>
	</div>

	<AgentSetupInstructions
		token={newDeviceToken}
		deviceName={device.name}
		isReinstall={true}
		onDismiss={() => (newDeviceToken = '')}
	/>

	<div class="card mb-4">
		<div class="card-header"><h5 class="mb-0">Device Groups</h5></div>
		<div class="card-body">
			{#if (device.groups ?? []).length === 0}
				<p class="text-muted">This device is not in any group.</p>
			{:else}
				<table class="table table-sm mb-3">
					<thead>
						<tr>
							<th>Group</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each device.groups as group}
							<tr>
								<td><a href="{base}/groups/{group.id}">{group.name}</a></td>
								<td>
									<button
										class="btn btn-sm btn-outline-danger"
										onclick={() => removeFromGroup(group.id)}>Remove</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="d-flex gap-2 align-items-center">
				{#if allGroups.length > 0}
					<select class="form-select form-select-sm" bind:value={addGroupId}>
						{#each allGroups as g}
							<option value={String(g.id)}>{g.name}</option>
						{/each}
					</select>
					<button class="btn btn-sm btn-primary" onclick={addToGroup}>Add to Group</button>
				{:else}
					<span class="text-muted small">This device is already in all available groups.</span>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<p>Loading…</p>
{/if}
