<script lang="ts">
	import { getAlertField, getAlertNumber } from '$lib/alertHelpers';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let parentName = $derived(getAlertField(alert, 'process.parent.name'));
	let parentExecutable = $derived(getAlertField(alert, 'process.parent.executable'));
	let parentPid = $derived(getAlertNumber(alert, 'process.parent.pid'));
	let parentCommandLine = $derived(getAlertField(alert, 'process.parent.command_line'));

	let processName = $derived(getAlertField(alert, 'process.name'));
	let processExecutable = $derived(getAlertField(alert, 'process.executable'));
	let processPid = $derived(getAlertNumber(alert, 'process.pid'));

	let hasParent = $derived(!!(parentName || parentExecutable));
	let hasProcess = $derived(!!(processName || processExecutable));
</script>

{#if hasProcess}
	<div
		class="bg-body-secondary p-3"
		role="img"
		aria-label="Process tree"
		style="font-family: 'Hack', monospace; font-size: 0.85rem; white-space: pre-wrap;"
	>
		{#if hasParent}
			<div>{parentName ?? 'unknown'}{parentPid !== undefined ? ` (PID ${parentPid})` : ''}</div>
			<div class="text-body-secondary">{parentCommandLine ?? parentExecutable ?? ''}</div>
			<div>
				<span style="color: var(--bs-primary);">└─▶</span>
				 {processName ?? 'unknown'}{processPid !== undefined ? ` (PID ${processPid})` : ''}
			</div>
			<div class="text-body-secondary ps-4">{processExecutable ?? ''}</div>
		{:else}
			<div>{processName ?? 'unknown'}{processPid !== undefined ? ` (PID ${processPid})` : ''}</div>
			<div class="text-body-secondary">{processExecutable ?? ''}</div>
		{/if}
	</div>
{/if}
