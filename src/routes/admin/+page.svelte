<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user, showFlash, showError } from '$lib/store.js';
	import { goto } from '$app/navigation';

	let users = $state([]);
	let devices = $state([]);
	let packs = $state([]);
	let activeTab = $state('users');

	onMount(async () => {
		if ($user?.role !== 'admin') {
			goto('/');
			return;
		}
		await loadAll();
	});

	async function loadAll() {
		try {
			users = await api.adminListUsers();
			devices = await api.adminListDevices();
			packs = await api.adminListPacks();
		} catch (e) {
			showError(e.message);
		}
	}

	async function deleteUser(id) {
		if (!confirm('Delete this user?')) return;
		try {
			await api.adminDeleteUser(id);
			await loadAll();
			showFlash('User deleted');
		} catch (e) {
			showError(e.message);
		}
	}

	async function deleteDevice(id) {
		if (!confirm('Delete this device?')) return;
		try {
			await api.adminDeleteDevice(id);
			await loadAll();
			showFlash('Device deleted');
		} catch (e) {
			showError(e.message);
		}
	}

	async function deletePack(id) {
		if (!confirm('Delete this pack and all its versions?')) return;
		try {
			await api.adminDeletePack(id);
			await loadAll();
			showFlash('Pack deleted');
		} catch (e) {
			showError(e.message);
		}
	}
</script>

<h2>Admin Panel</h2>

<ul class="nav nav-tabs mb-4">
	<li class="nav-item">
		<button class="nav-link" class:active={activeTab === 'users'} onclick={() => (activeTab = 'users')}>
			Users ({users.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link"
			class:active={activeTab === 'devices'}
			onclick={() => (activeTab = 'devices')}
		>
			Devices ({devices.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link"
			class:active={activeTab === 'packs'}
			onclick={() => (activeTab = 'packs')}
		>
			Packs ({packs.length})
		</button>
	</li>
</ul>

{#if activeTab === 'users'}
	<table class="table table-striped">
		<thead>
			<tr>
				<th>ID</th>
				<th>Email</th>
				<th>Role</th>
				<th>Verified</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each users as u}
				<tr>
					<td>{u.id}</td>
					<td>{u.email}</td>
					<td><span class="badge bg-secondary">{u.role}</span></td>
					<td>{u.verified ? '✓' : '✗'}</td>
					<td>
						<button
							class="btn btn-sm btn-outline-danger"
							onclick={() => deleteUser(u.id)}
							disabled={u.id === $user?.id}>Delete</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if activeTab === 'devices'}
	<table class="table table-striped">
		<thead>
			<tr>
				<th>ID</th>
				<th>Name</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each devices as d}
				<tr>
					<td>{d.id}</td>
					<td>
						<a href="/devices/{d.id}">{d.name}</a>
						{#if !d.signature_public_key}
							<span class="badge bg-danger ms-2" title="Unsigned device! Signing key is not set.">Unsigned</span>
						{/if}
					</td>
					<td>
						<button class="btn btn-sm btn-outline-danger" onclick={() => deleteDevice(d.id)}
							>Delete</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if activeTab === 'packs'}
	<table class="table table-striped">
		<thead>
			<tr>
				<th>ID</th>
				<th>Name</th>
				<th>Description</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each packs as p}
				<tr>
					<td>{p.id}</td>
					<td>{p.name}</td>
					<td>{p.description}</td>
					<td>
						<button class="btn btn-sm btn-outline-danger" onclick={() => deletePack(p.id)}
							>Delete</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
