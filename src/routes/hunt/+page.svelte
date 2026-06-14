<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { api } from '$lib/api';
	import { showError } from '$lib/store';
	import { initAgeWasm, getStoredPrivateKey } from '$lib/crypto';
	import { LogManager } from '$lib/logManager.svelte';

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
							<span class="spinner-border spinner-border-sm"></span>
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
	</div>

	<div class="row g-2">
		{#each logManager.filteredLogs as log}
			{@const alertObj = logManager.getAlertObject(log)}
			<div class="col-12">
				<div class="card mb-1 border-0 shadow-sm" style="border-radius: 8px;">
					<div class="card-body p-3 bg-dark text-light font-monospace small rounded">
						<div class="d-flex justify-content-between mb-2">
							<span class="text-info fw-bold">{new Date(log.time).toLocaleString()}</span>
							<span class="text-warning fw-bold">Device ID: {log.device_id} | Device: {alertObj.meta.device}</span>
						</div>
						<pre class="m-0" style="white-space: pre-wrap; word-break: break-all;">{@html syntaxHighlightJson(JSON.stringify(alertObj.alert, null, 2))}</pre>
					</div>
				</div>
			</div>
		{:else}
			{#if logManager.loading}
				<div class="text-center p-5 text-muted">Searching encrypted telemetry...</div>
			{:else}
				<div class="text-center p-5 text-muted">No telemetry found matching the query.</div>
			{/if}
		{/each}
	</div>
{:else}
	<div class="text-muted">Loading crypto environment...</div>
{/if}
