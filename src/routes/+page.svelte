<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user } from '$lib/store.js';
	import { getStoredPrivateKey } from '$lib/crypto.js';
	import { goto } from '$app/navigation';

	let teams = $state([]);
	let groups = $state([]);
	let devices = $state([]);
	let hasPrivateKey = $state(true); // default true to avoid flash
	let unreadCount = $state(0);

	onMount(async () => {
		try {
			const me = await api.me();
			$user = me;
			const [teamsRes, groupsRes, devicesRes, unreadRes] = await Promise.all([
				api.listTeams(),
				api.listGroups(),
				api.listDevices(),
				api.getUnreadLogsCount()
			]);
			teams = teamsRes;
			groups = groupsRes;
			devices = devicesRes;
			unreadCount = unreadRes.unread_count;
			hasPrivateKey = !!(await getStoredPrivateKey(me.id));
		} catch (e) {
			goto(`${base}/login`);
		}

		const interval = setInterval(refreshUnreadCount, 60000);
		return () => clearInterval(interval);
	});

	async function refreshUnreadCount() {
		try {
			const unreadRes = await api.getUnreadLogsCount();
			unreadCount = unreadRes.unread_count;
		} catch (e) {
			console.error("Failed to auto-refresh unread alerts:", e);
		}
	}
</script>

<svelte:head>
	<title>Dashboard - Radegast</title>
</svelte:head>

<h2>Dashboard</h2>

{#if $user && !hasPrivateKey}
	<div class="alert alert-warning">
		<h5>Private Key Not Found</h5>
		<p class="mb-2">
			Your private key is not stored in this browser. You won't be able to decrypt logs until
			you restore it.
		</p>
		<a href="{base}/keys/recovery" class="btn btn-warning btn-sm me-2">Recover with Recovery Key</a>
		<a href="{base}/keys/transfer" class="btn btn-outline-secondary btn-sm"
			>Transfer from Another Browser</a
		>
	</div>
{/if}

<div class="row mt-4 g-3">
	<div class="col-md-4">
		<div class="card h-100">
			<div class="card-body">
				<h5 class="card-title">Teams</h5>
				<p class="card-text text-muted">{teams.length} team(s)</p>
				<ul class="list-unstyled mb-3">
					{#each teams.slice(0, 5) as t}
						<li><a href="{base}/teams/{t.id}">{t.name}</a></li>
					{/each}
				</ul>
				<a href="{base}/teams" class="btn btn-primary btn-sm">Manage Teams</a>
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card h-100">
			<div class="card-body">
				<h5 class="card-title">Device Groups</h5>
				<p class="card-text text-muted">{groups.length} group(s)</p>
				<ul class="list-unstyled mb-3">
					{#each groups.slice(0, 5) as g}
						<li><a href="{base}/groups/{g.id}">{g.name}</a></li>
					{/each}
				</ul>
				<a href="{base}/groups" class="btn btn-primary btn-sm">Manage Groups</a>
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card h-100">
			<div class="card-body">
				<h5 class="card-title">Devices</h5>
				<p class="card-text text-muted">{devices.length} device(s)</p>
				<ul class="list-unstyled mb-3">
					{#each devices.slice(0, 5) as d}
						<li><a href="{base}/devices/{d.id}">{d.name}</a></li>
					{/each}
				</ul>
				<a href="{base}/devices" class="btn btn-primary btn-sm">Manage Devices</a>
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card h-100">
			<div class="card-body">
				<h5 class="card-title">Packs</h5>
				<p class="card-text text-muted">Configuration packs</p>
				<a href="{base}/packs" class="btn btn-primary btn-sm">Browse Packs</a>
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card h-100 border-{unreadCount > 0 ? 'danger' : 'primary'} shadow-sm">
			<div class="card-body">
				<h5 class="card-title text-{unreadCount > 0 ? 'danger' : 'primary'} fw-bold d-flex align-items-center justify-content-between">
					<span>Alerts</span>
					{#if unreadCount > 0}
						<span class="badge bg-danger">{unreadCount} unread</span>
					{:else}
						<span class="badge bg-primary">0 unread</span>
					{/if}
				</h5>
				<p class="card-text text-muted">
					{#if unreadCount > 0}
						You have <strong>{unreadCount}</strong> unread alert(s) requiring attention.
					{:else}
						All alerts have been reviewed.
					{/if}
				</p>
				<a href="{base}/alerts" class="btn btn-{unreadCount > 0 ? 'danger' : 'primary'} btn-sm">View Alerts</a>
			</div>
		</div>
	</div>
</div>
