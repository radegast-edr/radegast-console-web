<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user, showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let packs = $state([]);
	let showCreate = $state(false);
	let newPackName = $state('');
	let newPackDesc = $state('');
	let showUpload = $state(false);
	let uploadPackId = $state(null);
	let uploadVersion = $state('');
	let uploadFile = $state(null);

	let canCreate = $derived($user && ($user.role === 'maintainer' || $user.role === 'admin'));

	onMount(async () => {
		await loadPacks();
	});

	async function loadPacks() {
		try {
			packs = await api.listPacks();
		} catch (e) {
			showError(e.message);
		}
	}

	async function createPack() {
		try {
			await api.createPack(newPackName, newPackDesc);
			showCreate = false;
			newPackName = '';
			newPackDesc = '';
			await loadPacks();
			showFlash('Pack created');
		} catch (e) {
			showError(e.message);
		}
	}

	function openUpload(packId) {
		uploadPackId = packId;
		uploadVersion = '';
		uploadFile = null;
		showUpload = true;
	}

	async function uploadPackVersion() {
		if (!uploadFile) {
			showError('Please select a file');
			return;
		}
		try {
			await api.uploadVersion(uploadPackId, uploadVersion, uploadFile);
			showUpload = false;
			showFlash('Version uploaded');
			await loadPacks();
		} catch (e) {
			showError(e.message);
		}
	}
</script>

<svelte:head>
	<title>Packs - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2>Packs</h2>
	{#if canCreate}
		<button class="btn btn-primary" onclick={() => (showCreate = true)}>Create Pack</button>
	{/if}
</div>

<div class="row">
	{#each packs as pack}
		<div class="col-md-6 col-lg-4 mb-3">
			<div class="card">
				<div class="card-body">
					<h5 class="card-title">{pack.name}</h5>
					<p class="card-text">{pack.description || 'No description'}</p>
					{#if canCreate}
						<button
							class="btn btn-sm btn-outline-primary"
							onclick={() => openUpload(pack.id)}
						>
							Upload Version
						</button>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<p class="text-muted">No packs available.</p>
	{/each}
</div>

<Modal show={showCreate} title="Create Pack" onClose={() => (showCreate = false)}>
	<form onsubmit={(e) => { e.preventDefault(); createPack(); }}>
		<div class="mb-3">
			<label for="packName" class="form-label">Pack Name</label>
			<input type="text" class="form-control" id="packName" bind:value={newPackName} required />
		</div>
		<div class="mb-3">
			<label for="packDesc" class="form-label">Description</label>
			<textarea class="form-control" id="packDesc" bind:value={newPackDesc} rows="3"></textarea>
		</div>
		<button type="submit" class="btn btn-primary">Create</button>
	</form>
</Modal>

<Modal show={showUpload} title="Upload Version" onClose={() => (showUpload = false)}>
	<form onsubmit={(e) => { e.preventDefault(); uploadPackVersion(); }}>
		<div class="mb-3">
			<label for="version" class="form-label">Version</label>
			<input
				type="text"
				class="form-control"
				id="version"
				bind:value={uploadVersion}
				placeholder="1.0.0"
				required
			/>
		</div>
		<div class="mb-3">
			<label for="file" class="form-label">Zip File</label>
			<input
				type="file"
				class="form-control"
				id="file"
				accept=".zip"
				onchange={(e) => (uploadFile = e.target.files[0])}
				required
			/>
		</div>
		<button type="submit" class="btn btn-primary">Upload</button>
	</form>
</Modal>
