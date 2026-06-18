<script lang="ts">
	import { getAlertField, getAlertNumber, getDirectionLabel } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let processName = $derived(getAlertField(alert, 'process.name'));
	let pid = $derived(getAlertNumber(alert, 'process.pid'));
	let userName = $derived(getAlertField(alert, 'user.name'));

	let destIp = $derived(getAlertField(alert, 'destination.ip'));
	let destPort = $derived(getAlertNumber(alert, 'destination.port'));
	let direction = $derived(getAlertField(alert, 'network.direction'));
	let networkType = $derived(getAlertField(alert, 'network.type'));

	let directionLabel = $derived(direction ? getDirectionLabel(direction) : undefined);
	let networkTypeDisplay = $derived(
		networkType === 'ipv4' ? 'IPv4' : networkType === 'ipv6' ? 'IPv6' : (networkType ?? '')
	);
	let isIngress = $derived(direction === 'ingress');

	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));
	let prompt = $derived(osType === 'windows' ? '>' : '$');

	let hasFlowInfo = $derived(!!(processName || destIp));
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Network Connection</h6>

		{#if hasFlowInfo}
			<div
				class="bg-body-secondary p-3 mb-3"
				style="font-family: 'Hack', monospace; font-size: 0.85rem; white-space: pre-wrap;"
			>
				<div class="d-flex align-items-center gap-2 flex-wrap">
					<span
						>{processName ?? 'unknown'}{pid !== undefined ? ` (PID ${pid})` : ''}</span
					>
					{#if isIngress}
						<span class="text-primary">◀──────</span>
					{:else}
						<span class="text-primary">──────▶</span>
					{/if}
					<span
						>{destIp ?? '?'}{destPort !== undefined ? ` : ${destPort}` : ''}</span
					>
				</div>
				<div class="d-flex gap-4 mt-1 text-body-secondary">
					{#if userName}
						<span>user: {userName}</span>
					{/if}
					{#if directionLabel}
						<span>{directionLabel}</span>
					{/if}
					{#if networkTypeDisplay}
						<span>{networkTypeDisplay}</span>
					{/if}
				</div>
			</div>
		{/if}

		<table class="table table-sm table-borderless mb-0">
			<tbody>
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
				{#if directionLabel}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Direction</td>
						<td>{directionLabel}</td>
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

		{#if commandLine}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Command Executed</h6>
			<div
				class="bg-body-secondary p-3 mb-3"
				style="font-family: 'Hack', monospace; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem;"
			>
				<span class="text-body-secondary">{prompt}</span> {commandLine}
			</div>
		{/if}

		<div class="mt-3">
			<ProcessTree {alert} />
		</div>
	</div>
</div>
