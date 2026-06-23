<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { api, type Group, type Team, type ExclusionCreate } from '$lib/api';
	import { showError, showFlash } from '$lib/store';
	import { initAgeWasm, getStoredPrivateKey } from '$lib/crypto';
	import { LogManager } from '$lib/logManager.svelte';
	import ExclusionModal from '$lib/components/ExclusionModal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	// Parse URL hash synchronously before Svelte state initialization
	const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
	const hashParams = new URLSearchParams(initialHash.slice(1));
	const initialQ = hashParams.get('q');
	const initialFrom = hashParams.get('from');
	const initialTo = hashParams.get('to');
	const hasHashParams = !!(initialQ || initialFrom || initialTo);

	const getDefaultFromTime = () => {
		const now = new Date();
		const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const pad = (num: number) => String(num).padStart(2, '0');
		return `${yesterday.getFullYear()}-${pad(yesterday.getMonth()+1)}-${pad(yesterday.getDate())}T${pad(yesterday.getHours())}:${pad(yesterday.getMinutes())}`;
	};

	const getDefaultToTime = () => {
		const now = new Date();
		const pad = (num: number) => String(num).padStart(2, '0');
		return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
	};

	let initialized = $state(false);
	let logManager = $state<LogManager | null>(null);
	let privateKey = $state<string | null>(null);

	let searchQuery = $state(initialQ || '');
	let fromTime = $state<string | null>(initialFrom || (hasHashParams ? null : getDefaultFromTime()));
	let toTime = $state<string | null>(initialTo || (hasHashParams ? null : getDefaultToTime()));

	// Exclusion creation from hunt
	let showExclusionModal = $state(false);
	let exclusionName = $state('');
	let exclusionQuery = $state('');
	let exclusionDescription = $state('');
	let exclusionType = $state<'hard' | 'soft'>('hard');
	let exclusionGroups = $state<Group[]>([]);
	let selectedGroupId = $state<number | null>(null);
	let userTeamsForPermission = $state<Team[]>([]);
	let userGroups = $state<Group[]>([]);
	let selectedLog = $state<any | null>(null);
	let currentAlertObj = $state<Record<string, unknown> | null>(null);

	onMount(async () => {
		try {
			await initAgeWasm();
			const me = await api.me();
			if (!me.extended_edr_enabled) {
				goto(`${base}/`);
				return;
			}
			privateKey = await getStoredPrivateKey(me.id);
			
			logManager = new LogManager(privateKey);
			
			const devicesData = await api.listDevices();
			logManager.setDevices(devicesData);
			
			// Load user teams and groups for exclusion creation
			userTeamsForPermission = await api.listTeams();
			userGroups = await api.listGroups();
			
			await performHunt();
			initialized = true;
		} catch (e) {
			showError('Failed to initialize Hunt Mode: ' + (e as Error).message);
		}
	});

	async function performHunt() {
		if (!logManager) return;
		try {
			await logManager.performSearch(fromTime, toTime, "informational");
			await logManager.runFilter(searchQuery);
		} catch (e) {
			showError('Hunt search failed: ' + (e as Error).message);
		}
	}

	async function startExclusionFromHunt(log: any, alertObj: any): Promise<void> {
		selectedLog = log;
		try {
			// Fetch device to get its groups
			const deviceDetail = await api.getDevice(log.device_id);
			
			const deviceGroupIds = new Set(deviceDetail.groups.map(g => g.id));
			
			// Fetch full group details for permission checking
			const groupDetails = await Promise.all(
				userGroups.filter(g => deviceGroupIds.has(g.id)).map(g => api.getGroup(g.id))
			);

			const permittedGroups = groupDetails.filter((g) => {
				return (g.teams ?? []).some((teamInGroup) => {
					return (
						teamInGroup.permission_pack === 'write' &&
						userTeamsForPermission.some((userTeam) => userTeam.id === teamInGroup.id)
					);
				});
			});

			if (permittedGroups.length === 0) {
				showError('You do not have pack write permissions on any group this device belongs to.');
				return;
			}

			exclusionGroups = permittedGroups;
		} catch (e) {
			showError('Failed to verify permissions: ' + (e as Error).message);
			return;
		}

		currentAlertObj = typeof alertObj.alert === 'object' && alertObj.alert !== null
			? (alertObj.alert as Record<string, unknown>)
			: null;

		const ruleName = currentAlertObj?.['rule.name'] as string | undefined;
		let suggestedQuery = '';

		if (ruleName) {
			suggestedQuery = `\`rule.name\` = '${ruleName.replace(/'/g, "\\'")}'`;
		} else if (currentAlertObj) {
			const firstKey = Object.keys(currentAlertObj)[0];
			if (firstKey) {
				const firstValue = currentAlertObj[firstKey];
				suggestedQuery = typeof firstValue === 'string'
					? `\`${firstKey}\` = '${firstValue.replace(/'/g, "\\'")}'`
					: `$exists(\`${firstKey}\`)`;
			}
		}

		exclusionName = `Exclude ${ruleName || 'alert'}`;
		exclusionQuery = suggestedQuery;
		exclusionDescription = `Created from alert on ${new Date(log.time).toLocaleString()}`;

		if (exclusionGroups.length > 0) {
			selectedGroupId = exclusionGroups[0].id;
		} else {
			selectedGroupId = null;
		}

		showExclusionModal = true;
	}

	async function saveExclusionFromHunt(): Promise<void> {
		if (!selectedGroupId || !exclusionName.trim() || !exclusionQuery.trim()) {
			showError('Group, name, and JSONata query are required');
			return;
		}

		try {
			const data: ExclusionCreate = {
				name: exclusionName.trim(),
				jsonata_query: exclusionQuery.trim(),
				description: exclusionDescription.trim() || null,
				alert_id: selectedLog ? selectedLog.id : null,
				exclusion_type: exclusionType
			};

			await api.createExclusion(selectedGroupId, data);
			showExclusionModal = false;
			showFlash('Exclusion created from alert');

			exclusionName = '';
			exclusionQuery = '';
			exclusionDescription = '';
			exclusionType = 'hard';
			selectedLog = null;
			currentAlertObj = null;
		} catch (e) {
			showError('Failed to create exclusion: ' + (e as Error).message);
		}
	}

	$effect(() => {
		if (logManager) {
			const _ = logManager.logs;
			logManager.runFilter(searchQuery);
		}
	});

	// Reactively update the URL hash when search inputs change
	$effect(() => {
		if (!initialized || typeof window === 'undefined') return;
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		if (fromTime) params.set('from', fromTime);
		if (toTime) params.set('to', toTime);
		
		const hash = params.toString();
		const newHash = hash ? `#${hash}` : '';
		if (window.location.hash !== newHash) {
			window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
		}
	});

	function syntaxHighlightJson(json: string): string {
		if (!json) return '';
		const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return escaped.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
			(match) => {
				let cls = 'number';
				if (match.startsWith('"')) {
					if (match.endsWith(':')) cls = 'key';
					else cls = 'string';
				} else if (match === 'true' || match === 'false') cls = 'boolean';
				else if (match === 'null') cls = 'null';

				if (cls === 'key') return `<span style="color: #ff79c6; font-weight: bold;">${match}</span>`;
				else if (cls === 'string') return `<span style="color: #f1fa8c;">${match}</span>`;
				else if (cls === 'number') return `<span style="color: #bd93f9;">${match}</span>`;
				else if (cls === 'boolean') return `<span style="color: #50fa7b; font-weight: bold;">${match}</span>`;
				else return `<span style="color: #6272a4;">${match}</span>`;
			}
		);
	}
	function exportToJsonl() {
		const lm = logManager;
		if (!lm) return;
		const lines = lm.filteredLogs.map(log => {
			const alertObj = lm.getAlertObject(log);
			return JSON.stringify(alertObj);
		});
		const blob = new Blob([lines.join('\n')], { type: 'application/x-jsonlines' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `hunt_export_${new Date().toISOString().slice(0, 10)}.jsonl`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Hunt Mode - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
	<div>
		<h2 class="mb-0 fw-bold">Hunt Mode</h2>
		<p class="text-muted mb-0">Query encrypted raw telemetry across the fleet.</p>
	</div>
</div>

{#if logManager}
	<div class="card mb-4 border-0 shadow-sm" style="border-radius: 12px; background: var(--bs-body-bg);">
		<div class="card-body p-4">
			<div class="row g-3">
				<div class="col-md-7">
					<label for="hunt-query" class="form-label fw-bold">JSONata Text Query</label>
					<input 
						id="hunt-query"
						type="text" 
						class="form-control font-monospace" 
						placeholder='e.g., meta.device = "laptop" and alert.event_type = "process"' 
						bind:value={searchQuery}
					/>
					{#if logManager.searchError}
						<div class="text-danger small mt-1">⚠️ {logManager.searchError}</div>
					{/if}
				</div>
				<div class="col-md-2">
					<label for="hunt-start-time" class="form-label fw-bold">Start Time</label>
					<input id="hunt-start-time" type="datetime-local" class="form-control" bind:value={fromTime} />
				</div>
				<div class="col-md-2">
					<label for="hunt-end-time" class="form-label fw-bold">End Time</label>
					<input id="hunt-end-time" type="datetime-local" class="form-control" bind:value={toTime} />
				</div>
				<div class="col-md-1 d-flex align-items-end">
					<button class="btn btn-primary w-100 fw-bold" onclick={performHunt} disabled={logManager.loading}>
						{#if logManager.loading}
							<Spinner inline size="sm" color="light" />
						{:else}
							Search
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="d-flex justify-content-between align-items-center mb-2 px-1">
		<div class="text-muted small fw-semibold">
			Found {logManager.filteredLogs.length} matching event{logManager.filteredLogs.length === 1 ? '' : 's'}
		</div>
		{#if logManager.filteredLogs.length > 0}
			<button class="btn btn-sm btn-outline-secondary fw-bold" onclick={exportToJsonl}>
				Export JSONL
			</button>
		{/if}
	</div>

	<div class="row g-2">
		{#each logManager.filteredLogs as log}
			{@const alertObj = logManager.getAlertObject(log)}
			<div class="col-12">
				<div class="card mb-1 border-0 shadow-sm" style="border-radius: 8px;">
					<div class="card-body p-3 bg-dark text-light font-monospace small rounded">
						<div class="d-flex justify-content-between mb-2">
							<span class="text-info fw-bold">{new Date(log.time).toLocaleString()}</span>
							<span class="text-warning fw-bold">
								Device ID: {log.device_id} | Device: {alertObj.meta.device}
								<button class="btn btn-link btn-sm text-danger p-0 ms-2 fw-bold" style="vertical-align: baseline; font-size: 0.85rem;" onclick={() => startExclusionFromHunt(log, alertObj)}>[exclude]</button>
							</span>
						</div>
						<pre class="m-0" style="white-space: pre-wrap; word-break: break-all;">{@html syntaxHighlightJson(JSON.stringify(alertObj, null, 2))}</pre>
					</div>
				</div>
			</div>
		{:else}
			{#if logManager.loading}
				<Spinner centered text="Searching encrypted telemetry..." py={5} />
			{:else}
				<div class="text-center p-5 text-muted">No telemetry found matching the query.</div>
			{/if}
		{/each}
	</div>

	<ExclusionModal
		bind:show={showExclusionModal}
		bind:name={exclusionName}
		bind:query={exclusionQuery}
		bind:description={exclusionDescription}
		bind:exclusionType={exclusionType}
		title="Create Exclusion"
		isEditMode={false}
		groups={exclusionGroups}
		bind:selectedGroupId={selectedGroupId}
		alertObj={currentAlertObj}
		onClose={() => (showExclusionModal = false)}
		onSave={saveExclusionFromHunt}
	/>
{:else}
	<Spinner centered text="Loading crypto environment..." py={5} />
{/if}
