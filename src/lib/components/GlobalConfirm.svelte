<script lang="ts">
	import Modal from './Modal.svelte';
	import { confirmState } from '$lib/confirm';

	function handleClose(result: boolean) {
		if ($confirmState.resolve) {
			$confirmState.resolve(result);
		}
		$confirmState.show = false;
	}
</script>

<Modal show={$confirmState.show} title="Confirmation Required" onClose={() => handleClose(false)}>
	<div class="p-2">
		<p class="fs-5 mb-4">{$confirmState.message}</p>
		<div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
			<button class="btn btn-outline-secondary fw-bold px-4" onclick={() => handleClose(false)}>Cancel</button>
			<button class="btn btn-danger fw-bold px-4" onclick={() => handleClose(true)}>Confirm</button>
		</div>
	</div>
</Modal>
