<script lang="ts">
	import Icon from '@iconify/svelte';
	let { alert, initialExpanded = false } = $props<{
		alert: Record<string, unknown>;
		initialExpanded?: boolean;
	}>();

	let expanded = $state(false);
	$effect(() => {
		// Only set it once on mount if initialExpanded is true
		if (initialExpanded) {
			expanded = true;
		}
	});
	let copied = $state(false);

	function syntaxHighlightJson(json: string): string {
		if (!json) return '';
		const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return escaped.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
			(match) => {
				let cls = 'number';
				if (match.startsWith('"')) {
					if (match.endsWith(':')) cls = 'key';
					else cls = 'string';
				} else if (match === 'true' || match === 'false') cls = 'boolean';
				else if (match === 'null') cls = 'null';

				if (cls === 'key')
					return `<span style="color: #ff79c6; font-weight: bold;">${match}</span>`;
				else if (cls === 'string') return `<span style="color: #f1fa8c;">${match}</span>`;
				else if (cls === 'number') return `<span style="color: #bd93f9;">${match}</span>`;
				else if (cls === 'boolean')
					return `<span style="color: #50fa7b; font-weight: bold;">${match}</span>`;
				else return `<span style="color: #6272a4;">${match}</span>`;
			}
		);
	}

	let jsonString = $derived(JSON.stringify(alert, null, 2));
	let highlightedJson = $derived(syntaxHighlightJson(jsonString));

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(jsonString);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// Clipboard write failed silently
		}
	}

	function toggleExpanded() {
		expanded = !expanded;
	}
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<div
			class="d-flex justify-content-between align-items-center"
			style="cursor: pointer;"
			role="button"
			tabindex="0"
			aria-expanded={expanded}
			onclick={toggleExpanded}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleExpanded();
				}
			}}
		>
			<h6 class="mb-0 fw-bold d-flex align-items-center gap-2">
				<Icon icon={expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'} /> Raw Telemetry
			</h6>
			<button
				class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
				onclick={(e) => {
					e.stopPropagation();
					copyToClipboard();
				}}
				aria-label="Copy raw JSON"
			>
				{#if copied}
					<Icon icon="lucide:check" /> Copied!
				{:else}
					<Icon icon="lucide:clipboard" /> Copy
				{/if}
			</button>
		</div>

		{#if expanded}
			<pre
				class="p-3 rounded mb-0 font-monospace mt-3"
				style="background-color: #282a36 !important; color: #f8f8f2 !important; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; border: 1px solid #44475a;"
			>{@html highlightedJson}</pre>
		{/if}
	</div>
</div>
