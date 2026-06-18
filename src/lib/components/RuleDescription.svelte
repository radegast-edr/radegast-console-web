<script lang="ts">
	import { getAlertField } from '$lib/alertHelpers';

	let { alert } = $props<{
		alert: Record<string, unknown>;
	}>();

	let description = $derived(getAlertField(alert, 'rule.description') ?? '');
</script>

{#if description}
	<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
		<div class="card-body">
			<h6 class="fw-bold text-body-secondary mb-2">What was detected?</h6>
			<p class="mb-0" style="white-space: pre-line;">{description}</p>
		</div>
	</div>
{/if}
