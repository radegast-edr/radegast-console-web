<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { api, type Pack, type Team, type PackVersion } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';

	interface GroupState {
		groupId: number;
		groupName: string;
		hasWrite: boolean;
		checked: boolean;
		initialChecked: boolean;
		enabledId: number | null;
		packVersionId: string;
		initialPackVersionId: string;
		autoupdate: boolean;
		initialAutoupdate: boolean;
	}

	let pack = $state<Pack | null>(null);
	let versions = $state<PackVersion[]>([]);
	let loading = $state(true);

	// Pack Edit State
	let editName = $state('');
	let editDesc = $state('');
	let savingPack = $state(false);

	// Upload Version State
	let showUpload = $state(false);
	let uploadVersion = $state('');
	let uploadReleaseNotes = $state('');
	let uploadFile = $state<File | null>(null);
	let uploading = $state(false);

	// Group Access State
	let groupStates = $state<GroupState[]>([]);
	let savingAccess = $state(false);

	let teams = $state<Team[]>([]);
	let editTeamIds = $state<number[]>([]);

	let canManage = $derived.by(() => {
		const p = pack;
		if (!p || !$user) return false;
		if ($user.role === 'maintainer' || $user.role === 'admin') return true;
		if (p.creator_id === $user.id) return true;
		if (p.team_ids && p.team_ids.length > 0) {
			const ids = p.team_ids;
			return teams.some((t) => ids.includes(t.id) && t.permission_pack === 'write');
		}
		return false;
	});

	// Load data when packId changes
	const packIdParam = $derived(Number(page.params.id));
	$effect(() => {
		packIdParam;
		loadAll();
	});

	async function loadAll(): Promise<void> {
		loading = true;
		const id = Number(page.params.id);
		try {
			const [packRes, versionsRes, teamsRes, groupsRes] = await Promise.all([
				api.getPack(id),
				api.listVersions(id),
				api.listTeams(),
				api.listGroups()
			]);

			pack = packRes;
			versions = versionsRes;
			teams = teamsRes;
			editName = packRes.name;
			editDesc = packRes.description;
			editTeamIds = packRes.team_ids || [];

			const userTeamIds = new Set(teamsRes.map((t: any) => t.id));

			// Load details and enabled state for all visible groups
			const groupDataList = await Promise.all(
				groupsRes.map(async (g: any) => {
					const [detail, enabled] = await Promise.all([
						api.getGroup(g.id),
						api.listEnabledPacks(g.id)
					]);
					return {
						id: g.id,
						name: g.name,
						detail,
						enabledPacks: enabled
					};
				})
			);

			groupStates = groupDataList.map((item) => {
				const enabledPack = item.enabledPacks.find((pe) => pe.pack_name === packRes.name);
				const hasWrite = !!item.detail.teams?.some(
					(team: { id: number; permission_pack?: string | null }) => userTeamIds.has(team.id) && team.permission_pack === 'write'
				);
				return {
					groupId: item.id,
					groupName: item.name,
					hasWrite,
					checked: !!enabledPack,
					initialChecked: !!enabledPack,
					enabledId: enabledPack ? enabledPack.id : null,
					packVersionId: enabledPack ? String(enabledPack.pack_version_id) : (versionsRes.length > 0 ? String(versionsRes[0].id) : ''),
					initialPackVersionId: enabledPack ? String(enabledPack.pack_version_id) : '',
					autoupdate: enabledPack ? enabledPack.autoupdate : true,
					initialAutoupdate: enabledPack ? enabledPack.autoupdate : true
				};
			});
		} catch (e) {
			showError((e as Error).message);
		} finally {
			loading = false;
		}
	}

	async function updatePackDetails(): Promise<void> {
		if (!pack) return;
		if ($user && $user.role !== 'admin' && $user.role !== 'maintainer' && editTeamIds.length === 0) {
			showError('You must select at least one team for this private pack.');
			return;
		}
		savingPack = true;
		try {
			await api.updatePack(pack.id, editName, editDesc, editTeamIds);
			showFlash('Pack updated successfully');
			await loadAll();
		} catch (e) {
			showError((e as Error).message);
		} finally {
			savingPack = false;
		}
	}

	async function deletePack(): Promise<void> {
		if (!pack) return;
		if (!await askConfirm('Are you sure you want to delete this pack and all its versions? This cannot be undone.')) return;
		try {
			await api.deletePack(pack.id);
			showFlash('Pack deleted');
			goto(`${base}/packs`);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function uploadPackVersion(): Promise<void> {
		if (!pack) return;
		if (!uploadFile) {
			showError('Please select a zip file');
			return;
		}
		uploading = true;
		try {
			await api.uploadVersion(pack.id, uploadVersion, uploadFile, uploadReleaseNotes);
			showUpload = false;
			showFlash('New version uploaded');
			await loadAll();
		} catch (e) {
			showError((e as Error).message);
		} finally {
			uploading = false;
		}
	}

	async function downloadVersionFile(v: PackVersion): Promise<void> {
		if (!pack) return;
		try {
			const res = await api.downloadVersion(v.id);
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${pack.name}-${v.version}.zip`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function saveGroupAccess(): Promise<void> {
		savingAccess = true;
		try {
			for (const gs of groupStates) {
				if (!gs.hasWrite) continue; // Skip if user has no permission

				const hasChanged = gs.checked !== gs.initialChecked ||
					(gs.checked && (gs.packVersionId !== gs.initialPackVersionId || gs.autoupdate !== gs.initialAutoupdate));

				if (!hasChanged) continue;

				if (gs.initialChecked && gs.enabledId !== null) {
					// Need to disable the old mapping first
					await api.disablePack(gs.groupId, gs.enabledId);
				}

				if (gs.checked) {
					// Enable new mapping
					await api.enablePack(gs.groupId, Number(gs.packVersionId), gs.autoupdate);
				}
			}
			showFlash('Group access saved successfully');
			await loadAll();
		} catch (e) {
			showError((e as Error).message);
		} finally {
			savingAccess = false;
		}
	}
</script>

<svelte:head>
	<title>{pack ? pack.name : 'Pack Details'} - Radegast</title>
</svelte:head>

<div class="mb-4">
	<a href="{base}/packs" class="btn btn-outline-secondary btn-sm mb-2">← Back to Packs</a>
</div>

{#if loading && !pack}
	<div class="text-muted">Loading pack details...</div>
{:else if pack}
	<div class="row g-4">
		<!-- Left Column: Details, Editing & Versions -->
		<div class="col-lg-7">
			<div class="card mb-4 shadow-sm">
				<div class="card-body">
					{#if canManage}
						<h4 class="fw-bold mb-3">Edit Pack details</h4>
						<form onsubmit={(e) => { e.preventDefault(); updatePackDetails(); }}>
							<div class="mb-3">
								<label for="editName" class="form-label fw-bold small text-secondary">Pack Name</label>
								<input type="text" class="form-control" id="editName" bind:value={editName} required />
							</div>
							<div class="mb-3">
								<label for="editDesc" class="form-label fw-bold small text-secondary">Description</label>
								<textarea class="form-control" id="editDesc" bind:value={editDesc} rows="3"></textarea>
							</div>
							<div class="mb-3">
								<span class="d-block fw-bold small text-secondary mb-1">Team Access (Private Pack)</span>
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
											{@const isSelected = editTeamIds.includes(team.id)}
											<label 
												class="team-access-item d-flex align-items-center justify-content-between p-2.5 rounded-3 border transition-all {isSelected ? 'border-primary bg-primary-subtle bg-opacity-25' : 'border-light-subtle bg-body'}"
												style="cursor: pointer;"
											>
												<div class="d-flex align-items-center gap-2">
													<input
														class="form-check-input m-0"
														type="checkbox"
														id="team-check-detail-{team.id}"
														value={team.id}
														checked={isSelected}
														onchange={(e) => {
															const target = e.target as HTMLInputElement;
															if (target.checked) {
																editTeamIds = [...editTeamIds, team.id];
															} else {
																editTeamIds = editTeamIds.filter((id) => id !== team.id);
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
							<div class="d-flex justify-content-between">
								<button type="submit" class="btn btn-primary" disabled={savingPack}>
									{savingPack ? 'Saving...' : 'Save Pack Info'}
								</button>
								<button type="button" class="btn btn-outline-danger" onclick={deletePack}>
									Delete Pack
								</button>
							</div>
						</form>
					{:else}
						<div class="d-flex align-items-center justify-content-between mb-2">
							<h3 class="fw-bold text-primary mb-0">{pack.name}</h3>
							{#if pack.team_ids && pack.team_ids.length > 0}
								<span class="badge bg-secondary">Private</span>
							{:else}
								<span class="badge bg-success">Global</span>
							{/if}
						</div>
						<p class="text-muted mb-3">{pack.description || 'No description'}</p>
						{#if pack.team_ids && pack.team_ids.length > 0}
							<div class="mt-2">
								<span class="fw-bold small text-secondary">Associated Teams:</span>
								<div class="d-flex gap-1 flex-wrap mt-1">
									{#each teams.filter((t) => pack?.team_ids?.includes(t.id)) as t}
										<span class="badge bg-body-secondary text-body border">{t.name}</span>
									{:else}
										<span class="text-muted small">Loading team names...</span>
									{/each}
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Versions list card -->
			<div class="card shadow-sm">
				<div class="card-header bg-body-tertiary py-3 d-flex justify-content-between align-items-center">
					<h5 class="mb-0 fw-bold">Pack Versions</h5>
					{#if canManage}
						<button class="btn btn-sm btn-primary" onclick={() => { uploadVersion = ''; uploadReleaseNotes = ''; uploadFile = null; showUpload = true; }}>
							Upload Version
						</button>
					{/if}
				</div>
				<div class="card-body p-0">
					{#if versions.length === 0}
						<p class="text-muted p-4 mb-0 text-center">No versions uploaded yet.</p>
					{:else}
						<div class="table-responsive">
							<table class="table table-hover align-middle mb-0">
								<thead>
									<tr>
										<th class="ps-4" style="width: 20%">Version</th>
										<th style="width: 40%">Release Notes</th>
										<th style="width: 25%">Released Date</th>
										<th class="text-end pe-4" style="width: 15%">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each versions as v}
										<tr>
											<td class="ps-4 fw-bold text-success">{v.version}</td>
											<td class="text-muted small" style="white-space: pre-wrap;">{v.release_notes || '—'}</td>
											<td class="text-muted small">{new Date(v.released).toLocaleString()}</td>
											<td class="text-end pe-4">
												{#if canManage && pack}
													<button
														class="btn btn-sm btn-outline-secondary me-2"
														onclick={() => goto(`${base}/packs/${pack!.id}/edit/${v.id}`)}
														title="Edit this version"
													>
														Edit
													</button>
												{/if}
												<button
													class="btn btn-sm btn-outline-primary"
													onclick={() => downloadVersionFile(v)}
													title="Download zip file"
												>
													Download
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Right Column: Enable in Groups -->
		<div class="col-lg-5">
			<div class="card shadow-sm">
				<div class="card-header bg-body-tertiary py-3 d-flex justify-content-between align-items-center">
					<h5 class="mb-0 fw-bold">Group Assignments</h5>
					<button class="btn btn-sm btn-success" onclick={saveGroupAccess} disabled={savingAccess || groupStates.length === 0}>
						{savingAccess ? 'Saving...' : 'Save Assignments'}
					</button>
				</div>
				<div class="card-body">
					<p class="text-muted small">
						Enable or disable this pack across device groups where you have write access.
					</p>

					{#if groupStates.length === 0}
						<p class="text-muted text-center py-4 mb-0">No device groups visible.</p>
					{:else}
						<div class="group-assignment-list d-flex flex-column gap-3 mb-3 max-height-scroll border rounded p-3 bg-body-tertiary" style="max-height: 500px; overflow-y: auto;">
							{#each groupStates as gs}
								{@const isAssigned = gs.checked}
								<div 
									class="group-assignment-card p-3 rounded-3 border transition-all {isAssigned ? 'border-success bg-success-subtle bg-opacity-10' : 'border-light-subtle bg-body'} {!gs.hasWrite ? 'opacity-75' : ''}"
								>
									<div class="d-flex align-items-center justify-content-between mb-2">
										<div class="d-flex align-items-center gap-3">
											<input
												class="form-check-input m-0"
												type="checkbox"
												id="group-check-{gs.groupId}"
												bind:checked={gs.checked}
												disabled={!gs.hasWrite}
											/>
											<label class="fw-bold fs-6 mb-0 text-body cursor-pointer" for="group-check-{gs.groupId}">
												{gs.groupName}
											</label>
										</div>
										{#if !gs.hasWrite}
											<span class="badge bg-secondary-subtle text-secondary small border px-2 py-1">Read Only</span>
										{:else if isAssigned}
											<span class="badge bg-success-subtle text-success small border border-success-subtle px-2 py-1">Assigned</span>
										{:else}
											<span class="badge bg-body-secondary text-secondary small border px-2 py-1">Unassigned</span>
										{/if}
									</div>

									{#if gs.checked}
										<div class="mt-3 bg-body p-3 rounded-2 border border-light-subtle shadow-sm">
											<div class="mb-3">
												<label for="ver-select-{gs.groupId}" class="form-label small mb-1 text-secondary fw-semibold">Version to Enable</label>
												<select
													class="form-select form-select-sm fw-semibold"
													id="ver-select-{gs.groupId}"
													bind:value={gs.packVersionId}
													disabled={!gs.hasWrite}
												>
													{#each versions as v}
														<option value={String(v.id)}>{v.version}</option>
													{:else}
														<option value="">No versions available</option>
													{/each}
												</select>
											</div>
											<div class="form-check form-switch m-0">
												<input
													class="form-check-input"
													type="checkbox"
													role="switch"
													id="auto-check-{gs.groupId}"
													bind:checked={gs.autoupdate}
													disabled={!gs.hasWrite}
												/>
												<label class="form-check-label small fw-semibold text-muted" for="auto-check-{gs.groupId}">
													Autoupdate to latest version
												</label>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Upload Version Modal -->
<Modal show={showUpload} title="Upload New Version" onClose={() => (showUpload = false)}>
	<form onsubmit={(e) => { e.preventDefault(); uploadPackVersion(); }}>
		<div class="mb-3">
			<label for="versionInput" class="form-label">Version String</label>
			<input
				type="text"
				class="form-control"
				id="versionInput"
				bind:value={uploadVersion}
				placeholder="1.0.0"
				required
			/>
			<div class="form-text">Must use major.minor.patch format (e.g. 1.0.0) and be higher than existing versions.</div>
		</div>
		<div class="mb-3">
			<label for="fileInput" class="form-label">Zip File</label>
			<input
				type="file"
				class="form-control"
				id="fileInput"
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
			<label for="releaseNotesInput" class="form-label">Release Notes (Optional)</label>
			<textarea
				class="form-control"
				id="releaseNotesInput"
				bind:value={uploadReleaseNotes}
				rows="3"
				placeholder="Add release notes for this version..."
			></textarea>
		</div>
		<button type="submit" class="btn btn-primary" disabled={uploading}>
			{uploading ? 'Uploading...' : 'Upload'}
		</button>
	</form>
</Modal>

<style>
	.team-access-item, .group-assignment-card {
		transition: all 0.2s ease-in-out;
	}
	.team-access-item:hover, .group-assignment-card:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
	}
	/* Custom thin scrollbar for lists */
	.team-access-list::-webkit-scrollbar, .group-assignment-list::-webkit-scrollbar {
		width: 6px;
	}
	.team-access-list::-webkit-scrollbar-track, .group-assignment-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.team-access-list::-webkit-scrollbar-thumb, .group-assignment-list::-webkit-scrollbar-thumb {
		background-color: rgba(0, 0, 0, 0.1);
		border-radius: 3px;
	}
	.team-access-list::-webkit-scrollbar-thumb:hover, .group-assignment-list::-webkit-scrollbar-thumb:hover {
		background-color: rgba(0, 0, 0, 0.2);
	}
</style>
