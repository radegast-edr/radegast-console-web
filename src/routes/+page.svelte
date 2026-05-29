<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user } from '$lib/store.js';
	import { getStoredPrivateKey } from '$lib/crypto.js';
	import { goto } from '$app/navigation';

	let teams = $state([]);

	onMount(async () => {
		try {
			const me = await api.me();
			$user = me;
			teams = await api.listTeams();
		} catch (e) {
			goto('/login');
		}
	});
</script>

<h2>Dashboard</h2>

{#if $user && !getStoredPrivateKey()}
	<div class="alert alert-warning">
		<h5>Private Key Not Found</h5>
		<p class="mb-2">
			Your private key is not stored in this browser. You won't be able to decrypt logs until
			you restore it.
		</p>
		<a href="/keys/recovery" class="btn btn-warning btn-sm me-2">Recover with Recovery Key</a>
		<a href="/keys/transfer" class="btn btn-outline-secondary btn-sm"
			>Transfer from Another Browser</a
		>
	</div>
{/if}

<div class="row mt-4">
	<div class="col-md-4">
		<div class="card">
			<div class="card-body">
				<h5 class="card-title">Teams</h5>
				<p class="card-text">{teams.length} team(s)</p>
				<a href="/teams" class="btn btn-primary btn-sm">Manage Teams</a>
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card">
			<div class="card-body">
				<h5 class="card-title">Devices</h5>
				<p class="card-text">Manage your EDR devices</p>
				<a href="/devices" class="btn btn-primary btn-sm">Manage Devices</a>
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card">
			<div class="card-body">
				<h5 class="card-title">Packs</h5>
				<p class="card-text">Configuration packs</p>
				<a href="/packs" class="btn btn-primary btn-sm">Browse Packs</a>
			</div>
		</div>
	</div>
</div>
