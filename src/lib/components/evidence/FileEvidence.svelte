<script lang="ts">
	import { getAlertField, getAlertArray, getOperationName } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let eventTypes = $derived(getAlertArray(alert, 'event.type'));
	let operationName = $derived(eventTypes?.[0] ? getOperationName(eventTypes[0]) : undefined);

	let filePath = $derived(getAlertField(alert, 'file.path'));
	let fileName = $derived(getAlertField(alert, 'file.name'));
	let fileExtension = $derived(getAlertField(alert, 'file.extension'));
	let userName = $derived(getAlertField(alert, 'user.name'));

	let processExecutable = $derived(getAlertField(alert, 'process.executable'));
	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));

	let prompt = $derived(osType === 'windows' ? '>' : '$');
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">File Details</h6>

		{#if operationName}
			<p class="fw-bold mb-3">{operationName}</p>
		{/if}

		<table class="table table-sm table-borderless mb-0">
			<tbody>
				{#if filePath}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">File Path</td>
						<td style="font-family: 'Hack', monospace;">{filePath}</td>
					</tr>
				{/if}
				{#if fileName}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">File Name</td>
						<td>{fileName}</td>
					</tr>
				{/if}
				{#if fileExtension}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Extension</td>
						<td>{fileExtension}</td>
					</tr>
				{/if}
				{#if userName}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">User</td>
						<td>{userName}</td>
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
