<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user, showFlash, showError } from '$lib/store.js';
	import { getStoredPrivateKey } from '$lib/crypto.js';
	import { goto } from '$app/navigation';

	let teams = $state([]);
	let showKeySetup = $state(false);
	let recoveryKey = $state('');
	let keySetupDone = $state(false);

	onMount(async () => {
		try {
			const me = await api.me();
			$user = me;
			teams = await api.listTeams();

			if (!getStoredPrivateKey()) {
				showKeySetup = true;
			}
		} catch (e) {
			goto('/login');
		}
	});

	async function setupKeys() {
		try {
			const result = await api.setupKeys();
			recoveryKey = result.recovery_key;
			keySetupDone = true;
			showFlash('Keys set up successfully! Save your recovery key!');
		} catch (e) {
			if (e.message.includes('already set up')) {
				showKeySetup = false;
			} else {
				showError(e.message);
			}
		}
	}
</script>

<h2>Dashboard</h2>

{#if showKeySetup && !keySetupDone}
	<div class="alert alert-warning">
		<h5>Key Setup Required</h5>
		<p>You need to set up your encryption keys. This is required for viewing encrypted logs.</p>
		<button class="btn btn-warning" onclick={setupKeys}>Set Up Keys</button>
	</div>
{/if}

{#if keySetupDone}
	<div class="alert alert-danger">
		<h5>Save Your Recovery Key!</h5>
		<p>This is the only time you'll see this key. Store it securely:</p>
		<code class="d-block p-2 bg-dark text-light rounded">{recoveryKey}</code>
		<p class="mt-2 mb-0">
			If you lose your private key, you'll need this to recover your account.
		</p>
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
