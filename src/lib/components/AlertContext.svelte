<script lang="ts">
	import Icon from '@iconify/svelte';
	import {
		getOsIcon,
		getProviderName,
		formatAlertTimestamp,
		getAlertField,
		getAlertArray
	} from '$lib/alertHelpers';

	let { alert, meta } = $props<{
		alert: Record<string, unknown>;
		meta: {
			alert_id: number;
			device_id: number;
			reported_timestamp: string;
			device: string;
			status: string;
			last_seen?: string;
			severity?: string;
			severity_number?: number;
		};
	}>();

	let userName = $derived(getAlertField(alert, 'user.name'));
	let relatedUsers = $derived(getAlertArray(alert, 'related.user'));
	let osType = $derived(getAlertField(alert, 'host.os.type') ?? '');
	let osIcon = $derived(getOsIcon(osType));
	let osLabel = $derived(osType ? osType.charAt(0).toUpperCase() + osType.slice(1) : 'N/A');
	let provider = $derived(getAlertField(alert, 'event.provider') ?? '');
	let providerName = $derived(getProviderName(provider));
	let dataset = $derived(getAlertField(alert, 'event.dataset'));
	let eventTimestamp = $derived(getAlertField(alert, '@timestamp'));
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Context</h6>
		<div class="row">
			<!-- Row 1 -->
			<div class="col-12 col-md-6">
				<div class="mb-2">
					<div class="small text-body-secondary fw-bold d-flex align-items-center gap-1"><Icon icon="lucide:user" /> User</div>
					{#if userName}
						<div class="fw-semibold">{userName}</div>
					{:else if relatedUsers && relatedUsers.length > 0}
						<div class="fw-semibold">{relatedUsers.join(', ')}</div>
					{:else}
						<div class="fw-semibold text-body-secondary">N/A</div>
					{/if}
				</div>
			</div>

			<div class="col-12 col-md-6">
				<div class="mb-2">
					<div class="small text-body-secondary fw-bold d-flex align-items-center gap-1"><Icon icon="lucide:monitor" /> Device</div>
					<div class="fw-semibold">
						{meta.device}
						{#if meta.status === 'online'}
							<span class="text-success">●</span>
						{:else}
							<span class="text-danger">●</span>
						{/if}
					</div>
					{#if meta.status === 'offline' && meta.last_seen}
						<div class="small text-body-secondary">Last seen: {meta.last_seen}</div>
					{/if}
				</div>
			</div>

			<!-- Row 2 -->
			<div class="col-12 col-md-6">
				<div class="mb-2">
					<div class="small text-body-secondary fw-bold d-flex align-items-center gap-1"><Icon icon={osIcon} /> Operating System</div>
					<div class="fw-semibold">{osLabel}</div>
				</div>
			</div>

			<div class="col-12 col-md-6">
				<div class="mb-2">
					<div class="small text-body-secondary fw-bold d-flex align-items-center gap-1"><Icon icon="lucide:radio" /> Telemetry Source</div>
					<div class="fw-semibold">{providerName}</div>
					{#if dataset}
						<div class="small text-body-secondary">{dataset}</div>
					{/if}
				</div>
			</div>

			<!-- Row 3: Timestamps (full width) -->
			<div class="col-12">
				<div class="mb-2">
					<div class="small text-body-secondary fw-bold d-flex align-items-center gap-1"><Icon icon="lucide:clock" /> Timestamps</div>
					{#if eventTimestamp}
						<div class="fw-semibold">Event occurred: {formatAlertTimestamp(eventTimestamp)}</div>
					{/if}
					<div class="fw-semibold">Reported: {formatAlertTimestamp(meta.reported_timestamp)}</div>
				</div>
			</div>
		</div>
	</div>
</div>
