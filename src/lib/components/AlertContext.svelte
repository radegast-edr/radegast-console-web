<script lang="ts">
	import Icon from '@iconify/svelte';
	import { base } from '$app/paths';
	import {
		getOsIcon,
		getProviderName,
		formatAlertTimestamp,
		getAlertField,
		getAlertArray
	} from '$lib/alertHelpers';

	let { alert, meta, deviceGroups = [], userGroups = [], triggeredRule = null } = $props<{
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
		deviceGroups?: Array<{ id: number; name: string }>;
		userGroups?: Array<{ id: number; name: string }>;
		triggeredRule?: { rule_type: string; rule_id: string; rule_content: string; pack_id?: number | null; pack_name?: string | null } | null;
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
					{#if deviceGroups && deviceGroups.length > 0}
						<div class="mt-1 d-flex flex-wrap gap-1 align-items-center" style="margin-top: 0.35rem !important;">
							<span class="text-body-secondary small me-1">Groups:</span>
							{#each deviceGroups as group}
								{@const isMember = userGroups.some((ug: { id: number }) => ug.id === group.id)}
								{#if isMember}
									<a
										href="{base}/groups/{group.id}"
										class="badge bg-primary-subtle text-primary border border-primary-subtle text-decoration-none"
										style="font-size: 0.75rem;"
									>
										{group.name}
									</a>
								{:else}
									<span
										class="badge bg-secondary-subtle text-secondary border"
										style="font-size: 0.75rem;"
									>
										{group.name}
									</span>
								{/if}
							{/each}
						</div>
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

			{#if triggeredRule && triggeredRule.pack_id && triggeredRule.pack_name}
				<div class="col-12 col-md-6">
					<div class="mb-2">
						<div class="small text-body-secondary fw-bold d-flex align-items-center gap-1"><Icon icon="lucide:package" /> Detection Pack</div>
						<div class="fw-semibold">
							<a
								href="{base}/packs/{triggeredRule.pack_id}"
								class="text-primary text-decoration-none d-inline-flex align-items-center gap-1"
							>
								{triggeredRule.pack_name}
							</a>
						</div>
					</div>
				</div>
			{/if}

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
