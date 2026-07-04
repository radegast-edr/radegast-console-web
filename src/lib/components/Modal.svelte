<script lang="ts">
	import type { Snippet } from 'svelte';

	let { show = false, title = '', onClose = () => {}, preventClose = false, children } = $props<{
		show?: boolean;
		title?: string;
		onClose?: () => void;
		preventClose?: boolean;
		children: Snippet;
	}>();
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop fade show" onclick={preventClose ? null : onClose}></div>
	<div class="modal fade show d-block" tabindex="-1">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{title}</h5>
					{#if !preventClose}
						<button type="button" class="btn-close" aria-label="Close" onclick={onClose}></button>
					{/if}
				</div>
				<div class="modal-body">
					{@render children()}
				</div>
			</div>
		</div>
	</div>
{/if}
