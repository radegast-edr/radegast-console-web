<script lang="ts">
	import { getAlertField, getAlertNumber } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let executable = $derived(getAlertField(alert, 'process.executable'));
	let pid = $derived(getAlertNumber(alert, 'process.pid'));
	let userName = $derived(getAlertField(alert, 'user.name'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));

	let prompt = $derived(osType === 'windows' ? '>' : '$');

	let peOriginalName = $derived(getAlertField(alert, 'process.pe.original_file_name'));
	let peProduct = $derived(getAlertField(alert, 'process.pe.product'));
	let peDescription = $derived(getAlertField(alert, 'process.pe.description'));
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Process Details</h6>

		{#if commandLine}
			<div
				class="bg-body-secondary p-3 mb-3"
				style="font-family: 'Hack', monospace; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem;"
			>
				<span class="text-body-secondary">{prompt}</span> {commandLine}
			</div>
		{/if}

		<div class="mb-3">
			<ProcessTree {alert} />
		</div>

		<table class="table table-sm table-borderless mb-0">
			<tbody>
				{#if executable}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Executable</td>
						<td style="font-family: 'Hack', monospace;">{executable}</td>
					</tr>
				{/if}
				{#if pid !== undefined}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Process ID</td>
						<td>{pid}</td>
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

		{#if peOriginalName}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Windows Executable Info</h6>
			<table class="table table-sm table-borderless mb-0">
				<tbody>
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Original Name</td>
						<td>{peOriginalName}</td>
					</tr>
					{#if peProduct}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Product</td>
							<td>{peProduct}</td>
						</tr>
					{/if}
					{#if peDescription}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Description</td>
							<td>{peDescription}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		{/if}
	</div>
</div>
