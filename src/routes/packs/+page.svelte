<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type Pack, type Team, type PackVersion } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';

	let packs = $state<Pack[]>([]);
	let teams = $state<Team[]>([]);
	let showCreate = $state(false);
	let newPackName = $state('');
	let newPackDesc = $state('');
	let newPackTeamIds = $state<number[]>([]);
	let showUpload = $state(false);
	let uploadPackId = $state<number | null>(null);
	let uploadVersion = $state('');
	let uploadReleaseNotes = $state('');
	let uploadFile = $state<File | null>(null);

	// Edit Pack State
	let showEdit = $state(false);
	let editPackId = $state<number | null>(null);
	let editPackName = $state('');
	let editPackDesc = $state('');
	let editPackTeamIds = $state<number[]>([]);

	// View Versions State
	let showVersions = $state(false);
	let versionsPackId = $state<number | null>(null);
	let versionsPackName = $state('');
	let packVersions = $state<PackVersion[]>([]);
	let loadingVersions = $state(false);

	let canCreate = $derived(
		$user && (
			$user.role === 'maintainer' ||
			$user.role === 'admin' ||
			teams.some((t) => t.permission_pack === 'write')
		)
	);

	onMount(async () => {
		await Promise.all([loadPacks(), loadTeams()]);
	});

	async function loadPacks(): Promise<void> {
		try {
			packs = await api.listPacks();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function loadTeams(): Promise<void> {
		try {
			teams = await api.listTeams();
		} catch (e) {
			console.error(e);
		}
	}

	function canManagePack(pack: Pack): boolean {
		if (!$user) return false;
		if ($user.role === 'admin' || $user.role === 'maintainer') return true;
		if (pack.creator_id === $user.id) return true;
		if (pack.team_ids && pack.team_ids.length > 0) {
			return teams.some((t) => pack.team_ids?.includes(t.id) && t.permission_pack === 'write');
		}
		return false;
	}

	async function createPack(): Promise<void> {
		if ($user && $user.role !== 'admin' && $user.role !== 'maintainer' && newPackTeamIds.length === 0) {
			showError('You do not have permission to create Global packs. You must select at least one team to create a private pack.');
			return;
		}
		try {
			await api.createPack(newPackName, newPackDesc, newPackTeamIds.length > 0 ? newPackTeamIds : null);
			showCreate = false;
			newPackName = '';
			newPackDesc = '';
			newPackTeamIds = [];
			await loadPacks();
			showFlash('Pack created');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	function openEdit(pack: Pack): void {
		editPackId = pack.id;
		editPackName = pack.name;
		editPackDesc = pack.description;
		editPackTeamIds = pack.team_ids || [];
		showEdit = true;
	}

	async function savePack(): Promise<void> {
		if (editPackId === null) return;
		if ($user && $user.role !== 'admin' && $user.role !== 'maintainer' && editPackTeamIds.length === 0) {
			showError('You must select at least one team for this private pack.');
			return;
		}
		try {
			await api.updatePack(editPackId, editPackName, editPackDesc, editPackTeamIds);
			showEdit = false;
			await loadPacks();
			showFlash('Pack updated');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function openVersions(pack: Pack): Promise<void> {
		versionsPackId = pack.id;
		versionsPackName = pack.name;
		packVersions = [];
		loadingVersions = true;
		showVersions = true;
		try {
			packVersions = await api.listVersions(pack.id);
		} catch (e) {
			showError((e as Error).message);
		} finally {
			loadingVersions = false;
		}
	}

	function openUpload(packId: string | number): void {
		uploadPackId = Number(packId);
		uploadVersion = '';
		uploadReleaseNotes = '';
		uploadFile = null;
		showUpload = true;
	}

	async function uploadPackVersion(): Promise<void> {
		if (!uploadFile || uploadPackId === null) {
			showError('Please select a file');
			return;
		}
		try {
			await api.uploadVersion(uploadPackId, uploadVersion, uploadFile, uploadReleaseNotes);
			showUpload = false;
			showFlash('Version uploaded');
			await loadPacks();
		} catch (e) {
			showError((e as Error).message);
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
			<div class="card h-100 shadow-sm">
				<div class="card-body d-flex flex-column">
					<h5 class="card-title fw-bold text-primary d-flex align-items-center justify-content-between gap-2">
						<a href="{base}/packs/{pack.id}" class="text-decoration-none text-truncate">{pack.name}</a>
						{#if pack.team_ids && pack.team_ids.length > 0}
							<span class="badge bg-secondary" style="font-size: 0.7rem;">Private</span>
						{:else}
							<span class="badge bg-success" style="font-size: 0.7rem;">Global</span>
						{/if}
					</h5>
					<div class="mt-2 mb-2 d-flex gap-2 flex-wrap pack-tags">
						{#if pack.latest?.meta?.os}
							<span class="badge rounded-pill bg-secondary os-{pack.latest.meta.os}"
							>
								OS: {pack.latest.meta.os}
							</span>
						{/if}
						{#if pack.latest?.meta?.status}
							<span class="badge rounded-pill bg-secondary status-{pack.latest.meta.status}">
								Status: {pack.latest.meta.status}
							</span>
						{/if}
						{#if pack.latest?.meta?.expected_false_positive_level}
							<span class="badge rounded-pill bg-secondary fp-{pack.latest.meta.expected_false_positive_level}">
								FP: {pack.latest.meta.expected_false_positive_level}
							</span>
						{/if}
					</div>
					<p class="card-text text-muted flex-grow-1">
						{#if pack.description || pack.latest?.meta?.description}
							{pack.description || ''}
							{#if pack.description && pack.latest?.meta?.description}
								<br>
							{/if}
							{pack.latest?.meta?.description || ''}
						{:else}
							<i>No description provided.</i>
						{/if}
					</p>
					<div class="mt-3 d-flex gap-2 flex-wrap">
						<button
							class="btn btn-sm btn-outline-info"
							onclick={() => openVersions(pack)}
						>
							Versions
						</button>
						{#if canManagePack(pack)}
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
			<label for="packName" class="form-label fw-semibold">Pack Name</label>
			<input type="text" class="form-control" id="packName" bind:value={newPackName} required />
		</div>
		<div class="mb-3">
			<label for="packDesc" class="form-label fw-semibold">Description</label>
			<textarea class="form-control" id="packDesc" bind:value={newPackDesc} rows="3"></textarea>
		</div>
		<div class="mb-3">
			<span class="d-block fw-semibold mb-1">Team Access (Private Pack)</span>
			<p class="text-muted small mb-2">
				{#if $user && ($user.role === 'admin' || $user.role === 'maintainer')}
					Select one or more teams to make this pack private, or leave all unselected to keep it public.
				{:else}
					Select one or more teams that you want to associate this private pack with.
				{/if}
			</p>
			<div class="team-access-list d-flex flex-column gap-2 mb-3 border rounded p-3 bg-body-tertiary" style="max-height: 250px; overflow-y: auto;">
				{#each teams as team}
					{#if $user && ($user.role === 'admin' || $user.role === 'maintainer' || team.permission_pack === 'write')}
						{@const isSelected = newPackTeamIds.includes(team.id)}
						<label 
							class="team-access-item d-flex align-items-center justify-content-between p-2.5 rounded-3 border transition-all {isSelected ? 'border-primary bg-primary-subtle bg-opacity-25' : 'border-light-subtle bg-body'}"
							style="cursor: pointer;"
						>
							<div class="d-flex align-items-center gap-2">
								<input
									class="form-check-input m-0"
									type="checkbox"
									id="team-check-new-{team.id}"
									value={team.id}
									checked={isSelected}
									onchange={(e) => {
										const target = e.target as HTMLInputElement;
										if (target.checked) {
											newPackTeamIds = [...newPackTeamIds, team.id];
										} else {
											newPackTeamIds = newPackTeamIds.filter((id) => id !== team.id);
										}
									}}
								/>
								<span class="fw-semibold text-body small">{team.name}</span>
							</div>
							{#if team.permission_pack === 'write'}
								<span class="badge bg-success-subtle text-success small border border-success-subtle px-2 py-0.5" style="font-size: 0.75rem;">Write</span>
							{:else if team.permission_pack === 'read'}
								<span class="badge bg-info-subtle text-info small border border-info-subtle px-2 py-0.5" style="font-size: 0.75rem;">Read</span>
							{/if}
						</label>
					{/if}
				{:else}
					<p class="text-muted mb-0 small text-center py-3">No teams available.</p>
				{/each}
			</div>
		</div>
		<button type="submit" class="btn btn-primary w-100">Create</button>
	</form>
</Modal>

<Modal show={showEdit} title="Edit Pack" onClose={() => (showEdit = false)}>
	<form onsubmit={(e) => { e.preventDefault(); savePack(); }}>
		<div class="mb-3">
			<label for="editPackName" class="form-label fw-semibold">Pack Name</label>
			<input type="text" class="form-control" id="editPackName" bind:value={editPackName} required />
		</div>
		<div class="mb-3">
			<label for="editPackDesc" class="form-label fw-semibold">Description</label>
			<textarea class="form-control" id="editPackDesc" bind:value={editPackDesc} rows="3"></textarea>
		</div>
		<div class="mb-3">
			<span class="d-block fw-semibold mb-1">Team Access (Private Pack)</span>
			<p class="text-muted small mb-2">
				{#if $user && ($user.role === 'admin' || $user.role === 'maintainer')}
					Select one or more teams to make this pack private, or leave all unselected to keep it public.
				{:else}
					Select one or more teams that you want to associate this private pack with.
				{/if}
			</p>
			<div class="team-access-list d-flex flex-column gap-2 mb-3 border rounded p-3 bg-body-tertiary" style="max-height: 250px; overflow-y: auto;">
				{#each teams as team}
					{#if $user && ($user.role === 'admin' || $user.role === 'maintainer' || team.permission_pack === 'write')}
						{@const isSelected = editPackTeamIds.includes(team.id)}
						<label 
							class="team-access-item d-flex align-items-center justify-content-between p-2.5 rounded-3 border transition-all {isSelected ? 'border-primary bg-primary-subtle bg-opacity-25' : 'border-light-subtle bg-body'}"
							style="cursor: pointer;"
						>
							<div class="d-flex align-items-center gap-2">
								<input
									class="form-check-input m-0"
									type="checkbox"
									id="team-check-edit-{team.id}"
									value={team.id}
									checked={isSelected}
									onchange={(e) => {
										const target = e.target as HTMLInputElement;
										if (target.checked) {
											editPackTeamIds = [...editPackTeamIds, team.id];
										} else {
											editPackTeamIds = editPackTeamIds.filter((id) => id !== team.id);
										}
									}}
								/>
								<span class="fw-semibold text-body small">{team.name}</span>
							</div>
							{#if team.permission_pack === 'write'}
								<span class="badge bg-success-subtle text-success small border border-success-subtle px-2 py-0.5" style="font-size: 0.75rem;">Write</span>
							{:else if team.permission_pack === 'read'}
								<span class="badge bg-info-subtle text-info small border border-info-subtle px-2 py-0.5" style="font-size: 0.75rem;">Read</span>
							{/if}
						</label>
					{/if}
				{:else}
					<p class="text-muted mb-0 small text-center py-3">No teams available.</p>
				{/each}
			</div>
		</div>
		<button type="submit" class="btn btn-primary w-100">Save Changes</button>
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
							<td class="fw-bold text-success">
								{v.version}
								{#if v.release_notes}
									<div class="fw-normal text-muted small mt-1" style="white-space: pre-wrap;">{v.release_notes}</div>
								{/if}
							</td>
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
				onchange={(e) => {
					const target = e.target as HTMLInputElement;
					if (target && target.files) {
						uploadFile = target.files[0];
					}
				}}
				required
			/>
		</div>
		<div class="mb-3">
			<label for="releaseNotes" class="form-label">Release Notes (Optional)</label>
			<textarea
				class="form-control"
				id="releaseNotes"
				bind:value={uploadReleaseNotes}
				rows="3"
				placeholder="Add release notes for this version..."
			></textarea>
		</div>
		<button type="submit" class="btn btn-primary">Upload</button>
	</form>
</Modal>

<!--suppress CssUnusedSymbol -->
<style>
	.pack-tags {
		.os-windows {
			background: #0a58ca !important;
		}
		.os-linux {
			background: #0f5132 !important;
		}
		.os-macos {
			background: #f44336 !important;
		}
		.status-experimental {
			background: var(--bs-danger) !important;
		}
		.status-stable {
			background: var(--bs-success) !important;
		}
		.fp-low {
			background: var(--bs-success) !important;
		}
		.fp-medium {
			background: var(--bs-warning) !important;
		}
		.fp-high {
			background: var(--bs-danger) !important;
		}
	}

	.team-access-item {
		transition: all 0.2s ease-in-out;
	}
	.team-access-item:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
	}
	.team-access-list::-webkit-scrollbar {
		width: 6px;
	}
	.team-access-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.team-access-list::-webkit-scrollbar-thumb {
		background-color: rgba(0, 0, 0, 0.1);
		border-radius: 3px;
	}
	.team-access-list::-webkit-scrollbar-thumb:hover {
		background-color: rgba(0, 0, 0, 0.2);
	}
</style>
