<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type UserInfo, type Device, type Pack } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import { goto } from '$app/navigation';

	let users = $state<UserInfo[]>([]);
	let devices = $state<Device[]>([]);
	let packs = $state<Pack[]>([]);
	let activeTab = $state<'users' | 'devices' | 'packs'>('users');
	let resetPasswordResult = $state<{ email: string } | null>(null);

	onMount(async () => {
		if ($user?.role !== 'admin') {
			goto(`${base}/`);
			return;
		}
		await loadAll();
	});

	async function loadAll(): Promise<void> {
		try {
			const [usersData, devicesData, packsData] = await Promise.all([
				api.adminListUsers(),
				api.adminListDevices(),
				api.adminListPacks()
			]);
			users = usersData;
			devices = devicesData;
			packs = packsData;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deleteUser(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this user?')) return;
		try {
			await api.adminDeleteUser(Number(id));
			await loadAll();
			showFlash('User deleted');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function resetUserPassword(u: UserInfo): Promise<void> {
		if (!await askConfirm(`Are you sure you want to reset the password and clear all MFA devices for user ${u.email}?`)) return;
		try {
			await api.adminResetUserPassword(Number(u.id));
			resetPasswordResult = { email: u.email };
			showFlash('User password reset successfully and MFA cleared');
			await loadAll();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deleteDevice(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this device?')) return;
		try {
			await api.adminDeleteDevice(Number(id));
			await loadAll();
			showFlash('Device deleted');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deletePack(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this pack and all its versions?')) return;
		try {
			await api.adminDeletePack(Number(id));
			await loadAll();
			showFlash('Pack deleted');
		} catch (e) {
			showError((e as Error).message);
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
	{#if resetPasswordResult}
		<div class="alert alert-success alert-dismissible fade show shadow-sm border-0 mb-4" role="alert" style="border-radius: 12px; padding: 1.25rem;">
			<h6 class="fw-bold mb-1">🔑 Password Reset Successful</h6>
			<p class="mb-0 small text-dark-emphasis">
				The password for <strong>{resetPasswordResult.email}</strong> has been reset. The user was emailed the new password.
			</p>
			<button type="button" class="btn-close" onclick={() => (resetPasswordResult = null)} aria-label="Close"></button>
		</div>
	{/if}

	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>ID</th>
				<th>Email</th>
				<th>Role</th>
				<th>Verified</th>
				<th>Configured MFA</th>
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
						{#if u.mfa_configured_level === 'hardware_token'}
							<span class="badge bg-success">Hardware token</span>
						{:else if u.mfa_configured_level === 'otp'}
							<span class="badge bg-primary">OTP</span>
						{:else}
							<span class="badge bg-light text-dark">None</span>
						{/if}
						{#if u.mfa_setup_missing}
							<span class="badge bg-danger ms-1" title="Missing required setup">Setup Missing</span>
						{/if}
					</td>
					<td>
						<button
							class="btn btn-sm btn-outline-warning me-2"
							onclick={() => resetUserPassword(u)}
							disabled={u.id === $user?.id}>Reset Password & MFA</button
						>
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
	<table class="table table-hover align-middle">
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
						<a href="{base}/devices/{d.id}">{d.name}</a>
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
	<table class="table table-hover align-middle">
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
					<td>
						{p.name}
						{#if p.team_ids && p.team_ids.length > 0}
							<span class="badge bg-secondary ms-2" style="font-size: 0.7rem;">Private</span>
						{:else}
							<span class="badge bg-success ms-2" style="font-size: 0.7rem;">Global</span>
						{/if}
					</td>
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
