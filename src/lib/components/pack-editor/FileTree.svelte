<script lang="ts">
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
	
	.file-tree-node {
		padding: 4px 8px;
		border-radius: 4px;
		transition: background-color 0.15s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.file-tree-node:hover {
		background-color: rgba(0, 0, 0, 0.05);
	}
	
	.file-icon {
		font-size: 0.9em;
		margin-right: 4px;
	}
</style>
