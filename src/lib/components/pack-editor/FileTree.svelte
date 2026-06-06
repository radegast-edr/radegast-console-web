<script lang="ts">
	import FileTreeNode from './FileTreeNode.svelte';

	interface FileNode {
		name: string;
		path: string;
		type: 'file' | 'directory';
		children?: FileNode[];
		language?: string;
	}

	let { nodes = $bindable([]), selectedPath = $bindable(''), onSelect = $bindable(() => {}) } = $props<{
		nodes?: FileNode[];
		selectedPath?: string;
		onSelect?: (node: FileNode) => void;
	}>();

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
</script>

<div class="file-tree" data-testid="file-tree">
	{#each nodes as node}
		<FileTreeNode 
			node={node}
			selectedPath={selectedPath}
			onSelect={onSelect}
			depth={0}
		/>
	{/each}
</div>

<style>
	.file-tree {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 0.9rem;
	}
</style>
