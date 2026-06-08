<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { api, type Log, type Device } from '$lib/api';
	import { showError, showFlash, user } from '$lib/store';
	import { initAgeWasm, getStoredPrivateKey, aesEncrypt, decrypt, encrypt } from '$lib/crypto';
	import { LogManager } from '$lib/logManager.svelte';
	import { isDeviceActive, formatFullDateTime, mapSeverityToNumber } from '$lib/utils';

	let logManager: LogManager | null = $state(null);
	let privateKey = $state<string | null>(null);

	let searchQuery = $state('');
	let isFilterExpanded = $state(false);

	let selectedLog = $state<Log | null>(null);
	let resolution = $state<string>('none');
	let triageNote = $state<string>('');
	let savingResolution = $state(false);

	let fromTime = $state<string | null>(null);
	let toTime = $state<string | null>(null);

	function showBrowserNotification(log: Log, devObj: Device | undefined) {
		if (typeof window !== 'undefined' && 'Notification' in window) {
			if (Notification.permission === 'granted') {
				const deviceName = devObj ? devObj.name : `Device #${log.device_id}`;
				const severityStr = log.severity ? ` [${log.severity.toUpperCase()}]` : '';
				new Notification(`New Alert${severityStr} - Radegast EDR`, {
					body: `New alert from ${deviceName}`
				});
			}
		}
	}

	onMount(async () => {
		try {
			await initAgeWasm();
			const me = await api.me();
			$user = me;
			privateKey = await getStoredPrivateKey(me.id);
			
			logManager = new LogManager(privateKey, showBrowserNotification);
			const devicesData = await api.listDevices();
			logManager.setDevices(devicesData);

			// Setup defaults
			const now = new Date();
			const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
			const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
			const pad = (num: number) => String(num).padStart(2, '0');
			const formatLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

			fromTime = formatLocal(fourDaysAgo);
			toTime = formatLocal(tomorrow);

			await performSearch();
			
			if (typeof window !== 'undefined' && 'Notification' in window) {
				if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
					Notification.requestPermission();
				}
			}
		} catch (e) {
			showError('Failed to initialize: ' + (e as Error).message);
		}
	});

	async function performSearch() {
		if (!logManager) return;
		await logManager.performSearch(fromTime, toTime);
		await logManager.runFilter(searchQuery);
	}

	$effect(() => {
		if (logManager) {
			const _ = logManager.logs;
			logManager.runFilter(searchQuery);
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

	let markedSeenIds = new Set<number>();

	async function selectLog(log: Log) {
		selectedLog = log;
		resolution = log.alert_resolution || 'none';
		
		if (log.triage_note && privateKey) {
			try {
				triageNote = decrypt(log.triage_note, privateKey);
			} catch (e) {
				triageNote = 'Failed to decrypt note: ' + (e as Error).message;
			}
		} else {
			triageNote = '';
		}

		// In basic mode: mark as seen on click (no resolution required).
		// In extended EDR mode: only mark as seen if the log already has a resolution
		// (alerts without a resolution must stay active/unread until triaged).
		const hasResolution = !!(log.alert_resolution && log.alert_resolution !== 'none');
		const shouldMarkSeen = $user && !log.seen && !markedSeenIds.has(log.id) &&
			(!$user.extended_edr_enabled || hasResolution);

		if (shouldMarkSeen) {
			try {
				await api.markLogSeen(log.id);
				markedSeenIds.add(log.id);
				// Always update local state to reflect seen status —
				// in extended EDR the visual indicator is resolution-based, but seen
				// still needs to be accurate so the opacity/border reflects the DB state.
				log.seen = true;
			} catch (e) {
				console.error("Failed to mark log as seen", e);
			}
		}
	}

	async function saveResolution() {
		if (!selectedLog || !logManager) return;
		savingResolution = true;
		try {
			let encryptedNote: string | null = null;
			if (triageNote.trim() && privateKey) {
				// Fetch device-based public keys: all users with log-read access on this log's device.
				// Using the /device-keys endpoint (user-accessible) which replicates the same
				// key set as the device-facing encryption-keys endpoint via a shared utility.
				const keysRes = await api.client.GET('/api/v1/logs/{log_id}/device-keys', {
					params: { path: { log_id: selectedLog.id } }
				});
				if (keysRes.error) {
					const detail = typeof keysRes.error.detail === 'string' ? keysRes.error.detail : (keysRes.error.detail ? JSON.stringify(keysRes.error.detail) : 'Unknown error');
					throw new Error("Failed to fetch encryption keys: " + detail);
				}
				const keys = (keysRes.data as any) || [];
				const activeKeys = keys.filter((k: any) => k.key_type !== 'recovery').map((k: any) => k.public_key);
				if (activeKeys.length === 0) {
					throw new Error("No active public keys found to encrypt the triage note.");
				}
				encryptedNote = encrypt(triageNote, activeKeys);
			}
			
			const res = await api.client.PATCH('/api/v1/logs/{log_id}/resolve', {
				params: { path: { log_id: selectedLog.id } },
				body: { alert_resolution: resolution === 'none' ? null : resolution, triage_note: encryptedNote }
			});

			if (res.error) {
				const detail = typeof res.error.detail === 'string' ? res.error.detail : (res.error.detail ? JSON.stringify(res.error.detail) : 'Unknown error');
				throw new Error(detail);
			}

			showFlash('Resolution saved successfully');
			
			// Update local state
			selectedLog.alert_resolution = resolution === 'none' ? null : resolution;
			selectedLog.triage_note = encryptedNote; 
			// In extended EDR, only mark as seen when a real resolution is set.
			// Clearing the resolution should leave the log visually "active" (unread).
			const hasRealResolution = resolution && resolution !== 'none';
			if (!$user?.extended_edr_enabled || hasRealResolution) {
				selectedLog.seen = true;
			}
			
		} catch (e) {
			showError('Failed to save resolution: ' + (e as Error).message);
		} finally {
			savingResolution = false;
		}
	}

	async function markAllSeen() {
		if (!logManager) return;

		const isEdr = $user?.extended_edr_enabled;
		if (isEdr) {
			const count = logManager.filteredLogs.length;
			if (count === 0) return;

			const confirmed = await askConfirm(`Are you sure you want to resolve all ${count} currently shown alerts as 'read'?`);
			if (!confirmed) return;

			try {
				logManager.loading = true;
				await Promise.all(
					logManager.filteredLogs.map(async (log) => {
						const res = await api.client.PATCH('/api/v1/logs/{log_id}/resolve', {
							params: { path: { log_id: log.id } },
							body: { alert_resolution: 'read', triage_note: null }
						});
						if (res.error) {
							const detail = typeof res.error.detail === 'string' ? res.error.detail : (res.error.detail ? JSON.stringify(res.error.detail) : 'Unknown error');
							throw new Error(detail);
						}
						log.alert_resolution = 'read';
						log.seen = true;
					})
				);
				logManager.logs = [...logManager.logs];
				showFlash(`Successfully resolved ${count} alerts as 'read'`);
			} catch (e) {
				showError('Failed to resolve alerts: ' + (e as Error).message);
			} finally {
				logManager.loading = false;
			}
		} else {
			const confirmed = await askConfirm('Are you sure you want to mark all alerts as seen?');
			if (!confirmed) return;

			try {
				logManager.loading = true;
				await api.markAllLogsSeen();
				logManager.logs.forEach(log => {
					log.seen = true;
				});
				logManager.logs = [...logManager.logs];
				showFlash('All alerts marked as seen successfully');
			} catch (e) {
				showError('Failed to mark all as seen: ' + (e as Error).message);
			} finally {
				logManager.loading = false;
			}
		}
	}

</script>

<svelte:head>
	<title>Threat Triage - Radegast</title>
</svelte:head>

<div class="alerts-page-wrapper">
	<div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
		<h2 class="mb-0 fw-bold">Threat Triage</h2>
		{#if $user}
			{#if $user.extended_edr_enabled}
				<button 
					class="btn btn-outline-primary btn-sm fw-bold" 
					onclick={markAllSeen}
					disabled={!logManager || logManager.loading || logManager.filteredLogs.length === 0}
				>
					Resolve All as Read
				</button>
			{:else}
				<button 
					class="btn btn-outline-primary btn-sm fw-bold" 
					onclick={markAllSeen}
					disabled={!logManager || logManager.loading || logManager.logs.length === 0}
				>
					Mark All as Seen
				</button>
			{/if}
		{/if}
	</div>

	{#if !logManager || logManager.loading && logManager.logs.length === 0}
		<div class="text-center p-5 text-muted">
			<span class="spinner-border spinner-border-sm me-2"></span> Loading alerts...
		</div>
	{:else}
		<div class="alerts-container">
			<!-- Left Pane: Alert List -->
			<div class="left-pane">
			<div class="mb-3">
				<input 
					type="text" 
					class="form-control mb-2" 
					placeholder="Filter alerts (JSONata)..." 
					bind:value={searchQuery}
				/>
				<div class="row g-2">
					<div class="col-6">
						<label for="alerts-from-time" class="form-label small fw-bold mb-1">From</label>
						<input 
							id="alerts-from-time"
							type="datetime-local" 
							class="form-control form-control-sm" 
							bind:value={fromTime}
							onchange={() => logManager?.performSearch(fromTime, toTime, null, 1)}
						/>
					</div>
					<div class="col-6">
						<label for="alerts-to-time" class="form-label small fw-bold mb-1">To</label>
						<input 
							id="alerts-to-time"
							type="datetime-local" 
							class="form-control form-control-sm" 
							bind:value={toTime}
							onchange={() => logManager?.performSearch(fromTime, toTime, null, 1)}
						/>
					</div>
				</div>
			</div>
			
			<div class="alerts-list flex-grow-1 overflow-auto">
				{#each logManager.filteredLogs as log}
					{@const alertObj = logManager.getAlertObject(log)}
					{@const ruleName = alertObj.alert?.['rule.name'] || alertObj.alert?.rule?.name || `An alert on ${alertObj.meta.device || 'Unknown Device'}`}
					{@const isRead = ($user?.extended_edr_enabled ? (!!log.alert_resolution && log.alert_resolution !== 'none') : !!log.seen) || (log.severity && mapSeverityToNumber(log.severity) < mapSeverityToNumber($user?.notification_level))}
					
					<div 
						class="card mb-2 border-0 shadow-sm {selectedLog?.id === log.id ? 'bg-primary text-white' : 'bg-body-tertiary'} {isRead ? 'opacity-75' : 'border-start border-3 border-danger'}" 
						style="cursor: pointer; border-radius: 8px;"
						onclick={() => selectLog(log)}
						onkeydown={(e) => { if (e.key === 'Enter') selectLog(log); }}
						role="button"
						tabindex="0"
					>
						<div class="card-body p-3">
							<div class="d-flex justify-content-between mb-1">
								<span class="fw-bold text-truncate" style="max-width: 70%;">{ruleName}</span>
								<span class="small opacity-75">{new Date(log.time).toLocaleTimeString()}</span>
							</div>
							<div class="d-flex justify-content-between align-items-center small">
								<span class="opacity-75">{alertObj.meta.device}</span>
								<div class="d-flex gap-1 align-items-center">
									{#if log.alert_resolution && log.alert_resolution !== 'none'}
										{@const res = log.alert_resolution}
										<span class="badge {res === 'true_positive' ? 'bg-danger' : (res === 'false_positive' ? 'bg-success' : 'bg-secondary')}">
											{res === 'true_positive' ? 'tp' : (res === 'false_positive' ? 'fp' : 'read')}
										</span>
									{:else if !$user?.extended_edr_enabled && log.seen}
										<span class="badge bg-secondary">read</span>
									{/if}
									{#if log.severity}
										<span class="badge {log.severity === 'high' || log.severity === 'critical' ? 'bg-danger' : 'bg-warning text-dark'} text-uppercase">{log.severity}</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
				{#if logManager.filteredLogs.length === 0}
					<div class="text-muted text-center p-4">No alerts found.</div>
				{/if}
			</div>

			<div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
				<button 
					class="btn btn-outline-secondary btn-sm fw-bold" 
					disabled={logManager.currentPage <= 1 || logManager.loading}
					onclick={() => logManager?.performSearch(fromTime, toTime, null, logManager.currentPage - 1)}
				>
					&laquo; Prev
				</button>
				<span class="small fw-semibold text-muted">
					Page {logManager.currentPage} of {logManager.totalPages} ({logManager.totalLogs} total)
				</span>
				<button 
					class="btn btn-outline-secondary btn-sm fw-bold" 
					disabled={logManager.currentPage >= logManager.totalPages || logManager.loading}
					onclick={() => logManager?.performSearch(fromTime, toTime, null, logManager.currentPage + 1)}
				>
					Next &raquo;
				</button>
			</div>
		</div>

		<!-- Right Pane: Alert Details -->
		<div class="right-pane">
			{#if selectedLog}
				{@const alertObj = logManager.getAlertObject(selectedLog)}
				{@const ruleName = alertObj.alert?.['rule.name'] || alertObj.alert?.rule?.name || `An alert on ${alertObj.meta.device || 'Unknown Device'}`}
				
				<div class="card border-0 shadow-sm mb-3" style="border-radius: 12px; background: var(--bs-body-bg);">
					<div class="card-header bg-transparent border-bottom-0 pt-4 pb-0">
						<h4 class="fw-bold mb-1">{ruleName}</h4>
						<div class="d-flex gap-3 text-muted small">
							<span><strong>Device:</strong> {alertObj.meta.device}</span>
							<span><strong>Time:</strong> {new Date(selectedLog.time).toLocaleString()}</span>
							<span><strong>Severity:</strong> {selectedLog.severity ? selectedLog.severity.toUpperCase() : 'N/A'}</span>
						</div>
					</div>
					<div class="card-body">
						<h6 class="fw-bold mb-2">RAW TELEMETRY (Decrypted locally):</h6>
						<pre class="p-3 rounded mb-0 font-monospace" style="background-color: #282a36 !important; color: #f8f8f2 !important; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; border: 1px solid #44475a;">{@html syntaxHighlightJson(JSON.stringify(alertObj.alert, null, 2))}</pre>
					</div>
				</div>

				{#if $user && $user.extended_edr_enabled}
					<div class="card border-0 shadow-sm" style="border-radius: 12px; background: var(--bs-body-bg);">
						<div class="card-body">
							<div class="d-flex justify-content-between align-items-center mb-3">
								<h6 class="fw-bold mb-0 text-primary">Extended EDR Triage</h6>
								<span class="badge bg-primary">Enabled</span>
							</div>
							
							<div class="mb-3">
								<label for="triageNote" class="form-label fw-bold small">TRIAGE NOTES (E2EE):</label>
								<textarea 
									id="triageNote" 
									class="form-control" 
									rows="3" 
									placeholder="No note so far."
									bind:value={triageNote}
								></textarea>
							</div>

							<div class="d-flex align-items-end gap-3">
								<div class="flex-grow-1">
									<label for="resolution" class="form-label fw-bold small">RESOLUTION:</label>
									<select id="resolution" class="form-select fw-bold" bind:value={resolution}>
										<option value="none">None</option>
										<option value="read">Read (Acknowledge)</option>
										<option value="true_positive">True Positive</option>
										<option value="false_positive">False Positive</option>
									</select>
								</div>
								<button class="btn btn-primary fw-bold" onclick={saveResolution} disabled={savingResolution}>
									{savingResolution ? 'Saving...' : 'Save Triage'}
								</button>
							</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="d-flex align-items-center justify-content-center h-100 text-muted">
					Select an alert from the list to view details and triage.
				</div>
			{/if}
		</div>
	</div>
{/if}
</div>

<style>
	.alerts-list {
		height: auto;
	}
	.alerts-container {
		height: auto;
	}
	.left-pane {
		border-right: none;
		padding-right: 0 !important;
		margin-bottom: 1.5rem;
	}
	.right-pane {
		padding-left: 0 !important;
	}
	@media (min-width: 768px) {
		.alerts-list {
			height: 0;
		}
		.alerts-page-wrapper {
			display: grid;
			grid-template-rows: auto 1fr;
			height: calc(100vh - 48px);
			overflow: hidden;
		}
		.alerts-container {
			display: grid;
			grid-template-columns: 5fr 7fr;
			grid-template-rows: 100%;
			height: 100%;
			overflow: hidden;
		}
		.left-pane {
			border-right: 1px solid var(--bs-border-color);
			padding-right: 1rem !important;
			margin-bottom: 0;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.right-pane {
			padding-left: 1rem !important;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
		}
	}
</style>
