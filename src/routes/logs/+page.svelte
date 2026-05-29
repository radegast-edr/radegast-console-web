<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showError } from '$lib/store.js';
	import { getStoredPrivateKey, decrypt } from '$lib/crypto.js';

	let logs = $state([]);
	let decryptedLogs = $state({});
	let privateKey = $state(null);

	onMount(async () => {
		try {
			const me = await api.me();
			privateKey = await getStoredPrivateKey(me.id);
			logs = await api.listLogs();
		} catch (e) {
			showError(e.message);
		}
	});

	function decryptLog(logId, content) {
		if (!privateKey) {
			showError('No private key found. Please recover your keys first.');
			return;
		}
		try {
			const decrypted = decrypt(content, privateKey);
			decryptedLogs[logId] = decrypted;
			decryptedLogs = { ...decryptedLogs };
		} catch (e) {
			decryptedLogs[logId] = '[Decryption failed]';
			decryptedLogs = { ...decryptedLogs };
		}
	}
</script>

<h2>Logs</h2>

{#if !privateKey}
	<div class="alert alert-info">
		No private key found in this browser. <a href="/keys/recovery">Recover your keys</a> to decrypt
		logs.
	</div>
{/if}

<table class="table table-striped">
	<thead>
		<tr>
			<th>Time</th>
			<th>Device</th>
			<th>Content</th>
			<th>Signature</th>
		</tr>
	</thead>
	<tbody>
		{#each logs as log}
			<tr>
				<td><small>{new Date(log.time).toLocaleString()}</small></td>
				<td>{log.device_id}</td>
				<td>
					{#if decryptedLogs[log.id]}
						<pre class="mb-0 small">{decryptedLogs[log.id]}</pre>
					{:else}
						<button
							class="btn btn-sm btn-outline-primary"
							onclick={() => decryptLog(log.id, log.content)}
							disabled={!privateKey}
						>
							Decrypt
						</button>
					{/if}
				</td>
				<td>
					{#if log.signature}
						<span class="badge bg-success">Signed</span>
					{:else}
						<span class="badge bg-secondary">None</span>
					{/if}
				</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="text-muted">No logs found</td></tr>
		{/each}
	</tbody>
</table>
