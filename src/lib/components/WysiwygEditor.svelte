<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import 'quill/dist/quill.snow.css';

	interface Props {
		value: string;
	}

	let { value = $bindable() }: Props = $props();
	let editorElement = $state<HTMLDivElement | null>(null);
	let quillInstance = $state<any>(null);

	onMount(async () => {
		if (!browser || !editorElement) return;

		const { default: Quill } = await import('quill');

		quillInstance = new Quill(editorElement, {
			theme: 'snow',
			modules: {
				toolbar: [
					[{ header: [1, 2, false] }],
					['bold', 'italic', 'underline', 'strike'],
					[{ list: 'ordered' }, { list: 'bullet' }],
					['link', 'clean']
				]
			}
		});

		// Set initial content if present
		if (value) {
			quillInstance.root.innerHTML = value;
		}

		// Update value on changes
		quillInstance.on('text-change', () => {
			value = quillInstance.root.innerHTML;
		});
	});
</script>

<div class="quill-wrapper bg-body text-body">
	<div bind:this={editorElement} class="bg-body text-body" style="min-height: 200px;"></div>
</div>

<style>
	.quill-wrapper :global(.ql-toolbar) {
		border-color: var(--bs-border-color) !important;
		border-radius: 3px 3px 0 0 !important;
		background-color: var(--bs-tertiary-bg);
	}
	.quill-wrapper :global(.ql-container) {
		border-color: var(--bs-border-color) !important;
		border-radius: 0 0 3px 3px !important;
		font-family: inherit;
		font-size: inherit;
	}
	.quill-wrapper :global(.ql-editor) {
		min-height: 200px;
	}
	.quill-wrapper :global(.ql-stroke) {
		stroke: var(--bs-body-color) !important;
	}
	.quill-wrapper :global(.ql-fill) {
		fill: var(--bs-body-color) !important;
	}
	.quill-wrapper :global(.ql-picker) {
		color: var(--bs-body-color) !important;
	}
	.quill-wrapper :global(.ql-picker-options) {
		background-color: var(--bs-body-bg) !important;
	}
</style>
