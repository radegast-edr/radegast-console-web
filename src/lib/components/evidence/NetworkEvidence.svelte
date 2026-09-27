<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getAlertField, getAlertNumber, getAlertArray, getDirectionLabel } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let processName = $derived(getAlertField(alert, 'process.name'));
	let pid = $derived(getAlertNumber(alert, 'process.pid'));
	let userName = $derived(getAlertField(alert, 'user.name'));

	let destIp = $derived(getAlertField(alert, 'destination.ip'));
	let destPort = $derived(getAlertNumber(alert, 'destination.port'));
	let sourceIp = $derived(getAlertField(alert, 'source.ip'));
	let sourcePort = $derived(getAlertNumber(alert, 'source.port'));
	let direction = $derived(getAlertField(alert, 'network.direction'));
	let networkType = $derived(getAlertField(alert, 'network.type'));
	let destinationDomain = $derived(getAlertField(alert, 'destination.domain'));
	let networkTransport = $derived(getAlertField(alert, 'network.transport'));
	let networkProtocol = $derived(getAlertField(alert, 'network.protocol'));

	// DNS specific
	let dnsQuery = $derived(getAlertField(alert, 'dns.question.name'));
	let dnsResolvedIps = $derived(getAlertArray(alert, 'dns.resolved_ip'));
	let dnsResponseCode = $derived(getAlertField(alert, 'dns.response_code'));
	let hasDnsInfo = $derived(!!(dnsQuery || (dnsResolvedIps && dnsResolvedIps.length > 0)));

	let directionLabel = $derived(direction ? getDirectionLabel(direction) : undefined);
	let networkTypeDisplay = $derived(
		networkType === 'ipv4' ? 'IPv4' : networkType === 'ipv6' ? 'IPv6' : (networkType ?? '')
	);
	let isIngress = $derived(direction === 'ingress');

	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));
	let prompt = $derived(osType === 'windows' ? '>' : '$');

	let hasFlowInfo = $derived(!!(processName || destIp || destinationDomain || dnsQuery));
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">
			{hasDnsInfo && !destIp ? 'DNS Query Activity' : 'Network Activity'}
		</h6>

		{#if hasFlowInfo}
			<div
				class="bg-body-secondary p-3 mb-3"
				style="font-family: 'Hack', monospace; font-size: 0.85rem; white-space: pre-wrap;"
			>
				<div class="d-flex align-items-center gap-2 flex-wrap">
					<span>
						{processName ?? 'unknown'}{pid !== undefined ? ` (PID ${pid})` : ''}
						{#if sourceIp}
							<span class="text-body-secondary"> ({sourceIp}{sourcePort !== undefined ? `:${sourcePort}` : ''})</span>
						{/if}
					</span>
					{#if isIngress}
						<span class="text-primary">&larr;</span>
					{:else}
						<span class="text-primary">&rarr;</span>
					{/if}
					<span>
						{#if destinationDomain}
							<strong class="text-primary">{destinationDomain}</strong>
							{#if destIp}
								<span class="text-body-secondary"> ({destIp}{destPort !== undefined ? `:${destPort}` : ''})</span>
							{/if}
						{:else if destIp}
							{destIp}{destPort !== undefined ? `:${destPort}` : ''}
						{:else if dnsQuery}
							<strong class="text-primary">{dnsQuery}</strong>
						{:else}
							?
						{/if}
					</span>
				</div>
				<div class="d-flex flex-wrap gap-3 mt-2 text-body-secondary small">
					{#if userName}
						<span>user: {userName}</span>
					{/if}
					{#if directionLabel}
						<span>{directionLabel}</span>
					{/if}
					{#if networkTransport}
						<span class="badge bg-secondary-subtle text-secondary border text-uppercase">{networkTransport}</span>
					{/if}
					{#if networkProtocol}
						<span class="badge bg-info-subtle text-info border text-uppercase">{networkProtocol}</span>
					{/if}
					{#if networkTypeDisplay}
						<span>{networkTypeDisplay}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- DNS Query Specific Box -->
		{#if hasDnsInfo}
			<div class="p-3 mb-3 border border-secondary-subtle bg-body-secondary" style="border-radius: 3px;">
				<div class="small fw-bold text-body-secondary mb-2 d-flex align-items-center gap-1">
					<Icon icon="lucide:globe" class="text-primary" />
					DNS Resolution
				</div>
				<table class="table table-sm table-borderless small mb-0">
					<tbody>
						{#if dnsQuery}
							<tr>
								<td class="text-body-secondary" style="width: 140px;">Queried Domain</td>
								<td class="font-monospace fw-bold text-break">{dnsQuery}</td>
							</tr>
						{/if}
						{#if dnsResponseCode}
							<tr>
								<td class="text-body-secondary">Response Code</td>
								<td><span class="badge bg-secondary">{dnsResponseCode}</span></td>
							</tr>
						{/if}
						{#if dnsResolvedIps && dnsResolvedIps.length > 0}
							<tr>
								<td class="text-body-secondary">Resolved IPs</td>
								<td>
									{#each dnsResolvedIps as ip}
										<span class="badge bg-body-tertiary text-body border font-monospace me-1">{ip}</span>
									{/each}
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{/if}

		<table class="table table-sm table-borderless mb-0">
			<tbody>
				{#if destinationDomain}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Domain</td>
						<td class="fw-semibold text-break">{destinationDomain}</td>
					</tr>
				{/if}
				{#if destIp}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Destination IP</td>
						<td style="font-family: 'Hack', monospace;">{destIp}</td>
					</tr>
				{/if}
				{#if destPort !== undefined}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Destination Port</td>
						<td>{destPort}</td>
					</tr>
				{/if}
				{#if sourceIp}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Source IP</td>
						<td style="font-family: 'Hack', monospace;">{sourceIp}</td>
					</tr>
				{/if}
				{#if sourcePort !== undefined}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Source Port</td>
						<td>{sourcePort}</td>
					</tr>
				{/if}
				{#if directionLabel}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Direction</td>
						<td>{directionLabel}</td>
					</tr>
				{/if}
				{#if networkTransport}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Transport</td>
						<td><span class="text-uppercase">{networkTransport}</span></td>
					</tr>
				{/if}
				{#if networkProtocol}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Protocol</td>
						<td><span class="text-uppercase">{networkProtocol}</span></td>
					</tr>
				{/if}
				{#if networkTypeDisplay}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Network Type</td>
						<td>{networkTypeDisplay}</td>
					</tr>
				{/if}
			</tbody>
		</table>

		{#if processName}
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
