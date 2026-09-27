<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		items: T[];
		estimatedItemHeight?: number;
		overscan?: number;
		containerHeight?: string;
		fillRemainingHeight?: boolean;
		bottomOffset?: number;
		minHeight?: number;
		class?: string;
		children: Snippet<[T, number]>;
		empty?: Snippet;
	}

	let {
		items = [],
		estimatedItemHeight = 180,
		overscan = 5,
		containerHeight = '100%',
		fillRemainingHeight = false,
		bottomOffset = 24,
		minHeight = 250,
		class: className = '',
		children,
		empty
	}: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let scrollTop = $state(0);
	let viewportHeight = $state(0);
	let measuredHeights = $state<Record<number, number>>({});
	let calculatedHeight = $state<string | null>(null);

	function updateHeightToBottom() {
		if (!fillRemainingHeight || !containerEl || typeof window === 'undefined') return;
		const rect = containerEl.getBoundingClientRect();
		const available = window.innerHeight - rect.top - bottomOffset;
		calculatedHeight = `${Math.max(minHeight, Math.floor(available))}px`;
		if (containerEl.clientHeight > 0) {
			viewportHeight = containerEl.clientHeight;
		}
	}

	// Reset measurements when items array is cleared or replaced with new list
	let prevItemsLength = 0;
	$effect(() => {
		if (items.length === 0 && prevItemsLength > 0) {
			measuredHeights = {};
		}
		prevItemsLength = items.length;
	});

	function getItemHeight(index: number): number {
		return measuredHeights[index] ?? estimatedItemHeight;
	}

	const cumulativeHeights = $derived.by(() => {
		const positions: number[] = [0];
		let total = 0;
		for (let i = 0; i < items.length; i++) {
			total += getItemHeight(i);
			positions.push(total);
		}
		return positions;
	});

	const totalHeight = $derived(cumulativeHeights[items.length] ?? 0);

	const visibleRange = $derived.by(() => {
		if (items.length === 0) {
			return { startIndex: 0, endIndex: -1, topOffset: 0, bottomOffset: 0 };
		}

		// Fallback to 800px if viewportHeight is 0 (e.g., in jsdom/vitest environments)
		const effectiveHeight = viewportHeight > 0 ? viewportHeight : 800;
		const viewTop = Math.max(0, scrollTop);
		const viewBottom = viewTop + effectiveHeight;

		// Binary search or linear scan for start index
		let start = 0;
		let low = 0;
		let high = items.length - 1;
		while (low <= high) {
			const mid = Math.floor((low + high) / 2);
			if (cumulativeHeights[mid + 1] <= viewTop) {
				low = mid + 1;
			} else {
				start = mid;
				high = mid - 1;
			}
		}

		// Find end index
		let end = start;
		while (end < items.length && cumulativeHeights[end] < viewBottom) {
			end++;
		}

		const startIndex = Math.max(0, start - overscan);
		const endIndex = Math.min(items.length - 1, end + overscan);

		const topOffset = cumulativeHeights[startIndex] ?? 0;
		const bottomOffset = Math.max(0, totalHeight - (cumulativeHeights[endIndex + 1] ?? totalHeight));

		return { startIndex, endIndex, topOffset, bottomOffset };
	});

	const visibleItems = $derived.by(() => {
		const { startIndex, endIndex } = visibleRange;
		if (endIndex < startIndex || items.length === 0) return [];
		return items.slice(startIndex, endIndex + 1).map((item, i) => ({
			item,
			index: startIndex + i
		}));
	});

	function handleScroll() {
		if (containerEl) {
			scrollTop = containerEl.scrollTop;
			viewportHeight = containerEl.clientHeight;
		}
	}

	function measureItem(node: HTMLElement, index: number) {
		const updateHeight = () => {
			const h = node.offsetHeight;
			if (h > 0 && measuredHeights[index] !== h) {
				measuredHeights = { ...measuredHeights, [index]: h };
			}
		};

		updateHeight();

		let observer: ResizeObserver | null = null;
		if (typeof ResizeObserver !== 'undefined') {
			observer = new ResizeObserver(() => {
				updateHeight();
			});
			observer.observe(node);
		}

		return {
			update(newIndex: number) {
				index = newIndex;
				updateHeight();
			},
			destroy() {
				if (observer) {
					observer.disconnect();
				}
			}
		};
	}

	onMount(() => {
		if (containerEl) {
			scrollTop = containerEl.scrollTop;
			viewportHeight = containerEl.clientHeight;
		}

		if (fillRemainingHeight) {
			updateHeightToBottom();
			window.addEventListener('resize', updateHeightToBottom);
		}

		let observer: ResizeObserver | null = null;
		if (typeof ResizeObserver !== 'undefined' && containerEl) {
			observer = new ResizeObserver((entries) => {
				for (const entry of entries) {
					if (entry.contentRect.height > 0) {
						viewportHeight = entry.contentRect.height;
					}
				}
			});
			observer.observe(containerEl);
		}

		const handleResize = () => {
			if (containerEl && containerEl.clientHeight > 0) {
				viewportHeight = containerEl.clientHeight;
			}
		};
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			if (fillRemainingHeight) {
				window.removeEventListener('resize', updateHeightToBottom);
			}
			if (observer) {
				observer.disconnect();
			}
		};
	});

	$effect(() => {
		if (fillRemainingHeight && items) {
			requestAnimationFrame(() => {
				updateHeightToBottom();
			});
		}
	});
</script>

<div
	bind:this={containerEl}
	class="virtual-list-container {className}"
	style="height: {calculatedHeight ?? containerHeight}; max-height: {calculatedHeight ?? containerHeight}; overflow-y: auto; position: relative;"
	onscroll={handleScroll}
	data-testid="virtual-list"
>
	{#if items.length === 0}
		{#if empty}
			{@render empty()}
		{/if}
	{:else}
		<div style="height: {visibleRange.topOffset}px; width: 100%; pointer-events: none;" aria-hidden="true"></div>
		{#each visibleItems as { item, index } (index)}
			<div use:measureItem={index} data-index={index}>
				{@render children(item, index)}
			</div>
		{/each}
		<div style="height: {visibleRange.bottomOffset}px; width: 100%; pointer-events: none;" aria-hidden="true"></div>
	{/if}
</div>

<style>
	.virtual-list-container {
		scrollbar-width: thin;
		scrollbar-color: var(--bs-secondary-border-subtle, #555) transparent;
	}
	.virtual-list-container::-webkit-scrollbar {
		width: 6px;
	}
	.virtual-list-container::-webkit-scrollbar-thumb {
		background-color: var(--bs-secondary-border-subtle, #555);
		border-radius: 3px;
	}
</style>
