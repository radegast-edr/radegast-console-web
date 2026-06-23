<script lang="ts">
	import { getPrimaryCategory } from '$lib/alertHelpers';
	import AlertHeader from '$lib/components/AlertHeader.svelte';
	import RuleDescription from '$lib/components/RuleDescription.svelte';
	import ProcessEvidence from '$lib/components/evidence/ProcessEvidence.svelte';
	import FileEvidence from '$lib/components/evidence/FileEvidence.svelte';
	import NetworkEvidence from '$lib/components/evidence/NetworkEvidence.svelte';
	import RegistryEvidence from '$lib/components/evidence/RegistryEvidence.svelte';
	import AlertContext from '$lib/components/AlertContext.svelte';
	import AlertActions from '$lib/components/AlertActions.svelte';
	import RawTelemetry from '$lib/components/RawTelemetry.svelte';

	interface AlertMeta {
		alert_id: number;
		device_id: number;
		reported_timestamp: string;
		device: string;
		status: string;
		last_seen?: string;
		severity?: string;
		severity_number?: number;
		excluded_by?: { id: number; group: { id: number; name: string } } | null;
	}

	let {
		alert,
		meta,
		triggeredRule = null,
		hasPackWritePermission = false,
		extendedEdrEnabled = false,
		resolution = 'none',
		triageNote = '',
		savingResolution = false,
		onViewRule,
		onAiAnalysis,
		onCreateExclusion,
		onSaveResolution,
		onResolutionChange,
		onTriageNoteChange
	}: {
		alert: Record<string, unknown>;
		meta: AlertMeta;
		triggeredRule?: { rule_type: string; rule_id: string; rule_content: string } | null;
		hasPackWritePermission?: boolean;
		extendedEdrEnabled?: boolean;
		resolution?: string;
		triageNote?: string;
		savingResolution?: boolean;
		onViewRule?: () => void;
		onAiAnalysis?: () => void;
		onCreateExclusion?: () => void;
		onSaveResolution?: () => void;
		onResolutionChange?: (value: string) => void;
		onTriageNoteChange?: (value: string) => void;
	} = $props();

	const category = $derived(typeof alert === 'object' && alert !== null ? getPrimaryCategory(alert) : 'unknown');
	const isDecrypted = $derived(typeof alert === 'object' && alert !== null);
</script>

{#if isDecrypted}
	<!-- ① Alert Header -->
	<AlertHeader {alert} {meta} />

	<!-- ② Rule Description -->
	<RuleDescription {alert} />

	<!-- ③ Category-Specific Evidence -->
	{#if category === 'process'}
		<ProcessEvidence {alert} />
	{:else if category === 'file'}
		<FileEvidence {alert} />
	{:else if category === 'network'}
		<NetworkEvidence {alert} />
	{:else if category === 'registry'}
		<RegistryEvidence {alert} />
	{:else}
		<!-- Unknown category: show raw telemetry expanded -->
		<RawTelemetry {alert} initialExpanded={true} />
	{/if}

	<!-- ④ Context Card -->
	<AlertContext {alert} {meta} />

	<!-- ⑤ Actions Bar -->
	<AlertActions
		{triggeredRule}
		{hasPackWritePermission}
		{extendedEdrEnabled}
		{resolution}
		{onViewRule}
		{onAiAnalysis}
		{onCreateExclusion}
		isExcluded={!!meta.excluded_by}
	/>

	<!-- ⑥ Triage Section (Extended EDR only) -->
	{#if extendedEdrEnabled}
		<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
			<div class="card-body">
				<div class="d-flex justify-content-between align-items-center mb-3">
					<h6 class="fw-bold mb-0 text-primary">Extended EDR Triage</h6>
					<span class="badge bg-primary">Enabled</span>
				</div>

				<div class="mb-3">
					<label for="triageNote" class="form-label fw-bold small">TRIAGE NOTES (E2EE):</label>
					<textarea
						id="triageNote"
						class="form-control"
						rows="3"
						placeholder="No note so far."
						value={triageNote}
						oninput={(e) => onTriageNoteChange?.(e.currentTarget.value)}
					></textarea>
				</div>

				<div class="d-flex align-items-end gap-3">
					<div class="flex-grow-1">
						<label for="resolution" class="form-label fw-bold small">RESOLUTION:</label>
						<select
							id="resolution"
							class="form-select fw-bold"
							value={resolution}
							onchange={(e) => onResolutionChange?.(e.currentTarget.value)}
						>
							<option value="none">None</option>
							<option value="read">Read (Acknowledge)</option>
							<option value="true_positive">True Positive</option>
							<option value="false_positive">False Positive</option>
						</select>
					</div>
					<button
						class="btn btn-primary fw-bold"
						onclick={onSaveResolution}
						disabled={savingResolution}
					>
						{savingResolution ? 'Saving...' : 'Save Triage'}
					</button>
				</div>

				{#if hasPackWritePermission && resolution === 'false_positive'}
					<div class="d-flex justify-content-end mt-3">
						<button
							class="btn btn-sm btn-outline-secondary"
							onclick={onCreateExclusion}
							title={meta.excluded_by ? "Edit exclusion for this alert" : "Create exclusion from this alert"}
						>
							{meta.excluded_by ? "Edit Exclusion" : "Create Exclusion"}
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ⑦ Raw Telemetry (collapsed by default, unless already shown for unknown category) -->
	{#if category !== 'unknown'}
		<RawTelemetry {alert} />
	{/if}
{:else}
	<!-- Alert not decrypted -->
	<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
		<div class="card-body text-center text-body-secondary p-4">
			<p class="mb-0">{typeof alert === 'string' ? alert : 'Unable to display alert content.'}</p>
		</div>
	</div>
{/if}
