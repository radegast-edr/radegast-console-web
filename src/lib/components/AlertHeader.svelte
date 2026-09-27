<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '@iconify/svelte';
	import {
		getSeverityClass,
		getOsIcon,
		getCategoryDisplay,
		formatAlertTimestamp,
		getAlertField,
		getAlertNumber,
		getAlertArray,
		getYaraSourceLabel,
		getIntegrityBadgeClass
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
	let yaraScanSource = $derived(getAlertField(alert, 'edr.yara.scan_source'));
	let yaraSourceLabel = $derived(getYaraSourceLabel(yaraScanSource));

	// Deduplication repeat count
	let eventCount = $derived(getAlertNumber(alert, 'event.count'));

	// Extended context
	let targetImage = $derived(getAlertField(alert, 'edr.process.target_image'));
	let containerId = $derived(getAlertField(alert, 'container.id'));
	let containerRuntime = $derived(getAlertField(alert, 'container.runtime'));
	let integrityLevel = $derived(getAlertField(alert, 'edr.process.integrity_level'));
	let sigmaStatus = $derived(getAlertField(alert, 'edr.sigma.status'));

	let eventCategories = $derived(getAlertArray(alert, 'event.category'));
	let primaryCategory = $derived(eventCategories?.[0] ?? '');
	let categoryDisplay = $derived(getCategoryDisplay(primaryCategory));
	let timestamp = $derived(
		getAlertField(alert, '@timestamp') ?? meta.reported_timestamp
	);
	let parentCommandLine = $derived(getAlertField(alert, 'process.parent.command_line'));
	let sourceIp = $derived(getAlertField(alert, 'source.ip'));
	let destinationIp = $derived(getAlertField(alert, 'destination.ip'));
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Overview</h6>

		<!-- Deduplication Rollup Callout -->
		{#if eventCount && eventCount > 0}
			<div class="alert alert-warning py-2 px-3 d-flex align-items-center gap-2 mb-3" style="border-radius: 3px;">
				<Icon icon="lucide:layers" class="text-warning-emphasis flex-shrink-0" />
				<span class="small">
					<strong>Aggregated Detections:</strong> This detection repeated <strong>{eventCount + 1} times</strong> ({eventCount} identical occurrences were suppressed by sliding-window deduplication).
				</span>
			</div>
		{/if}
		
		<!-- Line 1: Rule name -->
		<div class="mb-3">
			<h5 class="mb-1 fw-bold">{ruleName ?? `Alert #${meta.alert_id}`}</h5>
			<div class="d-flex align-items-center flex-wrap gap-2">
				<span class="badge {severityClass} text-uppercase">{severity}</span>
				{#if eventCount && eventCount > 0}
					<span class="badge bg-warning-subtle text-warning-emphasis border border-warning" title="{eventCount} duplicates suppressed">
						+{eventCount} repeats
					</span>
				{/if}
				{#if sigmaStatus}
					<span class="badge bg-secondary text-uppercase" style="font-size: 0.7rem;">
						{sigmaStatus}
					</span>
				{/if}
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
					<Icon icon="lucide:zap" />
					{engine}
					{#if yaraSourceLabel}
						<span class="text-body-secondary">({yaraSourceLabel})</span>
					{/if}
				</span>
			{/if}

			{#if primaryCategory}
				<span class="d-flex align-items-center gap-1">
					<Icon icon={categoryDisplay.icon} /> {categoryDisplay.label}
				</span>
			{/if}

			{#if targetImage}
				<span class="d-flex align-items-center gap-1 text-danger" title="Target Process">
					<Icon icon="lucide:crosshair" /> Target: {targetImage}
				</span>
			{/if}

			{#if containerId}
				<span class="d-flex align-items-center gap-1" title="Containerized execution">
					<Icon icon="lucide:box" /> {containerRuntime ?? 'Container'}: {containerId.slice(0, 12)}
				</span>
			{/if}

			{#if integrityLevel}
				<span class="d-flex align-items-center gap-1">
					<Icon icon="lucide:shield" />
					<span class="badge {getIntegrityBadgeClass(integrityLevel)}" style="font-size: 0.7rem;">{integrityLevel}</span>
				</span>
			{/if}

			{#if sourceIp}
				<span class="d-flex align-items-center gap-1">
					<Icon icon="lucide:arrow-up-right" /> Src: {sourceIp}
				</span>
			{/if}

			{#if destinationIp}
				<span class="d-flex align-items-center gap-1">
					<Icon icon="lucide:arrow-down-left" /> Dst: {destinationIp}
				</span>
			{/if}
		</div>

		{#if parentCommandLine}
			<div class="mt-3 pt-3 border-top">
				<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1">
					<Icon icon="lucide:terminal" /> Parent Command Line
				</div>
				<pre class="bg-body-secondary text-body p-2 mb-0 overflow-auto font-monospace small" style="border-radius: 3px; max-height: 120px;">{parentCommandLine}</pre>
			</div>
		{/if}
	</div>
</div>
