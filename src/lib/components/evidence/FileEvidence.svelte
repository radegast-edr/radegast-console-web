<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getAlertField, getAlertArray, getAlertBoolean, getOperationName, formatAlertTimestamp } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let eventTypes = $derived(getAlertArray(alert, 'event.type'));
	let operationName = $derived(eventTypes?.[0] ? getOperationName(eventTypes[0]) : undefined);

	let filePath = $derived(getAlertField(alert, 'file.path'));
	let fileName = $derived(getAlertField(alert, 'file.name'));
	let fileExtension = $derived(getAlertField(alert, 'file.extension'));
	let userName = $derived(getAlertField(alert, 'user.name'));

	// Timestamps & Timestomping
	let fileCreated = $derived(getAlertField(alert, 'file.created'));
	let previousCreated = $derived(getAlertField(alert, 'edr.file.previous_created'));
	let isTimestomped = $derived(!!previousCreated && previousCreated !== fileCreated);

	// Truncation
	let pathTruncated = $derived(getAlertField(alert, 'edr.file.path_truncated'));

	// Code signature
	let codeSigned = $derived(getAlertBoolean(alert, 'file.code_signature.exists'));
	let codeSigner = $derived(getAlertField(alert, 'file.code_signature.subject_name'));

	// PE metadata
	let peOriginalName = $derived(getAlertField(alert, 'file.pe.original_file_name'));
	let peProduct = $derived(getAlertField(alert, 'file.pe.product'));
	let peCompany = $derived(getAlertField(alert, 'file.pe.company'));
	let peFileVersion = $derived(getAlertField(alert, 'file.pe.file_version'));
	let peDescription = $derived(getAlertField(alert, 'file.pe.description'));
	let hasPeInfo = $derived(!!(peOriginalName || peProduct || peCompany || peFileVersion || peDescription));

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

		<!-- Timestomping Anti-Forensics Callout -->
		{#if isTimestomped}
			<div class="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert" style="border-radius: 3px;">
				<Icon icon="lucide:alert-triangle" class="fs-4 flex-shrink-0" />
				<div>
					<strong>Timestomping Detected:</strong> The creation timestamp was altered from
					<span class="font-monospace fw-semibold">{formatAlertTimestamp(previousCreated!)}</span> to
					<span class="font-monospace fw-semibold">{formatAlertTimestamp(fileCreated!)}</span>.
				</div>
			</div>
		{/if}

		<table class="table table-sm table-borderless mb-0">
			<tbody>
				{#if filePath}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">File Path</td>
						<td style="font-family: 'Hack', monospace;" class="text-break">
							{filePath}
							{#if pathTruncated}
								<span class="badge bg-warning text-dark ms-1" title="Path cut short ({pathTruncated})">Truncated</span>
							{/if}
						</td>
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
						<td><span class="badge bg-body-secondary text-body border">.{fileExtension}</span></td>
					</tr>
				{/if}
				{#if fileCreated && !isTimestomped}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Created Time</td>
						<td class="small">{formatAlertTimestamp(fileCreated)}</td>
					</tr>
				{/if}
				{#if codeSigned !== undefined}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Signature</td>
						<td>
							{#if codeSigned}
								<span class="badge bg-success-subtle text-success border border-success-subtle">
									<Icon icon="lucide:check-circle" class="me-1" />Signed
								</span>
								{#if codeSigner}
									<span class="small ms-2 fw-semibold">{codeSigner}</span>
								{/if}
							{:else}
								<span class="badge bg-secondary-subtle text-secondary border">Unsigned</span>
							{/if}
						</td>
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

		{#if hasPeInfo}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Binary Metadata</h6>
			<table class="table table-sm table-borderless small mb-0">
				<tbody>
					{#if peOriginalName}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Original Name</td>
							<td>{peOriginalName}</td>
						</tr>
					{/if}
					{#if peProduct}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Product</td>
							<td>{peProduct}</td>
						</tr>
					{/if}
					{#if peCompany}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Company</td>
							<td>{peCompany}</td>
						</tr>
					{/if}
					{#if peFileVersion}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Version</td>
							<td class="font-monospace">{peFileVersion}</td>
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
