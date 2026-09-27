<script lang="ts">
	import VirtualList from './VirtualList.svelte';

	let { items = [] } = $props<{ items?: string[] }>();
</script>

<VirtualList {items} estimatedItemHeight={40}>
	{#snippet children(item, index)}
		<div class="test-item" data-index={index}>{item}</div>
	{/snippet}
	{#snippet empty()}
		<div>No items found</div>
	{/snippet}
</VirtualList>
