<script lang="ts">
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { askConfirm } from '$lib/confirm';
	import { api, ApiError, type Exclusion, type GroupDetail, type Group } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import {
		applyExclusionToGroup,
		describeLastChange,
		encryptExclusionFields,
		groupSupportsE2EE,
		lastChangeAuthor,
		loadExclusionLibrary,
		removeExclusionFromGroup,
		updateExclusionContent,
		type ExclusionFields
	} from '$lib/exclusionHelpers';
	import ExclusionModal from '$lib/components/ExclusionModal.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	type Row = Exclusion & { decrypted: ExclusionFields | null };

	let loading = $state(true);
	let groups = $state<GroupDetail[]>([]);
	let rows = $state<Row[]>([]);

	let filterGroupId = $state('');
	let filterType = $state('');
	let search = $state('');

	// Create / edit modal state
	let showExclusionModal = $state(false);
	let exclusionName = $state('');
	let exclusionQuery = $state('');
	let exclusionDescription = $state('');
	let exclusionType = $state<'hard' | 'soft'>('hard');
	let exclusionEncrypted = $state(false);
	let selectedGroupIds = $state<number[]>([]);
	let editingExclusion = $state<Row | null>(null);

	// Apply-to-group modal state
	let applyingExclusion = $state<Row | null>(null);
	let applyGroupId = $state<number | null>(null);
	let busy = $state(false);

	let writableGroups = $derived(groups.filter((g) => g.user_has_pack_write));
	let groupsById = $derived(new Map(groups.map((g) => [g.id, g])));

	let applyCandidates = $derived.by(() => {
		if (!applyingExclusion) return [];
		const linked = new Set(applyingExclusion.groups.map((g) => g.id));
		return writableGroups.filter((g) => !linked.has(g.id));
	});

	let applyTarget = $derived(applyGroupId ? (groupsById.get(applyGroupId) ?? null) : null);
	let applyBlockedByE2EE = $derived(!!applyingExclusion?.encrypted && !!applyTarget && !groupSupportsE2EE(applyTarget));

	let filteredRows = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return rows.filter((r) => {
			if (filterGroupId && !r.groups.some((g) => g.id === Number(filterGroupId))) return false;
			if (filterType && (r.exclusion_type || 'hard') !== filterType) return false;
			if (!q) return true;
			const text = r.decrypted
				? [r.decrypted.name, r.decrypted.jsonata_query, r.decrypted.description ?? '']
				: [];
			return [...text, ...r.groups.map((g) => g.name)].some((v) => v.toLowerCase().includes(q));
		});
	});

	onMount(loadAll);

	async function loadAll(): Promise<void> {
		loading = true;
		try {
			const me = await api.me();
			const library = await loadExclusionLibrary(me.id);
			groups = library.groups.sort((a, b) => a.name.localeCompare(b.name));
			rows = library.exclusions.sort((a, b) =>
				(a.decrypted?.name ?? '').localeCompare(b.decrypted?.name ?? '')
			);
		} catch (e) {
			showError((e as Error).message);
		} finally {
			loading = false;
		}
	}

	async function handleError(e: unknown): Promise<void> {
		showError((e as Error).message);
		if (e instanceof ApiError && e.status === 409) {
			await loadAll();
		}
	}

	function resetForm(): void {
		exclusionName = '';
		exclusionQuery = '';
		exclusionDescription = '';
		exclusionType = 'hard';
		exclusionEncrypted = false;
		selectedGroupIds = [];
		editingExclusion = null;
	}

	function openCreate(): void {
		resetForm();
		const preferred = filterGroupId ? Number(filterGroupId) : null;
		const initial = writableGroups.find((g) => g.id === preferred) ?? writableGroups[0];
		selectedGroupIds = initial ? [initial.id] : [];
		showExclusionModal = true;
	}

	function openEdit(row: Row): void {
		if (!row.decrypted) return;
		resetForm();
		editingExclusion = row;
		exclusionName = row.decrypted.name;
		exclusionQuery = row.decrypted.jsonata_query;
		exclusionDescription = row.decrypted.description || '';
		exclusionType = (row.exclusion_type as 'hard' | 'soft') || 'hard';
		exclusionEncrypted = row.encrypted || false;
		showExclusionModal = true;
	}

	async function saveExclusion(): Promise<void> {
		const fields: ExclusionFields = {
			name: exclusionName.trim(),
			jsonata_query: exclusionQuery.trim(),
			description: exclusionDescription.trim() || null
		};
		if (!fields.name || !fields.jsonata_query) {
			showError('Name and JSONata query are required');
			return;
		}
		try {
			if (editingExclusion) {
				await updateExclusionContent(editingExclusion, fields, exclusionType);
				showFlash('Exclusion updated');
			} else {
				if (selectedGroupIds.length === 0) {
					showError('Select at least one device group');
					return;
				}
				const targets = selectedGroupIds.map((id) => groupsById.get(id)).filter((g) => !!g);
				const content = exclusionEncrypted
					? await encryptExclusionFields(fields, targets.map((g) => g.public_key ?? ''))
					: fields;
				await api.createSharedExclusion({
					...content,
					group_ids: selectedGroupIds,
					exclusion_type: exclusionType,
					encrypted: exclusionEncrypted
				});
				showFlash('Exclusion created');
			}
			showExclusionModal = false;
			resetForm();
			await loadAll();
		} catch (e) {
			await handleError(e);
		}
	}

	function openApply(row: Row): void {
		applyingExclusion = row;
		applyGroupId = null;
	}

	async function confirmApply(): Promise<void> {
		if (!applyingExclusion?.decrypted || !applyTarget) return;
		busy = true;
		try {
			await applyExclusionToGroup(applyingExclusion, applyingExclusion.decrypted, applyTarget);
			showFlash(`Exclusion applied to ${applyTarget.name}`);
			applyingExclusion = null;
			await loadAll();
		} catch (e) {
			await handleError(e);
		} finally {
			busy = false;
		}
	}

	async function removeFromGroup(row: Row, groupId: number): Promise<void> {
		const group = groupsById.get(groupId);
		if (!group || !row.decrypted) return;
		const isLast = row.group_count <= 1;
		const message = isLast
			? `"${row.decrypted.name}" is only applied to ${group.name}. Removing it will delete the exclusion. Continue?`
			: `Remove "${row.decrypted.name}" from ${group.name}? It stays applied to its other groups.`;
		if (!(await askConfirm(message))) return;
		try {
			const deleted = await removeExclusionFromGroup(row, row.decrypted, group);
			showFlash(deleted ? 'Exclusion deleted' : `Exclusion removed from ${group.name}`);
			await loadAll();
		} catch (e) {
			await handleError(e);
		}
	}

	async function deleteExclusion(row: Row): Promise<void> {
		const name = row.decrypted?.name ?? `#${row.id}`;
		const where = row.group_count > 1 ? ` from all ${row.group_count} groups` : '';
		if (!(await askConfirm(`Are you sure you want to delete the exclusion "${name}"${where}?`))) return;
		try {
			await api.deleteExclusion(row.id);
			showFlash('Exclusion deleted');
			await loadAll();
		} catch (e) {
			await handleError(e);
		}
	}

	function canRemoveFrom(groupId: number): boolean {
		return !!groupsById.get(groupId)?.user_has_pack_write;
	}

	function canApplyElsewhere(row: Row): boolean {
		const linked = new Set(row.groups.map((g) => g.id));
		return !!row.decrypted && writableGroups.some((g) => !linked.has(g.id));
	}
</script>

<svelte:head>
	<title>Exclusions - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2>Exclusions</h2>
	{#if !loading && writableGroups.length > 0}
		<button class="btn btn-primary" onclick={openCreate}>Create Exclusion</button>
	{/if}
</div>

{#if loading}
	<Spinner centered text="Loading exclusions..." py={5} />
{:else if groups.length === 0}
	<p class="text-body-secondary">
		No device groups found. Exclusions are applied to <a href={resolve('/groups')}>device groups</a>.
	</p>
{:else}
	<div class="row g-2 mb-3">
		<div class="col-md-5">
			<input
				type="search"
				class="form-control"
				placeholder="Search name, query, description, group..."
				aria-label="Search exclusions"
				bind:value={search}
			/>
		</div>
		<div class="col-md-4">
			<select class="form-select" bind:value={filterGroupId} aria-label="Filter by group">
				<option value="">All groups</option>
				{#each groups as g (g.id)}
					<option value={String(g.id)}>{g.name}</option>
				{/each}
			</select>
		</div>
		<div class="col-md-3">
			<select class="form-select" bind:value={filterType} aria-label="Filter by type">
				<option value="">All types</option>
				<option value="hard">Hard</option>
				<option value="soft">Soft</option>
			</select>
		</div>
	</div>

	{#if rows.length === 0}
		<p class="text-body-secondary">
			No exclusions configured. Exclusions use JSONata queries to filter out false positives from alerts.
		</p>
	{:else if filteredRows.length === 0}
		<p class="text-body-secondary">No exclusions match the current filters.</p>
	{:else}
		<div class="table-responsive">
			<table class="table table-hover table-sm align-middle">
				<thead>
					<tr>
						<th>Name</th>
						<th>Device Groups</th>
						<th>Type</th>
						<th>JSONata Query</th>
						<th>Source Alert</th>
						<th>Last Change</th>
						<th><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each filteredRows as row (row.id)}
						<tr>
							<td>
								{#if row.decrypted}
									<strong>{row.decrypted.name}</strong>
									{#if row.decrypted.description}
										<div class="small text-body-secondary">{row.decrypted.description}</div>
									{/if}
								{:else}
									<span class="text-body-secondary"><Icon icon="lucide:lock" class="me-1" />Encrypted</span>
								{/if}
								{#if !row.encrypted}
									<span class="badge bg-secondary-subtle text-secondary-emphasis ms-1" style="font-size: 0.75rem;"><Icon icon="lucide:unlock" class="me-1" style="vertical-align: text-bottom;" />Unencrypted</span>
								{/if}
							</td>
							<td>
								<div class="d-flex flex-wrap gap-1">
									{#each row.groups as g (g.id)}
										<span class="badge bg-body-secondary text-body border d-inline-flex align-items-center gap-1">
											<a href={resolve(`/groups/${g.id}`)} class="text-body text-decoration-none">{g.name}</a>
											{#if row.decrypted && canRemoveFrom(g.id)}
												<button
													type="button"
													class="btn btn-link btn-sm p-0 text-body-secondary lh-1"
													title="Remove from {g.name}"
													aria-label="Remove from {g.name}"
													onclick={() => removeFromGroup(row, g.id)}
												><Icon icon="lucide:x" /></button>
											{/if}
										</span>
									{/each}
									{#if row.group_count > row.groups.length}
										<span class="badge bg-body-tertiary text-body-secondary border" title="Groups you do not have access to">
											+{row.group_count - row.groups.length} other
										</span>
									{/if}
								</div>
							</td>
							<td>
								{#if row.exclusion_type === 'soft'}
									<span class="badge bg-info text-dark">Soft</span>
								{:else}
									<span class="badge bg-secondary">Hard</span>
								{/if}
							</td>
							<td>
								{#if row.decrypted}
									<code class="small">{row.decrypted.jsonata_query}</code>
								{:else}
									<span class="text-body-secondary">-</span>
								{/if}
							</td>
							<td>
								{#if row.alert_id}
									<a href={resolve(`/alert/${row.alert_id}`)} class="badge bg-secondary text-decoration-none">Alert #{row.alert_id}</a>
								{:else}
									-
								{/if}
							</td>
							<td class="small">
								{#if row.last_change}
									<div>{describeLastChange(row.last_change)}</div>
									<div class="text-body-secondary">
										{lastChangeAuthor(row.last_change)}{#if row.last_change.at}&nbsp;&middot; {new Date(row.last_change.at).toLocaleString()}{/if}
									</div>
								{/if}
							</td>
							<td class="text-nowrap">
								{#if canApplyElsewhere(row)}
									<button class="btn btn-sm btn-outline-secondary me-1" onclick={() => openApply(row)} title="Apply to another group" aria-label="Apply to another group">
										<Icon icon="lucide:plus" />
									</button>
								{/if}
								{#if row.can_edit && row.decrypted}
									<button class="btn btn-sm btn-outline-secondary me-1" onclick={() => openEdit(row)} title="Edit" aria-label="Edit">
										<Icon icon="lucide:pencil" />
									</button>
								{/if}
								{#if row.can_edit}
									<button class="btn btn-sm btn-outline-danger" onclick={() => deleteExclusion(row)} title="Delete from all groups" aria-label="Delete from all groups">
										<Icon icon="lucide:trash-2" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<p class="text-muted small mb-0">
		Exclusions are JSONata queries that match against alert data. An exclusion can be applied to several
		device groups; editing it changes it in all of them. Editing or deleting requires pack write permission
		on every group it is applied to.
	</p>
{/if}

<ExclusionModal
	bind:show={showExclusionModal}
	bind:name={exclusionName}
	bind:query={exclusionQuery}
	bind:description={exclusionDescription}
	bind:exclusionType
	bind:encrypted={exclusionEncrypted}
	bind:selectedGroupIds
	multiGroup
	groups={editingExclusion ? [] : (writableGroups as unknown as Group[])}
	title={editingExclusion ? 'Edit Exclusion' : 'Create Exclusion'}
	isEditMode={!!editingExclusion}
	onClose={() => { showExclusionModal = false; resetForm(); }}
	onSave={saveExclusion}
/>

<Modal show={!!applyingExclusion} title="Apply Exclusion to Group" onClose={() => (applyingExclusion = null)}>
	{#if applyingExclusion}
		<p class="mb-2">
			Apply <strong>{applyingExclusion.decrypted?.name}</strong> to another device group.
		</p>
		<label for="applyGroupSelect" class="form-label">Device Group</label>
		<select id="applyGroupSelect" class="form-select mb-2" bind:value={applyGroupId}>
			<option value={null}>Select a group...</option>
			{#each applyCandidates as g (g.id)}
				<option value={g.id}>{g.name}</option>
			{/each}
		</select>
		{#if applyBlockedByE2EE}
			<div class="alert alert-warning p-2 small mb-2">
				This exclusion is end-to-end encrypted, but the selected group has no encryption keys set up or
				contains agents older than <strong>python 0.5.0</strong>.
			</div>
		{/if}
		<div class="d-flex gap-2 justify-content-end mt-3">
			<button type="button" class="btn btn-outline-secondary" onclick={() => (applyingExclusion = null)}>Cancel</button>
			<button type="button" class="btn btn-primary" disabled={!applyTarget || applyBlockedByE2EE || busy} onclick={confirmApply}>
				Apply
			</button>
		</div>
	{/if}
</Modal>
