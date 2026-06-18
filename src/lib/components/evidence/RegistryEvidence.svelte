<script lang="ts">
	import { getAlertField } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let registryPath = $derived(getAlertField(alert, 'registry.path'));
	let registryHive = $derived(getAlertField(alert, 'registry.hive'));
	let registryKey = $derived(getAlertField(alert, 'registry.key'));

	let processExecutable = $derived(getAlertField(alert, 'process.executable'));
	let peOriginalName = $derived(getAlertField(alert, 'process.pe.original_file_name'));
	let peProduct = $derived(getAlertField(alert, 'process.pe.product'));
	let peDescription = $derived(getAlertField(alert, 'process.pe.description'));

	let hasHive = $derived(!!(registryHive && registryHive.trim().length > 0));
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Registry Modification</h6>

		<table class="table table-sm table-borderless mb-0">
			<tbody>
				{#if registryPath}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Registry Path</td>
						<td
							style="font-family: 'Hack', monospace; word-break: break-all;"
							>{registryPath}</td
						>
					</tr>
				{/if}
				{#if hasHive}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Hive</td>
						<td>{registryHive}</td>
					</tr>
				{/if}
				{#if registryKey}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Key</td>
						<td style="font-family: 'Hack', monospace;">{registryKey}</td>
					</tr>
				{/if}
			</tbody>
		</table>

		{#if processExecutable}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Responsible Process</h6>

			<ProcessTree {alert} />

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
		{/if}
	</div>
</div>
