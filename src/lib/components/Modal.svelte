<script>
	let { show = false, title = '', onClose = () => {}, children } = $props();
</script>

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop fade show" onclick={onClose}></div>
	<div class="modal fade show d-block" tabindex="-1">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{title}</h5>
					<button type="button" class="btn-close" onclick={onClose}></button>
				</div>
				<div class="modal-body">
					{@render children()}
				</div>
			</div>
		</div>
	</div>
{/if}
