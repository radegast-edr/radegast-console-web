<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showError } from '$lib/store.js';
	import { initAgeWasm, getStoredPrivateKey, decrypt } from '$lib/crypto.js';

	let logs = $state([]);
	let decryptedLogs = $state({});
	let privateKey = $state(null);
	let loading = $state(true);
	let page = $state(1);
	let limit = 100;
	let devices = $state([]);
	let deviceMap = $derived(new Map(devices.map(d => [d.id, d.name])));

	async function loadAlerts() {
		try {
			const me = await api.me();
			privateKey = await getStoredPrivateKey(me.id);
			logs = await api.listLogs(page, limit);
			
			// Automatically decrypt all logs by default if privateKey is available
			if (privateKey && logs.length > 0) {
				for (const log of logs) {
					// Avoid repeating decryption for already-decrypted alerts during auto-refresh
					if (decryptedLogs[log.id]) continue;
					try {
						const dec = decrypt(log.content, privateKey);
						try {
							// Try to pretty print JSON
							const parsed = JSON.parse(dec);
							decryptedLogs[log.id] = JSON.stringify(parsed, null, 2);
						} catch (e) {
							// If not valid JSON, show raw text
							decryptedLogs[log.id] = dec;
						}
					} catch (e) {
						decryptedLogs[log.id] = `[Decryption failed: ${e.message}]`;
					}
				}
				decryptedLogs = { ...decryptedLogs };
			}
		} catch (e) {
			showError(e.message);
		}
	}

	onMount(async () => {
		try {
			await initAgeWasm();
			try {
				devices = await api.listDevices();
			} catch (e) {
				console.error('Failed to load devices list:', e);
			}
			await loadAlerts();
		} catch (e) {
			showError('Failed to load crypto library: ' + e.message);
		} finally {
			loading = false;
		}

		// Auto-refresh alerts page data every 60 seconds
		const interval = setInterval(async () => {
			await loadAlerts();
		}, 60000);

		return () => clearInterval(interval);
	});

	async function handleAlertClick(log) {
		if (log.seen) return;
		try {
			await api.markLogSeen(log.id);
			log.seen = true;
			logs = [...logs];
		} catch (e) {
			showError('Failed to mark alert as seen: ' + e.message);
		}
	}

	async function markAllAsSeen() {
		try {
			await api.markAllLogsSeen();
			for (const log of logs) {
				log.seen = true;
			}
			logs = [...logs];
		} catch (e) {
			showError('Failed to mark all alerts as seen: ' + e.message);
		}
	}

	async function changePage(newPage) {
		if (newPage < 1) return;
		page = newPage;
		loading = true;
		await loadAlerts();
		loading = false;
	}
</script>

<svelte:head>
	<title>Alerts - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<h2 class="mb-0">Alerts</h2>
	{#if logs.length > 0}
		<button class="btn btn-outline-primary" onclick={markAllAsSeen}>
			Mark All As Seen
		</button>
	{/if}
</div>

{#if !privateKey}
	<div class="alert alert-info">
		No private key found in this browser. <a href="{base}/keys/recovery">Recover your keys</a> to decrypt alerts.
	</div>
{/if}

{#if loading}
	<div class="text-muted">Loading alerts…</div>
{:else}
	<div class="table-responsive">
		<table class="table align-middle">
			<thead>
				<tr>
					<th style="width: 20%">Time</th>
					<th style="width: 25%">Device</th>
					<th style="width: 55%">Alert Payload (Click to see)</th>
				</tr>
			</thead>
			<tbody>
				{#each logs as log}
					<tr 
						onclick={() => handleAlertClick(log)}
						style="cursor: pointer; transition: background-color 0.2s;"
						class="{log.seen ? 'opacity-75' : 'table-light fw-bold border-start border-primary border-4'}"
					>
						<td>
							<div class="d-flex align-items-center">
								{#if !log.seen}
									<span class="badge bg-primary me-2">New</span>
								{/if}
								<small>{new Date(log.time).toLocaleString()}</small>
							</div>
						</td>
						<td>
							<a 
								href="{base}/devices/{log.device_id}" 
								onclick={(e) => e.stopPropagation()} 
								class="text-decoration-none fw-bold link-secondary"
							>
								{deviceMap.get(log.device_id) || `Device #${log.device_id}`}
							</a>
							{#if !log.signature}
								<span class="badge bg-danger ms-2" title="Unsigned alert! Content integrity cannot be guaranteed.">Unsigned</span>
							{/if}
						</td>
						<td>
							{#if decryptedLogs[log.id]}
								<pre class="bg-dark text-light p-3 rounded font-monospace mb-0 small" style="max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all;">{decryptedLogs[log.id]}</pre>
							{:else if privateKey}
								<div class="text-muted small">Decrypting…</div>
							{:else}
								<div class="text-muted small">[Encrypted alert]</div>
							{/if}
						</td>
					</tr>
				{:else}
					<tr><td colspan="3" class="text-muted text-center py-4">No alerts found.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination controls -->
	<div class="d-flex justify-content-between align-items-center mt-3">
		<button class="btn btn-outline-secondary btn-sm" onclick={() => changePage(page - 1)} disabled={page === 1}>
			&laquo; Previous Page
		</button>
		<span class="text-muted small">Page {page}</span>
		<button class="btn btn-outline-secondary btn-sm" onclick={() => changePage(page + 1)} disabled={logs.length < limit}>
			Next Page &raquo;
		</button>
	</div>
{/if}
