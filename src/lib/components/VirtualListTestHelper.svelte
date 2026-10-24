<script lang="ts">
	import VirtualList from './VirtualList.svelte';

	interface Props {
		items?: string[];
	}

	let { items = [] }: Props = $props();
</script>

<VirtualList {items} estimatedItemHeight={40}>
	{#snippet children(item, index)}
		<div class="test-item" data-index={index}>{item}</div>
	{/snippet}
	{#snippet empty()}
		<div>No items found</div>
	{/snippet}
</VirtualList>
