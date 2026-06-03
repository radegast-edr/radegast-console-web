<script lang="ts">
	import Modal from './Modal.svelte';

	let { show = false, title = 'Test Modal', onClose = () => {} } = $props<{
		show?: boolean;
		title?: string;
		onClose?: () => void;
	}>();
</script>

<Modal {show} {title} {onClose}>
	<div data-testid="modal-content">Modal Child Content</div>
</Modal>
