import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileTreeNode from './FileTreeNode.svelte';

const mockNode = {
	name: 'test.txt',
	path: 'test.txt',
	type: 'file' as const,
	language: 'text'
};

const mockDirectoryNode = {
	name: 'src',
	path: 'src',
	type: 'directory' as const,
	children: [
		{ name: 'file1.txt', path: 'src/file1.txt', type: 'file' as const, language: 'text' }
	]
};

describe('FileTreeNode', () => {
	it('renders file node with name', () => {
		render(FileTreeNode, {
			props: {
				node: mockNode,
				selectedPath: '',
				onSelect: () => {}
			}
		});
		
		expect(screen.getByText('test.txt')).toBeInTheDocument();
	});

	it('renders directory node with name', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect: () => {}
			}
		});
		
		expect(screen.getByText('src')).toBeInTheDocument();
	});

	it('shows expand/collapse button for directories with children', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect: () => {}
			}
		});
		
		const button = screen.getByRole('button', { name: /▶|▼/ });
		expect(button).toBeInTheDocument();
	});

	it('does not show expand button for files', () => {
		render(FileTreeNode, {
			props: {
				node: mockNode,
				selectedPath: '',
				onSelect: () => {}
			}
		});
		
		// Files should have a spacer instead of a button
		const buttons = screen.queryAllByRole('button');
		// Only the node itself is a button (role="button" on the div)
		expect(buttons.length).toBe(0);
	});

	it('calls onSelect when file is clicked', async () => {
		let selectedNode: any = null;
		const onSelect = (node: any) => { selectedNode = node; };
		
		render(FileTreeNode, {
			props: {
				node: mockNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		fireEvent.click(nodeDiv!);
		
		expect(selectedNode).toEqual(mockNode);
	});

	it('shows selected state when node path matches selectedPath', () => {
		render(FileTreeNode, {
			props: {
				node: mockNode,
				selectedPath: 'test.txt',
				onSelect: () => {}
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		expect(nodeDiv).toHaveClass('bg-primary-subtle');
	});

	it('shows language badge for files with language', () => {
		render(FileTreeNode, {
			props: {
				node: mockNode,
				selectedPath: '',
				onSelect: () => {}
			}
		});
		
		expect(screen.getByText('(text)')).toBeInTheDocument();
	});
});
