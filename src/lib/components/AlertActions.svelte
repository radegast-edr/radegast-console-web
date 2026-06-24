<script lang="ts">
	import { base } from '$app/paths';

	let {
		triggeredRule,
		hasPackWritePermission = false,
		extendedEdrEnabled = false,
		resolution = 'none',
		onViewRule,
		onAiAnalysis,
		onCreateExclusion,
		isExcluded = false
	}: {
		triggeredRule?: { rule_type: string; rule_id: string; rule_content: string; pack_id?: number | null } | null;
		hasPackWritePermission?: boolean;
		extendedEdrEnabled?: boolean;
		resolution?: string;
		onViewRule?: () => void;
		onAiAnalysis?: () => void;
		onCreateExclusion?: () => void;
		isExcluded?: boolean;
	} = $props();
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Actions</h6>
		<div class="d-flex flex-wrap gap-2">
			{#if extendedEdrEnabled && triggeredRule && onViewRule}
				<button
					class="btn btn-sm btn-outline-warning"
					onclick={onViewRule}
					title="View the rule that triggered this alert"
				>
					<span class="text-uppercase fw-bold" style="font-size: 0.7rem; letter-spacing: 0.04em;"
						>{triggeredRule.rule_type}</span
					>
					View Rule
				</button>
				{#if triggeredRule.pack_id}
					<a
						href="{base}/packs/{triggeredRule.pack_id}"
						class="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
						title="View detection pack details"
					>
						View Pack
					</a>
				{/if}
			{/if}
			{#if onAiAnalysis}
				<button
					class="btn btn-sm btn-outline-info"
					onclick={onAiAnalysis}
					title="Analyze this alert with AI"
				>
					AI Analysis
				</button>
			{/if}
			{#if onCreateExclusion && hasPackWritePermission}
				{#if !extendedEdrEnabled || (extendedEdrEnabled && resolution === 'false_positive')}
					<button
						class="btn btn-sm btn-outline-secondary"
						onclick={onCreateExclusion}
						title={isExcluded ? "Edit exclusion for this alert" : "Create exclusion from this alert"}
					>
						{isExcluded ? "Edit Exclusion" : "Create Exclusion"}
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>
