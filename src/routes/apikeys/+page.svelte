<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type APIKeyResponse, type APIKeyScopes } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';
	import { askConfirm } from '$lib/confirm';

	let keys = $state<APIKeyResponse[]>([]);
	let loading = $state(true);
	let creating = $state(false);

	// New key form state
	let keyName = $state('');
	let devicesScope = $state<('read' | 'create' | 'write' | 'delete')[]>([]);
	let teamsScope = $state<('read' | 'create' | 'write' | 'delete')[]>([]);
	let groupsScope = $state<('read' | 'create' | 'write' | 'delete')[]>([]);
	let packsScope = $state<('read' | 'create' | 'write' | 'delete')[]>([]);
	let logsScope = $state<('read' | 'create' | 'write' | 'delete')[]>([]);

	// Dropdown states
	let devicesDropdownOpen = $state(false);
	let teamsDropdownOpen = $state(false);
	let groupsDropdownOpen = $state(false);
	let packsDropdownOpen = $state(false);
	let logsDropdownOpen = $state(false);

	function closeAllDropdowns() {
		devicesDropdownOpen = false;
		teamsDropdownOpen = false;
		groupsDropdownOpen = false;
		packsDropdownOpen = false;
		logsDropdownOpen = false;
	}

	// Key Expiration
	let expiresOption = $state<'never' | '30' | '90' | 'custom'>('never');
	let expiresCustomDate = $state('');

	// Created key modal state
	let showNewKeyModal = $state(false);
	let generatedKey = $state('');
	let copied = $state(false);

	async function loadKeys() {
		loading = true;
		try {
			keys = await api.listApiKeys();
		} catch (e: any) {
			showError(e.message);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadKeys();
	});

	async function createKey(e: Event) {
		e.preventDefault();
		if (!keyName.trim()) {
			showError('Please enter a key name.');
			return;
		}
		creating = true;
		try {
			const scopes: APIKeyScopes = {
				devices: devicesScope,
				teams: teamsScope,
				groups: groupsScope,
				packs: packsScope,
				logs: logsScope
			};

			let expiresAt: string | null = null;
			if (expiresOption === '30') {
				const d = new Date();
				d.setDate(d.getDate() + 30);
				expiresAt = d.toISOString();
			} else if (expiresOption === '90') {
				const d = new Date();
				d.setDate(d.getDate() + 90);
				expiresAt = d.toISOString();
			} else if (expiresOption === 'custom' && expiresCustomDate) {
				expiresAt = new Date(expiresCustomDate).toISOString();
			}

			const res = await api.createApiKey(keyName, scopes, expiresAt);
			generatedKey = res.key;
			showNewKeyModal = true;
			keyName = '';
			devicesScope = [];
			teamsScope = [];
			groupsScope = [];
			packsScope = [];
			logsScope = [];
			expiresOption = 'never';
			expiresCustomDate = '';
			showFlash('API key generated successfully.');
			await loadKeys();
		} catch (e: any) {
			showError(e.message);
		} finally {
			creating = false;
		}
	}

	async function revokeKey(id: number) {
		if (!await askConfirm('Are you sure you want to revoke this API key? This action is irreversible.')) {
			return;
		}
		try {
			await api.deleteApiKey(id);
			showFlash('API key revoked.');
			await loadKeys();
		} catch (e: any) {
			showError(e.message);
		}
	}

	function copyToClipboard() {
		navigator.clipboard.writeText(generatedKey);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}

	function formatScopes(scopes: APIKeyScopes): [string, string][] {
		const result: [string, string][] = [];
		if (!scopes) return result;
		for (const [scope, val] of Object.entries(scopes as Record<string, any>)) {
			if (Array.isArray(val)) {
				if (val.length > 0) {
					result.push([scope, val.join(', ')]);
				}
			} else if (val && val !== 'none') {
				result.push([scope, val]);
			}
		}
		return result;
	}
</script>

<svelte:window onclick={closeAllDropdowns} />

<div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
	<div>
		<h2 class="mb-0 fw-bold">API Keys</h2>
		<p class="text-muted mb-0">Programmatic access tokens for external systems and scripts.</p>
	</div>
</div>

<div class="row g-4">
	<!-- Keys list -->
	<div class="col-lg-8">
		<div class="card">
			<div class="card-header d-flex justify-content-between align-items-center">
				<h5 class="fw-bold mb-0">Active API Keys</h5>
			</div>
			<div class="card-body p-4">
				{#if loading}
					<div class="text-center py-5">
						<div class="spinner-border text-primary" role="status"></div>
						<p class="text-muted small mt-2">Loading API keys...</p>
					</div>
				{:else if keys.length === 0}
					<div class="text-center py-5 text-muted">
						<p class="mb-0">No active API keys found.</p>
						<p class="small text-secondary">Generate a key using the panel to the right.</p>
					</div>
				{:else}
					<div class="table-responsive">
						<table class="table table-hover align-middle mb-0">
							<thead class="text-muted small uppercase">
								<tr>
									<th>Name</th>
									<th>Scopes</th>
									<th>Created / Expires</th>
									<th>Last Used</th>
									<th class="text-end">Actions</th>
								</tr>
							</thead>
							<tbody>
								{#each keys as key}
									<tr>
										<td>
											<span class="fw-bold">{key.name}</span>
										</td>
										<td>
											<div class="d-flex flex-wrap gap-1">
												{#each formatScopes(key.scopes) as [scope, formatted]}
													<span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-1 small text-capitalize">
														{scope}: {formatted}
													</span>
												{/each}
											</div>
										</td>
										<td class="text-muted small">
											<div>{new Date(key.created_at).toLocaleDateString()}</div>
											{#if key.expires_at}
												<div class="text-danger small mt-1">Expires: {new Date(key.expires_at).toLocaleDateString()}</div>
											{:else}
												<div class="text-secondary small mt-1">Expires: Never</div>
											{/if}
										</td>
										<td class="text-muted small">
											{#if key.last_used}
												<div>{new Date(key.last_used).toLocaleDateString()}</div>
												<div class="text-secondary small">{new Date(key.last_used).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
											{:else}
												<span class="text-muted small">Never</span>
											{/if}
										</td>
										<td class="text-end">
											<button class="btn btn-outline-danger btn-sm px-3 fw-bold" onclick={() => revokeKey(key.id)}>
												Revoke
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

	<!-- Create panel -->
	<div class="col-lg-4">
		<div class="card">
			<div class="card-header">
				<h5 class="fw-bold mb-0">Create API Key</h5>
			</div>
			<div class="card-body p-4">
				<form onsubmit={createKey}>
					<div class="mb-3">
						<label for="key-name" class="form-label fw-bold text-secondary small">Key Name</label>
						<input
							type="text"
							id="key-name"
							class="form-control"
							placeholder="e.g. CI/CD Deploy Key"
							bind:value={keyName}
							required
						/>
					</div>

					<div class="mb-3">
						<label for="key-expiration" class="form-label fw-bold text-secondary small">Expiration</label>
						<select id="key-expiration" class="form-select" bind:value={expiresOption}>
							<option value="never">Never</option>
							<option value="30">30 Days</option>
							<option value="90">90 Days</option>
							<option value="custom">Custom Date</option>
						</select>
					</div>

					{#if expiresOption === 'custom'}
						<div class="mb-3">
							<label for="key-custom-date" class="form-label fw-bold text-secondary small">Expiration Date</label>
							<input
								type="datetime-local"
								id="key-custom-date"
								class="form-control"
								bind:value={expiresCustomDate}
								required
							/>
						</div>
					{/if}

					<div class="mb-4">
						<span class="form-label fw-bold text-secondary small d-block mb-3">Scopes & Permissions</span>
						
						<!-- Devices -->
						<div class="row align-items-center mb-3">
							<div class="col-5">
								<span class="fw-semibold">Devices</span>
							</div>
							<div class="col-7">
								<div class="dropdown">
									<button
										class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center {devicesDropdownOpen ? 'show' : ''}"
										type="button"
										onclick={(e) => { e.stopPropagation(); const wasOpen = devicesDropdownOpen; closeAllDropdowns(); devicesDropdownOpen = !wasOpen; }}
										aria-expanded={devicesDropdownOpen}
									>
										<span class="text-truncate" style="max-width: 140px;">{devicesScope.length === 0 ? 'None' : devicesScope.join(', ')}</span>
									</button>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
									<ul class="dropdown-menu p-3 w-100 shadow {devicesDropdownOpen ? 'show' : ''}" onclick={(e) => e.stopPropagation()}>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="devices-read" value="read" bind:group={devicesScope} />
												<label class="form-check-label small" for="devices-read">Read</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="devices-create" value="create" bind:group={devicesScope} />
												<label class="form-check-label small" for="devices-create">Create</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="devices-write" value="write" bind:group={devicesScope} />
												<label class="form-check-label small" for="devices-write">Write</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="devices-delete" value="delete" bind:group={devicesScope} />
												<label class="form-check-label small" for="devices-delete">Delete</label>
											</div>
										</li>
									</ul>
								</div>
							</div>
						</div>

						<!-- Teams -->
						<div class="row align-items-center mb-3">
							<div class="col-5">
								<span class="fw-semibold">Teams</span>
							</div>
							<div class="col-7">
								<div class="dropdown">
									<button
										class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center {teamsDropdownOpen ? 'show' : ''}"
										type="button"
										onclick={(e) => { e.stopPropagation(); const wasOpen = teamsDropdownOpen; closeAllDropdowns(); teamsDropdownOpen = !wasOpen; }}
										aria-expanded={teamsDropdownOpen}
									>
										<span class="text-truncate" style="max-width: 140px;">{teamsScope.length === 0 ? 'None' : teamsScope.join(', ')}</span>
									</button>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
									<ul class="dropdown-menu p-3 w-100 shadow {teamsDropdownOpen ? 'show' : ''}" onclick={(e) => e.stopPropagation()}>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="teams-read" value="read" bind:group={teamsScope} />
												<label class="form-check-label small" for="teams-read">Read</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="teams-create" value="create" bind:group={teamsScope} />
												<label class="form-check-label small" for="teams-create">Create</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="teams-write" value="write" bind:group={teamsScope} />
												<label class="form-check-label small" for="teams-write">Write</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="teams-delete" value="delete" bind:group={teamsScope} />
												<label class="form-check-label small" for="teams-delete">Delete</label>
											</div>
										</li>
									</ul>
								</div>
							</div>
						</div>

						<!-- Groups -->
						<div class="row align-items-center mb-3">
							<div class="col-5">
								<span class="fw-semibold">Groups</span>
							</div>
							<div class="col-7">
								<div class="dropdown">
									<button
										class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center {groupsDropdownOpen ? 'show' : ''}"
										type="button"
										onclick={(e) => { e.stopPropagation(); const wasOpen = groupsDropdownOpen; closeAllDropdowns(); groupsDropdownOpen = !wasOpen; }}
										aria-expanded={groupsDropdownOpen}
									>
										<span class="text-truncate" style="max-width: 140px;">{groupsScope.length === 0 ? 'None' : groupsScope.join(', ')}</span>
									</button>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
									<ul class="dropdown-menu p-3 w-100 shadow {groupsDropdownOpen ? 'show' : ''}" onclick={(e) => e.stopPropagation()}>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="groups-read" value="read" bind:group={groupsScope} />
												<label class="form-check-label small" for="groups-read">Read</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="groups-create" value="create" bind:group={groupsScope} />
												<label class="form-check-label small" for="groups-create">Create</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="groups-write" value="write" bind:group={groupsScope} />
												<label class="form-check-label small" for="groups-write">Write</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="groups-delete" value="delete" bind:group={groupsScope} />
												<label class="form-check-label small" for="groups-delete">Delete</label>
											</div>
										</li>
									</ul>
								</div>
							</div>
						</div>

						<!-- Packs -->
						<div class="row align-items-center mb-3">
							<div class="col-5">
								<span class="fw-semibold">Packs</span>
							</div>
							<div class="col-7">
								<div class="dropdown">
									<button
										class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center {packsDropdownOpen ? 'show' : ''}"
										type="button"
										onclick={(e) => { e.stopPropagation(); const wasOpen = packsDropdownOpen; closeAllDropdowns(); packsDropdownOpen = !wasOpen; }}
										aria-expanded={packsDropdownOpen}
									>
										<span class="text-truncate" style="max-width: 140px;">{packsScope.length === 0 ? 'None' : packsScope.join(', ')}</span>
									</button>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
									<ul class="dropdown-menu p-3 w-100 shadow {packsDropdownOpen ? 'show' : ''}" onclick={(e) => e.stopPropagation()}>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="packs-read" value="read" bind:group={packsScope} />
												<label class="form-check-label small" for="packs-read">Read</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="packs-create" value="create" bind:group={packsScope} />
												<label class="form-check-label small" for="packs-create">Create</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="packs-write" value="write" bind:group={packsScope} />
												<label class="form-check-label small" for="packs-write">Write</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="packs-delete" value="delete" bind:group={packsScope} />
												<label class="form-check-label small" for="packs-delete">Delete</label>
											</div>
										</li>
									</ul>
								</div>
							</div>
						</div>

						<!-- Logs -->
						<div class="row align-items-center mb-3">
							<div class="col-5">
								<span class="fw-semibold">Logs</span>
							</div>
							<div class="col-7">
								<div class="dropdown">
									<button
										class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 text-start d-flex justify-content-between align-items-center {logsDropdownOpen ? 'show' : ''}"
										type="button"
										onclick={(e) => { e.stopPropagation(); const wasOpen = logsDropdownOpen; closeAllDropdowns(); logsDropdownOpen = !wasOpen; }}
										aria-expanded={logsDropdownOpen}
									>
										<span class="text-truncate" style="max-width: 140px;">{logsScope.length === 0 ? 'None' : logsScope.join(', ')}</span>
									</button>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
									<ul class="dropdown-menu p-3 w-100 shadow {logsDropdownOpen ? 'show' : ''}" onclick={(e) => e.stopPropagation()}>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="logs-read" value="read" bind:group={logsScope} />
												<label class="form-check-label small" for="logs-read">Read</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="logs-create" value="create" bind:group={logsScope} />
												<label class="form-check-label small" for="logs-create">Create</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="logs-write" value="write" bind:group={logsScope} />
												<label class="form-check-label small" for="logs-write">Write</label>
											</div>
										</li>
										<li>
											<div class="form-check">
												<input class="form-check-input" type="checkbox" id="logs-delete" value="delete" bind:group={logsScope} />
												<label class="form-check-label small" for="logs-delete">Delete</label>
											</div>
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>

					<button type="submit" class="btn btn-primary w-100 fw-bold" disabled={creating}>
						{#if creating}
							Generating Key...
						{:else}
							Generate API Key
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
</div>

<!-- Modal to display generated key -->
<Modal show={showNewKeyModal} title="🔑 Your New API Key" onClose={() => showNewKeyModal = false}>
	<p class="text-muted small">
		Your API key has been successfully generated. Make sure to copy it now!
	</p>
	<div class="alert alert-warning py-2 small border-0 mb-3" style="border-radius: 8px;">
		⚠️ <strong>For security reasons, this key will not be shown again.</strong> If you lose it, you will need to revoke it and generate a new one.
	</div>
	<div class="mb-3 position-relative">
		<textarea
			id="layout-new-key"
			class="form-control font-monospace text-center fw-bold bg-body-secondary py-3 pe-5"
			rows="2"
			readonly
			value={generatedKey}
			style="letter-spacing: 0.5px; font-size: 1.05rem; resize: none;"
		></textarea>
		<button
			class="btn btn-sm btn-outline-secondary position-absolute"
			style="top: 50%; right: 12px; transform: translateY(-50%);"
			onclick={copyToClipboard}
			title="Copy to clipboard"
		>
			{#if copied}
				Copied!
			{:else}
				Copy
			{/if}
		</button>
	</div>
	<div class="d-flex justify-content-end gap-2 mt-4">
		<button class="btn btn-primary px-4 fw-bold" onclick={() => showNewKeyModal = false}>
			Done
		</button>
	</div>
</Modal>
