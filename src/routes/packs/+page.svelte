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

	// Edit Pack State
	let showEdit = $state(false);
	let editPackId = $state(null);
	let editPackName = $state('');
	let editPackDesc = $state('');

	// View Versions State
	let showVersions = $state(false);
	let versionsPackId = $state(null);
	let versionsPackName = $state('');
	let packVersions = $state([]);
	let loadingVersions = $state(false);

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

	function openEdit(pack) {
		editPackId = pack.id;
		editPackName = pack.name;
		editPackDesc = pack.description;
		showEdit = true;
	}

	async function savePack() {
		try {
			await api.updatePack(editPackId, editPackName, editPackDesc);
			showEdit = false;
			await loadPacks();
			showFlash('Pack updated');
		} catch (e) {
			showError(e.message);
		}
	}

	async function openVersions(pack) {
		versionsPackId = pack.id;
		versionsPackName = pack.name;
		packVersions = [];
		loadingVersions = true;
		showVersions = true;
		try {
			packVersions = await api.listVersions(pack.id);
		} catch (e) {
			showError(e.message);
		} finally {
			loadingVersions = false;
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
			<div class="card h-100">
				<div class="card-body d-flex flex-column">
					<h5 class="card-title fw-bold text-primary">{pack.name}</h5>
					<p class="card-text text-muted flex-grow-1">{pack.description || 'No description'}</p>
					<div class="mt-3 d-flex gap-2 flex-wrap">
						<button
							class="btn btn-sm btn-outline-info"
							onclick={() => openVersions(pack)}
						>
							Versions
						</button>
						{#if canCreate}
							<button
								class="btn btn-sm btn-outline-primary"
								onclick={() => openUpload(pack.id)}
							>
								Upload Version
							</button>
							<button
								class="btn btn-sm btn-outline-secondary"
								onclick={() => openEdit(pack)}
							>
								Edit Pack
							</button>
						{/if}
					</div>
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

<Modal show={showEdit} title="Edit Pack" onClose={() => (showEdit = false)}>
	<form onsubmit={(e) => { e.preventDefault(); savePack(); }}>
		<div class="mb-3">
			<label for="editPackName" class="form-label">Pack Name</label>
			<input type="text" class="form-control" id="editPackName" bind:value={editPackName} required />
		</div>
		<div class="mb-3">
			<label for="editPackDesc" class="form-label">Description</label>
			<textarea class="form-control" id="editPackDesc" bind:value={editPackDesc} rows="3"></textarea>
		</div>
		<button type="submit" class="btn btn-primary">Save Changes</button>
	</form>
</Modal>

<Modal show={showVersions} title="Pack Versions - {versionsPackName}" onClose={() => (showVersions = false)}>
	{#if loadingVersions}
		<p class="text-muted">Loading versions...</p>
	{:else if packVersions.length === 0}
		<p class="text-muted">No versions uploaded yet.</p>
	{:else}
		<div class="table-responsive">
			<table class="table table-sm align-middle mb-0">
				<thead>
					<tr>
						<th>Version</th>
						<th>Released</th>
					</tr>
				</thead>
				<tbody>
					{#each packVersions as v}
						<tr>
							<td class="fw-bold text-success">{v.version}</td>
							<td class="text-muted small">{new Date(v.released).toLocaleString()}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
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
