<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api, type Pack, type Team, type PackVersion } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let packs = $state<Pack[]>([]);
	let teams = $state<Team[]>([]);
	let showCreate = $state(false);

	// Filter state
	let searchQuery = $state('');
	let statusFilters = $state<string[]>(['stable']);
	let osFilters = $state<string[]>([]);
	let fpFilters = $state<string[]>(['low']);
	let levelFilters = $state<string[]>(['essential']);

	// Available filter options (extracted from packs data)
	let allStatuses = $state<string[]>([]);
	let allOS = $state<string[]>([]);
	let allFPLevels = $state<string[]>([]);
	let allLevels = $state<string[]>([]);

	// Track if filters are open
	let showStatusDropdown = $state(false);
	let showOSDropdown = $state(false);
	let showFPDropdown = $state(false);
	let showLevelDropdown = $state(false);

	// Derived: filtered packs
	let filteredPacks = $derived(
		packs.filter((pack) => {
			// Full-text search (match all if empty)
			const searchLower = searchQuery.toLowerCase();
			const matchesSearch = !searchLower ||
				pack.name.toLowerCase().includes(searchLower) ||
				(pack.description?.toLowerCase().includes(searchLower) ?? false) ||
				(pack.latest?.meta?.description?.toString().toLowerCase().includes(searchLower) ?? false);

			// Status filter (match all if no filters)
			const packStatus = pack.latest?.meta?.status?.toString().toLowerCase();
			const matchesStatus = statusFilters.length === 0 || (packStatus && statusFilters.some((f) => f.toLowerCase() === packStatus));

			// OS filter (match all if no filters)
			const packOS = pack.latest?.meta?.os?.toString().toLowerCase();
			const matchesOS = osFilters.length === 0 || (packOS && osFilters.some((f) => f.toLowerCase() === packOS));

			// False Positive filter (match all if no filters)
			const packFP = pack.latest?.meta?.expected_false_positive_level?.toString().toLowerCase();
			const matchesFP = fpFilters.length === 0 || (packFP && fpFilters.some((f) => f.toLowerCase() === packFP));

			// Level filter (match all if no filters)
			const packLevel = pack.latest?.meta?.level?.toString().toLowerCase();
			const matchesLevel = levelFilters.length === 0 || (packLevel && levelFilters.some((f) => f.toLowerCase() === packLevel));

			return matchesSearch && matchesStatus && matchesOS && matchesFP && matchesLevel;
		}).sort((a, b) => {
			const isPrivateA = a.team_ids && a.team_ids.length > 0;
			const isPrivateB = b.team_ids && b.team_ids.length > 0;
			if (isPrivateA !== isPrivateB) {
				return isPrivateA ? -1 : 1;
			}

			const getNameOrder = (name: string) => {
				if (name.toLowerCase().startsWith('radegast')) {
					return 1;
				}
				if (name.toLowerCase().startsWith('rustinel')) {
					return 2;
				}
				return 3;
			}
			const nameOrderA = getNameOrder(a.name);
			const nameOrderB = getNameOrder(b.name);
			if (nameOrderA !== nameOrderB) {
				return nameOrderA - nameOrderB;
			}

			const getLevelOrder = (level: any) => {
				if (!level) return 4;
				const l = String(level).toLowerCase();
				if (l === 'essential') return 1;
				if (l === 'advanced') return 2;
				if (l === 'hunting') return 3;
				return 4;
			};
			const levelOrderA = getLevelOrder(a.latest?.meta?.level);
			const levelOrderB = getLevelOrder(b.latest?.meta?.level);
			if (levelOrderA !== levelOrderB) {
				return levelOrderA - levelOrderB;
			}

			const getStatusOrder = (status: any) => {
				if (!status) return 5;
				const s = String(status).toLowerCase();
				if (s === 'stable') return 1;
				if (s === 'beta') return 2;
				if (s === 'testing') return 3;
				if (s === 'experimental') return 4;
				return 5;
			};
			const statusOrderA = getStatusOrder(a.latest?.meta?.status);
			const statusOrderB = getStatusOrder(b.latest?.meta?.status);
			if (statusOrderA !== statusOrderB) {
				return statusOrderA - statusOrderB;
			}

			const getFpOrder = (fp: any) => {
				if (!fp) return 4;
				const f = String(fp).toLowerCase();
				if (f === 'low') return 1;
				if (f === 'medium') return 2;
				if (f === 'high') return 3;
				return 4;
			};
			const fpOrderA = getFpOrder(a.latest?.meta?.expected_false_positive_level);
			const fpOrderB = getFpOrder(b.latest?.meta?.expected_false_positive_level);
			if (fpOrderA !== fpOrderB) {
				return fpOrderA - fpOrderB;
			}

			return a.name.localeCompare(b.name);
		})
	);

	// Sync filters with URL params and localStorage
	function syncFiltersToUrl(): void {
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (statusFilters.length > 0) params.set('status', statusFilters.join(','));
		if (osFilters.length > 0) params.set('os', osFilters.join(','));
		if (fpFilters.length > 0) params.set('fp', fpFilters.join(','));
		if (levelFilters.length > 0) params.set('level', levelFilters.join(','));

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('pack_filters', JSON.stringify({
				search: searchQuery,
				status: statusFilters,
				os: osFilters,
				fp: fpFilters,
				level: levelFilters
			}));
		}

		goto(`${base}/packs?${params.toString()}`, { replaceState: true, keepFocus: true });
	}

	function parseArrayParam(param: string | null): string[] {
		if (!param) return [];
		return param.split(',').filter((s) => s);
	}

	function loadFiltersFromUrl(): void {
		const urlParams = $page.url.searchParams;

		let savedFilters: any = {};
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('pack_filters');
			if (saved) {
				try {
					savedFilters = JSON.parse(saved) || {};
				} catch {
					savedFilters = {};
				}
			}
		}

		const getArrayVal = (paramName: string, savedVal: any, defaultValue: string[]): string[] => {
			if (urlParams.has(paramName)) {
				return parseArrayParam(urlParams.get(paramName));
			}
			return Array.isArray(savedVal) ? savedVal : defaultValue;
		};

		// 1. Search Query
		if (urlParams.has('search')) {
			searchQuery = urlParams.get('search') || '';
		} else {
			searchQuery = typeof savedFilters.search === 'string' ? savedFilters.search : '';
		}

		// 2. Status Filters
		statusFilters = getArrayVal('status', savedFilters.status, ['stable']);

		// 3. OS Filters
		osFilters = getArrayVal('os', savedFilters.os, []);

		// 4. FP Filters
		fpFilters = getArrayVal('fp', savedFilters.fp, ['low']);

		// 5. Level Filters
		levelFilters = getArrayVal('level', savedFilters.level, ['essential']);
	}

	// Extract unique filter options from packs
	function extractFilterOptions(packsList: Pack[]): void {
		const statuses = new Set<string>();
		const osSet = new Set<string>();
		const fpSet = new Set<string>();
		const levelSet = new Set<string>();

		for (const pack of packsList) {
			if (pack.latest?.meta?.status) {
				const status = String(pack.latest.meta.status);
				if (status) statuses.add(status);
			}
			if (pack.latest?.meta?.os) {
				const os = String(pack.latest.meta.os);
				if (os) osSet.add(os);
			}
			if (pack.latest?.meta?.expected_false_positive_level) {
				const fp = String(pack.latest.meta.expected_false_positive_level);
				if (fp) fpSet.add(fp);
			}
			if (pack.latest?.meta?.level) {
				const lvl = String(pack.latest.meta.level);
				if (lvl) levelSet.add(lvl);
			}
		}

		allStatuses = Array.from(statuses).sort();
		allOS = Array.from(osSet).sort();
		allFPLevels = Array.from(fpSet).sort();
		allLevels = Array.from(levelSet).sort();
	}

	// Toggle filter selections
	function toggleStatus(status: string): void {
		statusFilters = statusFilters.includes(status)
			? statusFilters.filter((s) => s !== status)
			: [...statusFilters, status];
		syncFiltersToUrl();
	}

	function toggleOS(os: string): void {
		osFilters = osFilters.includes(os)
			? osFilters.filter((o) => o !== os)
			: [...osFilters, os];
		syncFiltersToUrl();
	}

	function toggleFP(fp: string): void {
		fpFilters = fpFilters.includes(fp)
			? fpFilters.filter((f) => f !== fp)
			: [...fpFilters, fp];
		syncFiltersToUrl();
	}

	function toggleLevel(level: string): void {
		levelFilters = levelFilters.includes(level)
			? levelFilters.filter((l) => l !== level)
			: [...levelFilters, level];
		syncFiltersToUrl();
	}

	function clearFilters(): void {
		searchQuery = '';
		statusFilters = [];
		osFilters = [];
		fpFilters = [];
		levelFilters = [];
		syncFiltersToUrl();
	}

	function handleSearchKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			syncFiltersToUrl();
		}
	}

	// Close dropdowns when clicking outside or when URL changes
	function closeAllDropdowns(): void {
		showStatusDropdown = false;
		showOSDropdown = false;
		showFPDropdown = false;
		showLevelDropdown = false;
	}

	// Close dropdowns when URL changes (filters applied)
	$effect(() => {
		const _ = $page.url;
		closeAllDropdowns();
	});

	// Handle click outside to close dropdowns
	// Using a flag to prevent immediate closure on dropdown button click
	let ignoreNextClick = false;
	
	$effect(() => {
		const handleClick = (event: MouseEvent) => {
			if (ignoreNextClick) {
				ignoreNextClick = false;
				return;
			}
			const target = event.target as HTMLElement;
			const isDropdownClick = target.closest('.dropdown');
			if (isDropdownClick) {
				// Let the dropdown button handler handle it
				return;
			}
			closeAllDropdowns();
		};
		// Add capture phase listener to handle clicks before they bubble
		window.addEventListener('click', handleClick, true);
		return () => window.removeEventListener('click', handleClick, true);
	});

	function toggleDropdown(dropdown: 'status' | 'os' | 'fp' | 'level'): void {
		const wasOpen = dropdown === 'status' ? showStatusDropdown :
			               dropdown === 'os' ? showOSDropdown :
			               dropdown === 'fp' ? showFPDropdown : showLevelDropdown;
		closeAllDropdowns();
		if (!wasOpen) {
			if (dropdown === 'status') showStatusDropdown = true;
			if (dropdown === 'os') showOSDropdown = true;
			if (dropdown === 'fp') showFPDropdown = true;
			if (dropdown === 'level') showLevelDropdown = true;
		}
		ignoreNextClick = true;
	}

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
		loadFiltersFromUrl();
		await Promise.all([loadPacks(), loadTeams()]);
		extractFilterOptions(packs);
	});

	async function loadPacks(): Promise<void> {
		try {
			packs = await api.listPacks();
		} catch (e) {
			showError(e instanceof Error ? e.message : String(e));
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
			showError(e instanceof Error ? e.message : String(e));
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
			showError(e instanceof Error ? e.message : String(e));
		}
	}

	async function openVersions(pack: Pack): Promise<void> {
		versionsPackName = pack.name;
		packVersions = [];
		loadingVersions = true;
		showVersions = true;
		try {
			packVersions = await api.listVersions(pack.id);
		} catch (e) {
			showError(e instanceof Error ? e.message : String(e));
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
			showError(e instanceof Error ? e.message : String(e));
		}
	}
</script>

<svelte:window onclick={(e) => { const target = e.target as HTMLElement; if (!target.closest('.dropdown')) closeAllDropdowns(); }} />

<svelte:head>
	<title>Packs - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2>Packs</h2>
	{#if canCreate}
		<button class="btn btn-primary" onclick={() => (showCreate = true)}>Create Pack</button>
	{/if}
</div>

<!-- Filter Bar -->
<div class="card mb-4 shadow-sm">
	<div class="card-body">
		<div class="row g-3">
			<div class="col-12">
				<label for="searchInput" class="form-label fw-semibold small">Search</label>
				<div class="input-group">
					<input
						type="text"
						class="form-control"
						id="searchInput"
						bind:value={searchQuery}
						oninput={syncFiltersToUrl}
						onkeydown={handleSearchKeyDown}
						placeholder="Search packs by name or description..."
					/>
					{#if searchQuery}
						<button class="btn btn-outline-secondary" type="button" onclick={() => { searchQuery = ''; syncFiltersToUrl(); }}>
							×
						</button>
					{/if}
				</div>
			</div>
			<div class="col-12 d-flex gap-3 flex-wrap">
				<!-- Status Dropdown -->
				<div class="dropdown" style="min-width: 140px;">
					<span class="form-label fw-semibold small d-block">Status</span>
					<button
						class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-between dropdown-toggle {showStatusDropdown ? 'show' : ''}"
						onclick={(e) => { e.stopPropagation(); toggleDropdown('status'); }}
						aria-expanded={showStatusDropdown}
					>
						<span>
							{#if statusFilters.length > 0}
								{statusFilters.join(', ')}
							{:else}
								All Statuses
							{/if}
						</span>
					</button>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="dropdown-menu w-100 pack-tags {showStatusDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
						{#each allStatuses as status}
							<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
								<input
									type="checkbox"
									checked={statusFilters.includes(status)}
									onchange={() => toggleStatus(status)}
								/>
								<span class="badge rounded-pill bg-secondary status-{status.toLowerCase()}">
									{status}
								</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- OS Dropdown -->
				<div class="dropdown" style="min-width: 120px;">
					<span class="form-label fw-semibold small d-block">OS</span>
					<button
						class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-between dropdown-toggle {showOSDropdown ? 'show' : ''}"
						onclick={(e) => { e.stopPropagation(); toggleDropdown('os'); }}
						aria-expanded={showOSDropdown}
					>
						<span>
							{#if osFilters.length > 0}
								{osFilters.join(', ')}
							{:else}
								All OS
							{/if}
						</span>
					</button>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="dropdown-menu w-100 pack-tags {showOSDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
						{#each allOS as os}
							<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
								<input
									type="checkbox"
									checked={osFilters.includes(os)}
									onchange={() => toggleOS(os)}
								/>
								<span class="badge rounded-pill bg-secondary os-{os.toLowerCase()}">
									{os}
								</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- False Positive Dropdown -->
				<div class="dropdown" style="min-width: 150px;">
					<span class="form-label fw-semibold small d-block">False Positive Rate</span>
					<button
						class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-between dropdown-toggle {showFPDropdown ? 'show' : ''}"
						onclick={(e) => { e.stopPropagation(); toggleDropdown('fp'); }}
						aria-expanded={showFPDropdown}
					>
						<span>
							{#if fpFilters.length > 0}
								{fpFilters.join(', ')}
							{:else}
								All FP Rates
							{/if}
						</span>
					</button>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="dropdown-menu w-100 pack-tags {showFPDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
						{#each allFPLevels as fp}
							<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
								<input
									type="checkbox"
									checked={fpFilters.includes(fp)}
									onchange={() => toggleFP(fp)}
								/>
								<span class="badge rounded-pill bg-secondary fp-{fp.toLowerCase()}">
									{fp}
								</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Level Dropdown -->
				<div class="dropdown" style="min-width: 140px;">
					<span class="form-label fw-semibold small d-block">Level</span>
					<button
						class="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-between dropdown-toggle {showLevelDropdown ? 'show' : ''}"
						onclick={(e) => { e.stopPropagation(); toggleDropdown('level'); }}
						aria-expanded={showLevelDropdown}
					>
						<span>
							{#if levelFilters.length > 0}
								{levelFilters.join(', ')}
							{:else}
								All Levels
							{/if}
						</span>
					</button>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="dropdown-menu w-100 pack-tags {showLevelDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
						{#each allLevels as level}
							<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
								<input
									type="checkbox"
									checked={levelFilters.includes(level)}
									onchange={() => toggleLevel(level)}
								/>
								<span class="badge rounded-pill bg-secondary level-{level.toLowerCase()}">
									{level}
								</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Clear Filters Button -->
				{#if searchQuery || statusFilters.length > 0 || osFilters.length > 0 || fpFilters.length > 0 || levelFilters.length > 0}
					<div class="d-flex align-items-end mt-2">
						<button class="btn btn-outline-danger" onclick={clearFilters}>
							Clear Filters
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="row">
	{#each filteredPacks as pack}
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
							<span class="badge rounded-pill bg-secondary os-{pack.latest.meta.os.toString().toLowerCase()}"
							>
								OS: {pack.latest.meta.os}
							</span>
						{/if}
						{#if pack.latest?.meta?.status}
							<span class="badge rounded-pill bg-secondary status-{pack.latest.meta.status.toString().toLowerCase()}">
								Status: {pack.latest.meta.status}
							</span>
						{/if}
						{#if pack.latest?.meta?.expected_false_positive_level}
							<span class="badge rounded-pill bg-secondary fp-{pack.latest.meta.expected_false_positive_level.toString().toLowerCase()}">
								FP: {pack.latest.meta.expected_false_positive_level}
							</span>
						{/if}
						{#if pack.latest?.meta?.level}
							<span class="badge rounded-pill bg-secondary level-{pack.latest.meta.level.toString().toLowerCase()}">
								Level: {pack.latest.meta.level}
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
		<Spinner centered text="Loading versions..." py={4} />
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
		.os-any {
			background: var(--bs-success) !important;
		}
		.status-experimental {
			background: var(--bs-danger) !important;
		}
		.status-stable {
			background: var(--bs-success) !important;
		}
		.status-beta {
			background: var(--bs-info) !important;
		}
		.status-testing {
			background: var(--bs-info) !important;
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
		.level-essential {
			background: var(--bs-primary) !important;
		}
		.level-advanced {
			background: var(--bs-warning) !important;
		}
		.level-hunting {
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
