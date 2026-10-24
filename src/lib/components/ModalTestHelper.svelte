<script lang="ts">
	import Modal from './Modal.svelte';

	interface Props {
		show?: boolean;
		title?: string;
		onClose?: () => void;
	}

	let { show = false, title = 'Test Modal', onClose = () => {} }: Props = $props();
</script>

<Modal {show} {title} {onClose}>
	<div data-testid="modal-content">Modal Child Content</div>
</Modal>
