<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type Log, type Device } from '$lib/api';
	import { showError } from '$lib/store';
	import { initAgeWasm, getStoredPrivateKey, decrypt } from '$lib/crypto';
	import { isDeviceActive, formatFullDateTime, preprocessQuery, matchesJsonata, mapSeverityToNumber } from '$lib/utils';
	import jsonata from 'jsonata';

	interface DecryptionResult {
		success: boolean;
		parsed?: any;
		error?: string;
	}

	let logs = $state<Log[]>([]);
	let decryptionState = $state<Record<string | number, DecryptionResult>>({});
	let privateKey = $state<string | null>(null);
	let loading = $state(true);
	let isSearching = $state(false);
	let devices = $state<Device[]>([]);
	let deviceMap = $derived(new Map<number, Device>(devices.map(d => [d.id, d])));

	let searchQuery = $state('');
	let searchError = $state('');
	let filteredLogs = $state<Log[]>([]);

	let isFilterExpanded = $state(false);

	function formatForDateTimeLocal(date: Date): string {
		const pad = (num: number) => String(num).padStart(2, '0');
		const yyyy = date.getFullYear();
		const mm = pad(date.getMonth() + 1);
		const dd = pad(date.getDate());
		const hh = pad(date.getHours());
		const min = pad(date.getMinutes());
		return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
	}

	// Capture default initial datetime values (last 4 days and now)
	const initialFrom = formatForDateTimeLocal(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000));
	const initialTo = formatForDateTimeLocal(new Date());

	let fromTime = $state(initialFrom);
	let toTime = $state(initialTo);

	// Filter is active if query is not empty or datetime differs from default
	let isFilterActive = $derived(
		searchQuery.trim() !== '' ||
		fromTime !== initialFrom ||
		toTime !== initialTo
	);

	function getAlertObject(log: Log): any {
		const devObj = deviceMap.get(log.device_id);
		const deviceName = devObj ? devObj.name : `Device #${log.device_id}`;
		let status = 'offline';
		let last_seen: string | undefined = undefined;
		if (devObj) {
			if (isDeviceActive(devObj.last_seen)) {
				status = 'online';
			} else {
				status = 'offline';
				last_seen = formatFullDateTime(devObj.last_seen);
			}
		}

		const reported_timestamp = new Date(log.time).toISOString();

		const decState = decryptionState[log.id];
		if (!decState) {
			let alertVal = 'encrypted alert';
			if (privateKey) {
				alertVal = 'decrypting...';
			}
			const meta: any = {
				alert_id: log.id,
				reported_timestamp: reported_timestamp,
				device: deviceName,
				status: status
			};
			if (last_seen !== undefined) {
				meta.last_seen = last_seen;
			}
			return {
				meta,
				alert: alertVal
			};
		}

		if (decState.success) {
			const meta: any = {
				alert_id: log.id,
				reported_timestamp: reported_timestamp,
				device: deviceName,
				status: status
			};
			if (last_seen !== undefined) {
				meta.last_seen = last_seen;
			}
			if (decState.parsed && typeof decState.parsed === 'object' && decState.parsed.severity !== undefined) {
				meta.severity_number = mapSeverityToNumber(decState.parsed.severity);
			}
			return {
				meta,
				alert: decState.parsed
			};
		} else {
			return {
				meta: {
					alert_id: log.id,
					reported_timestamp: reported_timestamp
				},
				alert: `decrpytion failed: ${decState.error}`
			};
		}
	}

	function syntaxHighlightJson(json: string): string {
		if (!json) return '';
		const escaped = json
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		
		return escaped.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
			(match) => {
				let cls = 'number';
				if (match.startsWith('"')) {
					if (match.endsWith(':')) {
						cls = 'key';
					} else {
						cls = 'string';
					}
				} else if (match === 'true' || match === 'false') {
					cls = 'boolean';
				} else if (match === 'null') {
					cls = 'null';
				}

				if (cls === 'key') {
					return `<span style="color: #ff79c6; font-weight: bold;">${match}</span>`;
				} else if (cls === 'string') {
					return `<span style="color: #f1fa8c;">${match}</span>`;
				} else if (cls === 'number') {
					return `<span style="color: #bd93f9;">${match}</span>`;
				} else if (cls === 'boolean') {
					return `<span style="color: #50fa7b; font-weight: bold;">${match}</span>`;
				} else {
					return `<span style="color: #6272a4;">${match}</span>`;
				}
			}
		);
	}

	$effect(() => {
		async function runFilter() {
			if (!searchQuery.trim()) {
				filteredLogs = logs;
				searchError = '';
				return;
			}

			try {
				const processed = preprocessQuery(searchQuery);
				jsonata(processed); // Validate query syntax
				searchError = '';
			} catch (e) {
				searchError = (e as Error).message;
				return;
			}

			const matches = await Promise.all(
				logs.map(async (log) => {
					const obj = getAlertObject(log);
					return await matchesJsonata(obj, searchQuery);
				})
			);

			filteredLogs = logs.filter((_, idx) => matches[idx]);
		}

		runFilter();
	});

	// Record search settings in the URL fragment
	$effect(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams();
			if (searchQuery) params.set('q', searchQuery);
			if (fromTime && fromTime !== initialFrom) params.set('from', fromTime);
			if (toTime && toTime !== initialTo) params.set('to', toTime);

			const hash = params.toString();
			if (hash) {
				window.location.hash = hash;
			} else {
				history.replaceState(null, '', window.location.pathname + window.location.search);
			}
		}
	});

	async function performSearch(): Promise<void> {
		isSearching = true;
		loading = true;
		logs = [];
		decryptionState = {};

		const fromUtc = fromTime ? new Date(fromTime).toISOString() : null;
		const toUtc = toTime ? new Date(toTime).toISOString() : null;

		try {
			let currentPage = 1;
			let hasMore = true;
			const limitVal = 100;

			while (hasMore) {
				const logsData = await api.listLogs(currentPage, limitVal, null, fromUtc, toUtc);
				if (logsData.length > 0) {
					logs = [...logs, ...logsData];
					
					// Automatically decrypt new batch
					if (privateKey) {
						for (const log of logsData) {
							if (decryptionState[log.id]) continue;
							try {
								const dec = decrypt(log.content, privateKey);
								let parsed: any;
								try {
									parsed = JSON.parse(dec);
								} catch (e) {
									parsed = dec;
								}
								decryptionState[log.id] = { success: true, parsed };
							} catch (e) {
								decryptionState[log.id] = { success: false, error: (e as Error).message };
							}
						}
						decryptionState = { ...decryptionState };
					}
				}

				if (logsData.length < limitVal) {
					hasMore = false;
				} else {
					currentPage++;
					// Small yielding delay to keep UI responsive
					await new Promise(resolve => setTimeout(resolve, 20));
				}
			}
		} catch (e) {
			showError('Search failed: ' + (e as Error).message);
		} finally {
			loading = false;
			isSearching = false;
		}
	}

	onMount(() => {
		const loadData = async () => {
			try {
				await initAgeWasm();
				const me = await api.me();
				privateKey = await getStoredPrivateKey(me.id);

				// Load query/datetime parameters from URL fragment hash
				if (typeof window !== 'undefined' && window.location.hash) {
					const hashParams = new URLSearchParams(window.location.hash.substring(1));
					const q = hashParams.get('q');
					const from = hashParams.get('from');
					const to = hashParams.get('to');

					if (q !== null) searchQuery = q;
					if (from !== null) fromTime = from;
					if (to !== null) toTime = to;

					// If non-default parameters are loaded, automatically expand the filter
					if (q || (from && from !== initialFrom) || (to && to !== initialTo)) {
						isFilterExpanded = true;
					}
				}

				try {
					const devicesData = await api.listDevices();
					devices = devicesData;
				} catch (e) {
					console.error('Failed to load devices list:', e);
				}
				await performSearch();
			} catch (e) {
				showError('Failed to load crypto library: ' + (e as Error).message);
				loading = false;
			}
		};
		loadData();

		// Auto-refresh alerts page data every 60 seconds
		const interval = setInterval(async () => {
			await performSearch();
		}, 60000);

		// Handle hash change events dynamically
		const handleHashChange = () => {
			const hashParams = new URLSearchParams(window.location.hash.substring(1));
			const q = hashParams.get('q') || '';
			const from = hashParams.get('from') || initialFrom;
			const to = hashParams.get('to') || initialTo;

			let changed = false;
			if (searchQuery !== q) { searchQuery = q; changed = true; }
			if (fromTime !== from) { fromTime = from; changed = true; }
			if (toTime !== to) { toTime = to; changed = true; }

			if (changed) {
				performSearch();
			}
		};
		window.addEventListener('hashchange', handleHashChange);

		return () => {
			window.removeEventListener('hashchange', handleHashChange);
			clearInterval(interval);
		};
	});

	async function handleAlertClick(log: Log): Promise<void> {
		if (log.seen) return;
		try {
			await api.markLogSeen(Number(log.id));
			log.seen = true;
			logs = [...logs];
		} catch (e) {
			showError('Failed to mark alert as seen: ' + (e as Error).message);
		}
	}

	async function markAllAsSeen(): Promise<void> {
		try {
			await api.markAllLogsSeen();
			for (const log of logs) {
				log.seen = true;
			}
			logs = [...logs];
		} catch (e) {
			showError('Failed to mark all alerts as seen: ' + (e as Error).message);
		}
	}
</script>

<svelte:head>
	<title>Alerts - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-3">
	<h2 class="mb-0">Alerts</h2>
	{#if logs.length > 0}
		<button class="btn btn-outline-primary btn-sm" onclick={markAllAsSeen}>
			Mark All As Seen
		</button>
	{/if}
</div>

{#if !loading && !privateKey}
	<div class="alert alert-info mb-3">
		No private key found in this browser. <a href="{base}/keys/recovery">Recover your keys</a> to decrypt alerts.
	</div>
{/if}

<!-- Query Filters Card (Expandable/Collapsible) -->
<div class="card mb-3">
	<button
		class="btn btn-light d-flex justify-content-between align-items-center w-100 p-3 text-start border-0"
		onclick={() => isFilterExpanded = !isFilterExpanded}
		aria-expanded={isFilterExpanded}
		style="background: none; border-radius: 8px;"
	>
		<span class="fw-semibold">
			Query & Datetime Filter
			{#if isFilterActive}
				<span class="badge bg-secondary ms-2">Active</span>
			{/if}
		</span>
		<span class="small text-muted">{isFilterExpanded ? '▲ Collapse' : '▼ Expand'}</span>
	</button>

	{#if isFilterExpanded}
		<div class="card-body border-top p-3">
			<div class="row g-3">
				<!-- Left Column: JSONata filter query (wide) -->
				<div class="col-md-8 col-lg-9">
					<div class="d-flex justify-content-between align-items-center mb-1">
						<label for="alert-search" class="form-label mb-0 fw-semibold" style="font-size: 0.85rem;">JSONata Filter Query</label>
						<a href="https://jsonata.org/" target="_blank" rel="noopener noreferrer" class="small text-decoration-none" style="font-size: 0.75rem;">Docs &raquo;</a>
					</div>
					<div class="input-group">
						<span class="input-group-text font-monospace" style="font-size: 0.9rem;">&gt;_</span>
						<textarea
							id="alert-search"
							class="form-control font-monospace"
							placeholder='e.g., meta.device = "MyLaptop" and alert.severity = "high"'
							bind:value={searchQuery}
							style="resize: vertical; font-size: 0.85rem; height: 161px;"
						></textarea>
					</div>
				</div>
				
				<!-- Right Column: Datetime inputs stacked vertically -->
				<div class="col-md-4 col-lg-3">
					<div class="mb-2">
						<label for="from-time" class="form-label mb-1 fw-semibold" style="font-size: 0.85rem;">From</label>
						<input
							id="from-time"
							type="datetime-local"
							class="form-control"
							bind:value={fromTime}
							style="font-size: 0.85rem; height: 35px;"
						/>
					</div>
					
					<div class="mb-2">
						<label for="to-time" class="form-label mb-1 fw-semibold" style="font-size: 0.85rem;">To</label>
						<input
							id="to-time"
							type="datetime-local"
							class="form-control"
							bind:value={toTime}
							style="font-size: 0.85rem; height: 35px;"
						/>
					</div>
					
					<div>
						<button
							class="btn btn-primary w-100"
							onclick={performSearch}
							disabled={isSearching}
							style="font-size: 0.85rem; height: 35px;"
						>
							{#if isSearching}
								<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
								Searching...
							{:else}
								Search
							{/if}
						</button>
					</div>
				</div>
			</div>
			{#if searchQuery && searchError}
				<div class="text-danger small mt-2 font-monospace">⚠️ {searchError}</div>
			{:else if searchQuery}
				<div class="text-success small mt-2 font-monospace">✓ Valid query (showing {filteredLogs.length} of {logs.length} alerts)</div>
			{/if}
		</div>
	{/if}
</div>

{#if loading && logs.length === 0}
	<div class="text-muted">
		<span class="spinner-border spinner-border-sm text-primary me-2" role="status"></span>
		Loading alerts…
	</div>
{:else}
	<div class="d-flex justify-content-between align-items-center mb-2 px-1">
		<div class="text-muted small fw-semibold">
			Found {filteredLogs.length} alert{filteredLogs.length === 1 ? '' : 's'}
		</div>
	</div>

	<div class="row g-2">
		{#each filteredLogs as log (log.id)}
			{@const alertObj = getAlertObject(log)}
			{@const jsonString = JSON.stringify(alertObj, null, 2)}
			<div class="col-12">
				<div 
					onclick={() => handleAlertClick(log)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAlertClick(log); }}
					role="button"
					tabindex="0"
					style="cursor: pointer;"
					class="card mb-1 {log.seen ? 'opacity-75' : 'border-primary'}"
				>
					<div class="card-body p-2">
						<pre class="p-2 rounded mb-1 font-monospace" style="background-color: #282a36 !important; color: #f8f8f2 !important; max-height: 400px; overflow: auto; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; border: 1px solid #44475a;">{@html syntaxHighlightJson(jsonString)}</pre>
						
						<div class="d-flex justify-content-between align-items-center mt-1 px-1 small text-muted font-monospace" style="font-size: 0.75rem;">
							<div class="d-flex align-items-center gap-2">
								{#if !log.seen}
									<span class="badge bg-primary px-2 py-0.5">New</span>
								{/if}
								<span>Time: {new Date(log.time).toLocaleString()}</span>
								{#if !log.signature}
									<span class="badge bg-danger px-2 py-0.5" title="Unsigned alert! Content integrity cannot be guaranteed.">Unsigned</span>
								{/if}
							</div>
							<div>
								<a 
									href="{base}/devices/{log.device_id}" 
									onclick={(e) => e.stopPropagation()} 
									class="text-decoration-none fw-bold link-primary"
								>
									Device details &raquo;
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="col-12 text-muted text-center py-4 card">
				{#if !searchQuery.trim() && logs.length === 0}
					No alerts at all.
				{:else}
					No alerts found matching your criteria.
				{/if}
			</div>
		{/each}
	</div>
{/if}
