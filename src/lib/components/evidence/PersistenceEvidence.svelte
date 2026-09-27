<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getAlertField } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	// Service fields
	let serviceName = $derived(getAlertField(alert, 'service.name'));
	let serviceExecutable = $derived(getAlertField(alert, 'edr.service.executable'));
	let serviceType = $derived(getAlertField(alert, 'edr.service.type'));
	let serviceStartType = $derived(getAlertField(alert, 'edr.service.start_type'));
	let serviceAccount = $derived(getAlertField(alert, 'edr.service.account_name'));
	let eventLogProvider = $derived(getAlertField(alert, 'edr.event_log.provider_name'));

	// Task fields
	let taskName = $derived(getAlertField(alert, 'edr.task.name'));
	let taskContent = $derived(getAlertField(alert, 'edr.task.content'));
	let taskUser = $derived(getAlertField(alert, 'edr.task.user_name'));

	// WMI fields
	let wmiOperation = $derived(getAlertField(alert, 'edr.wmi.operation'));
	let wmiQuery = $derived(getAlertField(alert, 'edr.wmi.query'));
	let wmiNamespace = $derived(getAlertField(alert, 'edr.wmi.namespace'));
	let wmiEventType = $derived(getAlertField(alert, 'edr.wmi.event_type'));

	let processExecutable = $derived(getAlertField(alert, 'process.executable'));
	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));
	let prompt = $derived(osType === 'windows' ? '>' : '$');
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<!-- Section title -->
		<h6 class="fw-bold text-body-secondary mb-3 d-flex align-items-center gap-2">
			{#if taskName}
				<Icon icon="lucide:calendar-clock" class="text-primary" />
				Scheduled Task Persistence
			{:else if serviceName}
				<Icon icon="lucide:server" class="text-primary" />
				Service Persistence
			{:else if wmiOperation || wmiQuery}
				<Icon icon="lucide:cpu" class="text-primary" />
				WMI Subscription Activity
			{:else}
				<Icon icon="lucide:anchor" class="text-primary" />
				Persistence Activity
			{/if}
		</h6>

		<!-- Service Details -->
		{#if serviceName}
			<div class="mb-3">
				<table class="table table-sm table-borderless small mb-0">
					<tbody>
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Service Name</td>
							<td class="fw-bold">{serviceName}</td>
						</tr>
						{#if serviceExecutable}
							<tr>
								<td class="text-body-secondary">Service Binary</td>
								<td class="font-monospace text-break">{serviceExecutable}</td>
							</tr>
						{/if}
						{#if serviceStartType}
							<tr>
								<td class="text-body-secondary">Start Type</td>
								<td><span class="badge bg-secondary">{serviceStartType}</span></td>
							</tr>
						{/if}
						{#if serviceAccount}
							<tr>
								<td class="text-body-secondary">Account</td>
								<td>{serviceAccount}</td>
							</tr>
						{/if}
						{#if serviceType}
							<tr>
								<td class="text-body-secondary">Service Type</td>
								<td>{serviceType}</td>
							</tr>
						{/if}
						{#if eventLogProvider}
							<tr>
								<td class="text-body-secondary">Log Provider</td>
								<td class="text-body-secondary">{eventLogProvider}</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- Scheduled Task Details -->
		{#if taskName}
			<div class="mb-3">
				<table class="table table-sm table-borderless small mb-2">
					<tbody>
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Task Name</td>
							<td class="fw-bold font-monospace">{taskName}</td>
						</tr>
						{#if taskUser}
							<tr>
								<td class="text-body-secondary">Run As User</td>
								<td>{taskUser}</td>
							</tr>
						{/if}
					</tbody>
				</table>

				{#if taskContent}
					<div class="small text-body-secondary fw-bold mb-1">Task Definition (XML / Action):</div>
					<pre
						class="bg-body-secondary text-body p-3 mb-0 overflow-auto font-monospace small"
						style="border-radius: 3px; max-height: 250px; white-space: pre-wrap;"
					>{taskContent}</pre>
				{/if}
			</div>
		{/if}

		<!-- WMI Details -->
		{#if wmiOperation || wmiQuery}
			<div class="mb-3">
				<table class="table table-sm table-borderless small mb-2">
					<tbody>
						{#if wmiOperation}
							<tr>
								<td class="text-body-secondary" style="width: 140px;">Operation</td>
								<td><span class="badge bg-info-subtle text-info-emphasis border">{wmiOperation}</span></td>
							</tr>
						{/if}
						{#if wmiNamespace}
							<tr>
								<td class="text-body-secondary">Namespace</td>
								<td class="font-monospace">{wmiNamespace}</td>
							</tr>
						{/if}
						{#if wmiEventType}
							<tr>
								<td class="text-body-secondary">Event Type</td>
								<td>{wmiEventType}</td>
							</tr>
						{/if}
					</tbody>
				</table>

				{#if wmiQuery}
					<div class="small text-body-secondary fw-bold mb-1">WMI Query:</div>
					<pre
						class="bg-body-secondary text-body p-2 mb-0 overflow-auto font-monospace small"
						style="border-radius: 3px; max-height: 150px; white-space: pre-wrap;"
					>{wmiQuery}</pre>
				{/if}
			</div>
		{/if}

		<!-- Process context if present -->
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
