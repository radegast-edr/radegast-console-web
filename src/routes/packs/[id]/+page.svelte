<script>
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { api } from '$lib/api.js';
	import { user, showFlash, showError } from '$lib/store.js';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';

	let pack = $state(null);
	let versions = $state([]);
	let loading = $state(true);

	// Pack Edit State
	let editName = $state('');
	let editDesc = $state('');
	let savingPack = $state(false);

	// Upload Version State
	let showUpload = $state(false);
	let uploadVersion = $state('');
	let uploadReleaseNotes = $state('');
	let uploadFile = $state(null);
	let uploading = $state(false);

	// Group Access State
	let groupStates = $state([]);
	let savingAccess = $state(false);

	let canManage = $derived($user && ($user.role === 'maintainer' || $user.role === 'admin'));

	$effect(() => {
		loadAll();
	});

	async function loadAll() {
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
			editName = packRes.name;
			editDesc = packRes.description;

			const userTeamIds = new Set(teamsRes.map((t) => t.id));

			// Load details and enabled state for all visible groups
			const groupDataList = await Promise.all(
				groupsRes.map(async (g) => {
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
				const hasWrite = item.detail.teams.some(
					(team) => userTeamIds.has(team.id) && team.permission_pack === 'write'
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
			showError(e.message);
		} finally {
			loading = false;
		}
	}

	async function updatePackDetails() {
		savingPack = true;
		try {
			await api.updatePack(pack.id, editName, editDesc);
			showFlash('Pack updated successfully');
			await loadAll();
		} catch (e) {
			showError(e.message);
		} finally {
			savingPack = false;
		}
	}

	async function deletePack() {
		if (!confirm('Are you sure you want to delete this pack and all its versions? This cannot be undone.')) return;
		try {
			await api.deletePack(pack.id);
			showFlash('Pack deleted');
			goto(`${base}/packs`);
		} catch (e) {
			showError(e.message);
		}
	}

	async function uploadPackVersion() {
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
			showError(e.message);
		} finally {
			uploading = false;
		}
	}

	async function saveGroupAccess() {
		savingAccess = true;
		try {
			for (const gs of groupStates) {
				if (!gs.hasWrite) continue; // Skip if user has no permission

				const hasChanged = gs.checked !== gs.initialChecked ||
					(gs.checked && (gs.packVersionId !== gs.initialPackVersionId || gs.autoupdate !== gs.initialAutoupdate));

				if (!hasChanged) continue;

				if (gs.initialChecked) {
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
			showError(e.message);
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
						<h3 class="fw-bold text-primary mb-2">{pack.name}</h3>
						<p class="text-muted mb-0">{pack.description || 'No description'}</p>
					{/if}
				</div>
			</div>

			<!-- Versions list card -->
			<div class="card shadow-sm">
				<div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
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
							<table class="table table-striped align-middle mb-0">
								<thead>
									<tr>
										<th class="ps-4">Version</th>
										<th>Released Date</th>
									</tr>
								</thead>
								<tbody>
									{#each versions as v}
										<tr>
											<td class="ps-4 fw-bold text-success">
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
				</div>
			</div>
		</div>

		<!-- Right Column: Enable in Groups -->
		<div class="col-lg-5">
			<div class="card shadow-sm">
				<div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
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
						<div class="list-group list-group-flush border-top border-bottom mb-3">
							{#each groupStates as gs}
								<div class="list-group-item px-0 py-3">
									<div class="d-flex align-items-start gap-3">
										<input
											class="form-check-input mt-1"
											type="checkbox"
											id="group-check-{gs.groupId}"
											bind:checked={gs.checked}
											disabled={!gs.hasWrite}
										/>
										<div class="flex-grow-1">
											<label class="form-check-label fw-bold d-block" for="group-check-{gs.groupId}">
												{gs.groupName}
											</label>
											{#if !gs.hasWrite}
												<span class="badge bg-light text-secondary small">Read Only</span>
											{/if}

											{#if gs.checked}
												<div class="mt-2 bg-light p-2 rounded">
													<div class="mb-2">
														<label for="ver-select-{gs.groupId}" class="form-label small mb-1 text-secondary fw-semibold">Version to Enable</label>
														<select
															class="form-select form-select-sm"
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
													<div class="form-check">
														<input
															class="form-check-input"
															type="checkbox"
															id="auto-check-{gs.groupId}"
															bind:checked={gs.autoupdate}
															disabled={!gs.hasWrite}
														/>
														<label class="form-check-label small text-muted" for="auto-check-{gs.groupId}">
															Autoupdate to latest versions
														</label>
													</div>
												</div>
											{/if}
										</div>
									</div>
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
				onchange={(e) => (uploadFile = e.target.files[0])}
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
