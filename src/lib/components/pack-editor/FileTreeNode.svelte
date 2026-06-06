<script lang="ts">
	interface FileNode {
		name: string;
		path: string;
		type: 'file' | 'directory';
		children?: FileNode[];
		language?: string;
	}

	let { node, selectedPath, onSelect, depth = 0 } = $props<{
		node: FileNode;
		selectedPath: string;
		onSelect: (node: FileNode) => void;
		depth?: number;
	}>();

	const isSelected = $derived(node.path === selectedPath);
	const hasChildren = $derived(node.type === 'directory' && node.children && node.children.length > 0);
	
	// Check if any descendant is selected
	const isAncestorOfSelected = $derived.by(() => {
		if (node.type !== 'directory' || !node.children) return false;
		const check = (n: FileNode): boolean => {
			if (n.path === selectedPath) return true;
			if (n.children) return n.children.some(check);
			return false;
		};
		return node.children.some(check);
	});

	function getIcon(node: FileNode): string {
		if (node.type === 'directory') {
			return node.children && node.children.length > 0 ? '📁' : '📂';
		}
		const ext = node.name.slice(node.name.lastIndexOf('.')).toLowerCase();
		if (['.yaml', '.yml'].includes(ext)) return '📄';
		if (['.yara', '.yar'].includes(ext)) return '🔍';
		if (['.txt'].includes(ext)) return '📝';
		if (['.json'].includes(ext)) return '📊';
		return '📎';
	}

	function handleClick(e: MouseEvent): void {
		e.stopPropagation();
		if (node.type === 'file') {
			onSelect(node);
		}
	}

	function handleToggle(e: MouseEvent): void {
		e.stopPropagation();
		// Don't actually toggle - just let the click through to the node
	}
</script>

<div 
	class="file-tree-node d-flex align-items-center {isSelected ? 'bg-primary-subtle' : ''}"
	style="padding-left: {depth * 15 + 10}px; cursor: pointer;"
	onclick={handleClick}
>
	{#if hasChildren}
		<button 
			class="btn btn-sm btn-link p-0 me-1"
			onclick={handleToggle}
			style="width: 16px; height: 16px; font-size: 0.8rem;"
		>
			{#if isAncestorOfSelected}
				▼
			{:else}
				▶
			{/if}
		</button>
	{/if}
	{#if !hasChildren}
		<span style="width: 16px; display: inline-block;"></span>
	{/if}
		<span class="file-icon">{getIcon(node)}</span>
		<span class="small {isSelected ? 'fw-semibold' : ''}">
			{node.name}
		</span>
		{#if node.type === 'file' && node.language}
			<span class="text-muted small ms-1">({node.language})</span>
		{/if}
</div>

{#if hasChildren && isAncestorOfSelected}
	<div>
		{#each node.children as child}
			<FileTreeNode 
				node={child}
				selectedPath={selectedPath}
				onSelect={onSelect}
				depth={depth + 1}
			/>
		{/each}
	</div>
{/if}
