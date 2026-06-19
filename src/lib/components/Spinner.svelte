<script lang="ts">
	let {
		size = 'md',
		color = 'primary',
		text = '',
		centered = false,
		inline = false,
		py = 4
	}: {
		size?: 'sm' | 'md' | 'lg';
		color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark' | 'muted';
		text?: string;
		centered?: boolean;
		inline?: boolean;
		py?: number;
	} = $props();

	// Map sizes to bootstrap size classes
	const spinnerClass = $derived(size === 'sm' ? 'spinner-border spinner-border-sm' : 'spinner-border');
	const textClass = $derived(`text-${color}`);
</script>

{#if inline}
	<span class="{spinnerClass} {textClass} {text ? 'me-2' : ''}" role="status" aria-hidden="true"></span>
	{#if text}
		<span>{text}</span>
	{/if}
{:else if centered}
	<div class="text-center text-muted py-{py}">
		<div class="{spinnerClass} {textClass} {text ? 'mb-2' : ''}" role="status" style={size === 'lg' ? 'width: 2.5rem; height: 2.5rem;' : ''}>
			{#if !text}
				<span class="visually-hidden">Loading...</span>
			{/if}
		</div>
		{#if text}
			<div>{text}</div>
		{/if}
	</div>
{:else}
	<div class="{spinnerClass} {textClass}" role="status" style={size === 'lg' ? 'width: 2.5rem; height: 2.5rem;' : ''}>
		<span class="visually-hidden">Loading...</span>
	</div>
{/if}
