<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getAlertField } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let scriptBlockText = $derived(getAlertField(alert, 'edr.powershell.script_block_text'));
	let scriptBlockId = $derived(getAlertField(alert, 'edr.powershell.script_block_id'));
	let contextInfo = $derived(getAlertField(alert, 'edr.powershell.context_info'));
	let payload = $derived(getAlertField(alert, 'edr.powershell.payload'));
	let classicData = $derived(getAlertField(alert, 'edr.powershell.data'));

	let processExecutable = $derived(getAlertField(alert, 'process.executable'));
	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));
	let prompt = $derived(osType === 'windows' ? '>' : '$');

	let copied = $state(false);

	function copyScript() {
		const text = scriptBlockText || payload || classicData;
		if (!text) return;
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(text).then(() => {
				copied = true;
				setTimeout(() => (copied = false), 2000);
			}).catch(() => {});
		}
	}
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<div class="d-flex justify-content-between align-items-center mb-3">
			<h6 class="fw-bold text-body-secondary mb-0 d-flex align-items-center gap-2">
				<Icon icon="lucide:terminal" class="text-primary" />
				PowerShell Script Execution
			</h6>
			{#if scriptBlockText || payload || classicData}
				<button
					type="button"
					class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
					onclick={copyScript}
					title="Copy script content"
				>
					<Icon icon={copied ? 'lucide:check' : 'lucide:copy'} />
					<span class="small">{copied ? 'Copied' : 'Copy Script'}</span>
				</button>
			{/if}
		</div>

		{#if scriptBlockText}
			<div class="mb-3">
				<div class="small text-body-secondary fw-bold mb-1">Script Block Content:</div>
				<pre
					class="bg-body-secondary text-body p-3 mb-0 overflow-auto font-monospace small"
					style="border-radius: 3px; max-height: 350px; white-space: pre-wrap; word-break: break-all;"
				>{scriptBlockText}</pre>
			</div>
		{/if}

		{#if payload && payload !== scriptBlockText}
			<div class="mb-3">
				<div class="small text-body-secondary fw-bold mb-1">Payload / Script:</div>
				<pre
					class="bg-body-secondary text-body p-3 mb-0 overflow-auto font-monospace small"
					style="border-radius: 3px; max-height: 250px; white-space: pre-wrap; word-break: break-all;"
				>{payload}</pre>
			</div>
		{/if}

		{#if classicData}
			<div class="mb-3">
				<div class="small text-body-secondary fw-bold mb-1">Classic Engine Data:</div>
				<pre
					class="bg-body-secondary text-body p-2 mb-0 overflow-auto font-monospace small"
					style="border-radius: 3px; max-height: 200px; white-space: pre-wrap;"
				>{classicData}</pre>
			</div>
		{/if}

		<table class="table table-sm table-borderless small mb-0">
			<tbody>
				{#if scriptBlockId}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Script Block ID</td>
						<td class="font-monospace">{scriptBlockId}</td>
					</tr>
				{/if}
				{#if contextInfo}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Context Info</td>
						<td>{contextInfo}</td>
					</tr>
				{/if}
			</tbody>
		</table>

		{#if processExecutable}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Responsible Process</h6>
			{#if commandLine}
				<div
					class="bg-body-secondary p-3 mb-3"
					style="font-family: 'Hack', monospace; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem;"
				>
					<span class="text-body-secondary">{prompt}</span> {commandLine}
				</div>
			{/if}
			<ProcessTree {alert} />
		{/if}
	</div>
</div>
