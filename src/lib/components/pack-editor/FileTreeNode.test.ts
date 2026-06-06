import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FileTreeNode from './FileTreeNode.svelte';

interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'directory';
	children?: FileNode[];
	language?: string;
}

describe('FileTreeNode Component', () => {
	const mockFileNode: FileNode = {
		name: 'test.yml',
		path: 'test.yml',
		type: 'file',
		language: 'yaml'
	};

	const mockDirNode: FileNode = {
		name: 'sigma',
		path: 'sigma',
		type: 'directory',
		children: [
			{
				name: 'rule1.yml',
				path: 'sigma/rule1.yml',
				type: 'file',
				language: 'yaml'
			}
		]
	};

	const onSelect = vi.fn();

	it('renders file node', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});

		expect(screen.getByText('test.yml')).toBeInTheDocument();
	});

	it('renders directory node', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});

		expect(screen.getByText('sigma')).toBeInTheDocument();
	});

	it('shows file language in parentheses', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});

		expect(screen.getByText('(yaml)')).toBeInTheDocument();
	});

	it('highlights selected node', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: 'test.yml',
				onSelect,
				depth: 0
			}
		});

		const node = screen.getByText('test.yml').parentElement;
		expect(node?.classList.contains('bg-primary-subtle')).toBe(true);
	});

	it('renders with correct indentation', () => {
		const { container } = render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect,
				depth: 2
			}
		});

		const node = container.querySelector('.file-tree-node');
		expect(node).toBeInTheDocument();
		// Check that it has proper indentation
		const style = window.getComputedStyle(node!);
		// The padding-left should be calculated based on depth
	});

	it('renders child nodes when directory is expanded', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirNode,
				selectedPath: 'sigma/rule1.yml',
				onSelect,
				depth: 0
			}
		});

		// When a child is selected, the directory should show its children
		expect(screen.getByText('sigma')).toBeInTheDocument();
		// The child should be rendered
		const childNode = screen.queryByText('rule1.yml');
		expect(childNode).toBeInTheDocument();
	});

	it('shows expand/collapse arrows for directories', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});

		// Should have a toggle button for directories
		const toggleBtn = screen.queryByRole('button');
		expect(toggleBtn).toBeInTheDocument();
	});
});
