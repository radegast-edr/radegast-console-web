<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '@iconify/svelte';
	import {
		getSeverityClass,
		getOsIcon,
		getCategoryDisplay,
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
			excluded_by?: { id: number; group: { id: number; name: string } } | null;
		};
	}>();

	let severity = $derived(meta.severity ?? 'unknown');
	let severityClass = $derived(getSeverityClass(severity));
	let ruleName = $derived(getAlertField(alert, 'rule.name'));
	let osType = $derived(getAlertField(alert, 'host.os.type') ?? '');
	let osIcon = $derived(getOsIcon(osType));
	let osLabel = $derived(osType ? osType.charAt(0).toUpperCase() + osType.slice(1) : '');
	let engine = $derived(getAlertField(alert, 'edr.rule.engine'));
	let eventCategories = $derived(getAlertArray(alert, 'event.category'));
	let primaryCategory = $derived(eventCategories?.[0] ?? '');
	let categoryDisplay = $derived(getCategoryDisplay(primaryCategory));
	let timestamp = $derived(
		getAlertField(alert, '@timestamp') ?? meta.reported_timestamp
	);
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Overview</h6>
		
		<!-- Line 1: Rule name -->
		<div class="mb-3">
			<h5 class="mb-1 fw-bold">{ruleName ?? `Alert #${meta.alert_id}`}</h5>
			<div class="d-flex align-items-center gap-2">
				<span class="badge {severityClass} text-uppercase">{severity}</span>
				<span class="text-body-secondary small d-flex align-items-center gap-1">
					<Icon icon="lucide:calendar" /> {formatAlertTimestamp(timestamp)}
				</span>
				{#if meta.excluded_by}
					<a
						href="{base}/groups/{meta.excluded_by.group.id}"
						class="badge bg-info text-white text-decoration-none"
					>
						Excluded
					</a>
				{/if}
			</div>
		</div>

		<!-- Line 2: Metadata as simple text instead of pills -->
		<div class="d-flex flex-wrap gap-4 small fw-semibold text-body-secondary">
			<span class="d-flex align-items-center gap-1">
				<Icon icon="lucide:monitor" /> {meta.device}
				{#if meta.status === 'offline'}
					<span class="text-danger d-flex align-items-center" title="Device Offline"><Icon icon="lucide:ban" /></span>
				{/if}
			</span>

			{#if osLabel}
				<span class="d-flex align-items-center gap-1">
					<Icon icon={osIcon} /> {osLabel}
				</span>
			{/if}

			{#if engine}
				<span class="d-flex align-items-center gap-1">
					<Icon icon="lucide:zap" /> {engine}
				</span>
			{/if}

			{#if primaryCategory}
				<span class="d-flex align-items-center gap-1">
					<Icon icon={categoryDisplay.icon} /> {categoryDisplay.label}
				</span>
			{/if}
		</div>
	</div>
</div>

