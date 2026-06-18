<script lang="ts">
	import type { Log } from '$lib/api';

	let {
		log,
		triggeredRule,
		hasPackWritePermission = false,
		extendedEdrEnabled = false,
		resolution = 'none',
		onViewRule,
		onAiAnalysis,
		onCreateExclusion
	}: {
		log: Log;
		triggeredRule?: { rule_type: string; rule_id: string; rule_content: string } | null;
		hasPackWritePermission?: boolean;
		extendedEdrEnabled?: boolean;
		resolution?: string;
		onViewRule?: () => void;
		onAiAnalysis?: () => void;
		onCreateExclusion?: () => void;
	} = $props();
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Actions</h6>
		<div class="d-flex flex-wrap gap-2">
			{#if triggeredRule && onViewRule}
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
						title="Create exclusion from this alert"
					>
						Create Exclusion
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>
