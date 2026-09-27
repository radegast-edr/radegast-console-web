<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';
	import { api, type Group, type Team, type ExclusionCreate } from '$lib/api';
	import { showError, showFlash } from '$lib/store';
	import { decryptExclusion, encryptExclusion } from '$lib/exclusionHelpers';
	import { initAgeWasm, getStoredPrivateKey } from '$lib/crypto';
	import { LogManager } from '$lib/logManager.svelte';
	import { formatFullDateTime, toLocalISOString, toUTCISOString } from '$lib/utils';
	import ExclusionModal from '$lib/components/ExclusionModal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import VirtualList from '$lib/components/VirtualList.svelte';

	// Parse URL hash synchronously before Svelte state initialization
	const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
	const hashParams = new URLSearchParams(initialHash.slice(1));
	const initialQ = hashParams.get('q');
	const initialFrom = hashParams.get('from');
	const initialTo = hashParams.get('to');
	const hasHashParams = !!(initialQ || initialFrom || initialTo);

	const getDefaultFromTime = () => {
		const now = new Date();
		const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
		const pad = (num: number) => String(num).padStart(2, '0');
		return `${fifteenMinutesAgo.getFullYear()}-${pad(fifteenMinutesAgo.getMonth()+1)}-${pad(fifteenMinutesAgo.getDate())}T${pad(fifteenMinutesAgo.getHours())}:${pad(fifteenMinutesAgo.getMinutes())}`;
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
	let fromTime = $state<string | null>(toLocalISOString(initialFrom) || (hasHashParams ? null : getDefaultFromTime()));
	let toTime = $state<string | null>(toLocalISOString(initialTo) || (hasHashParams ? null : getDefaultToTime()));

	// Exclusion creation from hunt
	let showExclusionModal = $state(false);
	let exclusionName = $state('');
	let exclusionQuery = $state('');
	let exclusionDescription = $state('');
	let exclusionType = $state<'hard' | 'soft'>('hard');
	let exclusionGroups = $state<Group[]>([]);
	let selectedGroupId = $state<number | null>(null);
	let exclusionEncrypted = $state(false);
	let userTeamsForPermission = $state<Team[]>([]);
	let userGroups = $state<Group[]>([]);
	let selectedLog = $state<any | null>(null);
	let currentAlertObj = $state<Record<string, unknown> | null>(null);
	let editingExclusion = $state<any>(null);
	let showTriggeredRuleModal = $state(false);

	function openRuleModal(log: any) {
		selectedLog = log;
		showTriggeredRuleModal = true;
	}

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

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let lastExecutedQuery = initialQ || '';
	let lastExecutedFrom: string | null = null;
	let lastExecutedTo: string | null = null;

	async function performHunt() {
		if (!logManager) return;
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		lastExecutedQuery = searchQuery;
		lastExecutedFrom = fromTime;
		lastExecutedTo = toTime;
		try {
			await logManager.performHuntSearch(fromTime, toTime, "informational", searchQuery);
		} catch (e) {
			showError('Hunt search failed: ' + (e as Error).message);
		}
	}

	function interruptHunt() {
		if (logManager) {
			logManager.interruptHunt();
		}
	}

	onDestroy(() => {
		if (logManager) {
			logManager.interruptHunt();
		}
	});

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

		let existingExclusion = null;
		if (alertObj.meta.excluded_by) {
			try {
				existingExclusion = await api.getExclusion(alertObj.meta.excluded_by.id);
			} catch (e) {
				console.error('Failed to load existing exclusion:', e);
			}
		}

		if (existingExclusion) {
			const decrypted = await decryptExclusion(existingExclusion, alertObj.meta.excluded_by.group.id);
			exclusionName = decrypted.name;
			exclusionQuery = decrypted.jsonata_query;
			exclusionDescription = decrypted.description;
			exclusionType = (existingExclusion.exclusion_type as 'hard' | 'soft') || 'hard';
			exclusionEncrypted = existingExclusion.encrypted || false;
			selectedGroupId = alertObj.meta.excluded_by.group.id;
			editingExclusion = existingExclusion;
		} else {
			editingExclusion = null;
			exclusionName = `Exclude ${ruleName || 'alert'}`;
			exclusionQuery = suggestedQuery;
			exclusionDescription = `Created from alert on ${new Date(log.time).toLocaleString()}`;
			if (exclusionGroups.length > 0) {
				selectedGroupId = exclusionGroups[0].id;
			} else {
				selectedGroupId = null;
			}
		}

		showExclusionModal = true;
	}

	async function saveExclusionFromHunt(): Promise<void> {
		if (!selectedGroupId || !exclusionName.trim() || !exclusionQuery.trim()) {
			showError('Group, name, and JSONata query are required');
			return;
		}

		try {
			const groupDetail = await api.getGroup(selectedGroupId);
			const { name: finalName, jsonata_query: finalQuery, description: finalDesc } = await encryptExclusion(
				exclusionName.trim(),
				exclusionQuery.trim(),
				exclusionDescription.trim() || null,
				exclusionEncrypted,
				groupDetail.public_key
			);

			const data: ExclusionCreate = {
				name: finalName,
				jsonata_query: finalQuery,
				description: finalDesc,
				alert_id: selectedLog ? selectedLog.id : null,
				exclusion_type: exclusionType,
				encrypted: exclusionEncrypted
			};

			if (editingExclusion) {
				await api.deleteExclusion(editingExclusion.id);
			}
			const newExclusion = await api.createExclusion(selectedGroupId, data);
			showExclusionModal = false;
			showFlash(editingExclusion ? 'Exclusion updated' : 'Exclusion created from alert');

			if (selectedLog && logManager) {
				const groupObj = exclusionGroups.find((g) => g.id === selectedGroupId);
				selectedLog.excluded_by = {
					id: newExclusion.id,
					group: {
						id: selectedGroupId,
						name: groupObj ? groupObj.name : 'Group'
					}
				};
				// Trigger Svelte reactivity on logs list
				logManager.logs = [...logManager.logs];
			}

			exclusionName = '';
			exclusionQuery = '';
			exclusionDescription = '';
			exclusionType = 'hard';
			selectedGroupId = null;
			exclusionEncrypted = false;
			editingExclusion = null;
		} catch (e) {
			showError('Failed to save exclusion: ' + (e as Error).message);
		}
	}

	// Re-run hunt from server when JSONata query or time range changes (debounced by 2 seconds)
	$effect(() => {
		const currentQ = searchQuery;
		const currentFrom = fromTime;
		const currentTo = toTime;
		if (!initialized || !logManager) return;
		if (currentQ === lastExecutedQuery && currentFrom === lastExecutedFrom && currentTo === lastExecutedTo) return;

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			lastExecutedQuery = currentQ;
			lastExecutedFrom = currentFrom;
			lastExecutedTo = currentTo;
			performHunt();
		}, 2000);

		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	});

	// Reactively update the URL hash when search inputs change
	$effect(() => {
		if (!initialized || typeof window === 'undefined') return;
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		if (fromTime) params.set('from', toUTCISOString(fromTime));
		if (toTime) params.set('to', toUTCISOString(toTime));
		
		const hash = params.toString();
		const newHash = hash ? `#${hash}` : '';
		if (window.location.hash !== newHash) {
			goto(window.location.pathname + window.location.search + newHash, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
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

<div class="hunt-page-wrapper">
	<div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2 flex-shrink-0">
		<div>
			<h2 class="h4 mb-0 fw-bold">Hunt Mode</h2>
			<p class="text-muted mb-0 small">Query encrypted raw telemetry across the fleet.</p>
		</div>
	</div>

	{#if logManager}
		<div class="card mb-2 border-0 shadow-sm flex-shrink-0" style="background: var(--bs-body-bg);">
			<div class="card-body py-2 px-3">
				<div class="row g-2 align-items-end">
					<div class="col-md-6 col-lg-7">
						<label for="hunt-query" class="form-label fw-bold small mb-1">JSONata Text Query</label>
						<input 
							id="hunt-query"
							type="text" 
							class="form-control form-control-sm font-monospace" 
							placeholder='e.g., meta.device = "laptop" and alert.event_type = "process"' 
							bind:value={searchQuery}
							onkeydown={(e) => { if (e.key === 'Enter') performHunt(); }}
						/>
						{#if logManager.searchError}
							<div class="text-danger small mt-1 d-flex align-items-center gap-1">
								<Icon icon="lucide:alert-triangle" /> {logManager.searchError}
							</div>
						{/if}
					</div>
					<div class="col-6 col-md-2">
						<label for="hunt-start-time" class="form-label fw-bold small mb-1">Start Time</label>
						<input id="hunt-start-time" type="datetime-local" class="form-control form-control-sm" bind:value={fromTime} />
					</div>
					<div class="col-6 col-md-2">
						<label for="hunt-end-time" class="form-label fw-bold small mb-1">End Time</label>
						<input id="hunt-end-time" type="datetime-local" class="form-control form-control-sm" bind:value={toTime} />
					</div>
					<div class="col-12 col-md-2 col-lg-1">
						{#if logManager.huntProgress.active}
							<button
								class="btn btn-danger btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
								onclick={interruptHunt}
								title="Interrupt search"
							>
								<Icon icon="lucide:square" style="font-size: 0.75rem;" /> Stop
							</button>
						{:else}
							<button class="btn btn-primary btn-sm w-100 fw-bold" onclick={performHunt}>
								Search
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>

		{#if logManager.huntProgress.active}
			<div class="card mb-2 border-0 bg-body-secondary py-2 px-3 shadow-sm flex-shrink-0" data-testid="hunt-progress">
				<div class="d-flex align-items-center gap-2 mb-1">
					<Spinner inline size="sm" />
					<span class="fw-bold small">Searching encrypted telemetry...</span>
					{#if logManager.huntProgress.pagesFetched > 0}
						<span class="badge bg-secondary-subtle text-secondary-emphasis">
							Page {logManager.huntProgress.pagesFetched}
						</span>
						<span class="text-body-secondary small">
							({logManager.huntProgress.totalFetched} event{logManager.huntProgress.totalFetched === 1 ? '' : 's'} examined)
						</span>
					{/if}
				</div>
				<div class="row g-2 small text-body-secondary pt-1 border-top border-secondary-subtle">
					<div class="col-sm-6">
						<span class="fw-semibold text-body">Earliest fetched:</span>
						<span class="font-monospace ms-1" data-testid="earliest-fetched">
							{logManager.huntProgress.earliestFetched ? formatFullDateTime(logManager.huntProgress.earliestFetched) : '—'}
						</span>
					</div>
					<div class="col-sm-6">
						<span class="fw-semibold text-body">Latest fetched:</span>
						<span class="font-monospace ms-1" data-testid="latest-fetched">
							{logManager.huntProgress.latestFetched ? formatFullDateTime(logManager.huntProgress.latestFetched) : '—'}
						</span>
					</div>
				</div>
			</div>
		{:else if logManager.huntProgress.interrupted}
			<div class="alert alert-warning d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-2 shadow-sm border-0 py-2 gap-2 flex-shrink-0" data-testid="hunt-interrupted">
				<div class="d-flex align-items-center gap-2">
					<Icon icon="lucide:alert-triangle" class="fs-5 flex-shrink-0" />
					<div class="small">
						<strong>Search interrupted.</strong> Showing results fetched before stopping.
					</div>
				</div>
				<div class="d-flex flex-wrap gap-3 small text-body-secondary">
					<div>
						<span class="fw-semibold text-body">Earliest fetched:</span>
						<span class="font-monospace ms-1">{logManager.huntProgress.earliestFetched ? formatFullDateTime(logManager.huntProgress.earliestFetched) : '—'}</span>
					</div>
					<div>
						<span class="fw-semibold text-body">Latest fetched:</span>
						<span class="font-monospace ms-1">{logManager.huntProgress.latestFetched ? formatFullDateTime(logManager.huntProgress.latestFetched) : '—'}</span>
					</div>
				</div>
			</div>
		{:else if logManager.huntProgress.pagesFetched > 0 && logManager.logs.length > 0}
			<div class="d-flex flex-wrap gap-3 mb-2 px-1 small text-body-secondary flex-shrink-0">
				<div>
					<span class="fw-semibold text-body">Earliest fetched:</span>
					<span class="font-monospace ms-1">{formatFullDateTime(logManager.huntProgress.earliestFetched)}</span>
				</div>
				<div>
					<span class="fw-semibold text-body">Latest fetched:</span>
					<span class="font-monospace ms-1">{formatFullDateTime(logManager.huntProgress.latestFetched)}</span>
				</div>
			</div>
		{/if}

		<div class="d-flex justify-content-between align-items-center mb-2 px-1 flex-shrink-0">
			<div class="text-muted small fw-semibold">
				Found {logManager.filteredLogs.length} matching event{logManager.filteredLogs.length === 1 ? '' : 's'}
				{#if logManager.huntProgress.totalFetched > logManager.filteredLogs.length}
					<span class="text-body-secondary fw-normal">({logManager.huntProgress.totalFetched} examined)</span>
				{/if}
			</div>
			{#if logManager.filteredLogs.length > 0}
				<button class="btn btn-sm btn-outline-secondary fw-bold py-0 px-2" onclick={exportToJsonl}>
					Export JSONL
				</button>
			{/if}
		</div>

		<div class="hunt-results-container">
			<VirtualList items={logManager.filteredLogs} estimatedItemHeight={180} containerHeight="100%">
				{#snippet children(log)}
					{@const alertObj = logManager?.getAlertObject(log)}
					{#if alertObj}
						<div class="card mb-2 border-0 shadow-sm">
							<div class="card-body p-3 bg-dark text-light font-monospace small rounded">
								<div class="d-flex justify-content-between mb-2">
									<span class="text-info fw-bold">{new Date(log.time).toLocaleString()}</span>
									<span class="text-warning fw-bold">
										Device ID: {log.device_id} | Device: {alertObj.meta.device}
										{#if alertObj.meta.rule_id}
											<button class="btn btn-link btn-sm text-success p-0 ms-2 fw-bold" style="vertical-align: baseline; font-size: 0.85rem;" onclick={() => openRuleModal(log)}>[show rule]</button>
										{/if}
										{#if alertObj.meta.pack?.id}
											<a href="{base}/packs/{alertObj.meta.pack.id}" class="btn btn-link btn-sm text-primary p-0 ms-2 fw-bold" style="vertical-align: baseline; font-size: 0.85rem; text-decoration: none;">[show pack]</a>
										{/if}
										{#if alertObj.meta.excluded_by}
											<button class="btn btn-link btn-sm text-info p-0 ms-2 fw-bold" style="vertical-align: baseline; font-size: 0.85rem;" onclick={() => startExclusionFromHunt(log, alertObj)}>[show exclusion]</button>
										{:else}
											<button class="btn btn-link btn-sm text-danger p-0 ms-2 fw-bold" style="vertical-align: baseline; font-size: 0.85rem;" onclick={() => startExclusionFromHunt(log, alertObj)}>[exclude]</button>
										{/if}
									</span>
								</div>
								<pre class="m-0" style="white-space: pre-wrap; word-break: break-all;">{@html syntaxHighlightJson(JSON.stringify(alertObj, null, 2))}</pre>
							</div>
						</div>
					{/if}
				{/snippet}
				{#snippet empty()}
					{#if logManager?.huntProgress.active}
						<div class="text-center p-5 text-muted">
							<Spinner centered text="Searching encrypted telemetry..." py={3} />
						</div>
					{:else}
						<div class="text-center p-5 text-muted">No telemetry found matching the query.</div>
					{/if}
				{/snippet}
			</VirtualList>
		</div>

		<ExclusionModal
			bind:show={showExclusionModal}
			bind:name={exclusionName}
			bind:query={exclusionQuery}
			bind:description={exclusionDescription}
			bind:exclusionType={exclusionType}
			bind:encrypted={exclusionEncrypted}
			title={editingExclusion ? 'Edit Exclusion' : 'Create Exclusion'}
			isEditMode={!!editingExclusion}
			groups={exclusionGroups}
			bind:selectedGroupId={selectedGroupId}
			alertObj={currentAlertObj}
			onClose={() => { showExclusionModal = false; editingExclusion = null; }}
			onSave={saveExclusionFromHunt}
		/>

		<!-- Triggered Rule Modal -->
		{#if selectedLog?.triggered_rule}
			<Modal
				show={showTriggeredRuleModal}
				title="Triggered Rule"
				onClose={() => { showTriggeredRuleModal = false; }}
			>
				<div class="mb-2 d-flex gap-2 align-items-center">
					<span class="badge bg-warning text-dark text-uppercase">{selectedLog.triggered_rule.rule_type}</span>
					<span class="fw-bold text-body font-monospace small">{selectedLog.triggered_rule.rule_id}</span>
				</div>
				<pre class="p-3 rounded font-monospace mb-0" style="background-color: #282a36; color: #f8f8f2; white-space: pre-wrap; word-break: break-all; font-size: 0.82rem; border: 1px solid #44475a; max-height: 60vh; overflow-y: auto;">{selectedLog.triggered_rule.rule_content}</pre>
			</Modal>
		{/if}
	{:else}
		<Spinner centered text="Loading crypto environment..." py={5} />
	{/if}
</div>

<style>
	@media (min-width: 768px) {
		.hunt-page-wrapper {
			display: flex;
			flex-direction: column;
			height: calc(100vh - 48px);
			max-height: calc(100vh - 48px);
			overflow: hidden;
		}
		.hunt-results-container {
			flex: 1 1 0;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
	}
	@media (max-width: 767.98px) {
		.hunt-page-wrapper {
			display: flex;
			flex-direction: column;
		}
		.hunt-results-container {
			height: calc(100vh - 300px);
			min-height: 350px;
			display: flex;
			flex-direction: column;
		}
	}
</style>
