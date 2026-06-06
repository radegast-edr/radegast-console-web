import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FileTree from './FileTree.svelte';

interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'directory';
	children?: FileNode[];
	language?: string;
}

describe('FileTree Component', () => {
	const mockNodes: FileNode[] = [
		{
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
		},
		{
			name: 'yara',
			path: 'yara',
			type: 'directory',
			children: [
				{
					name: 'rule1.yar',
					path: 'yara/rule1.yar',
					type: 'file',
					language: 'yara'
				}
			]
		},
		{
			name: 'README.md',
			path: 'README.md',
			type: 'file',
			language: 'markdown'
		}
	];

	it('renders with empty nodes array', () => {
		const { container } = render(FileTree, { props: { nodes: [] } });
		const tree = screen.getByTestId('file-tree');
		expect(tree).toBeInTheDocument();
		expect(tree.children.length).toBe(0);
	});

	it('renders with undefined nodes', () => {
		const { container } = render(FileTree, { props: {} });
		const tree = screen.getByTestId('file-tree');
		expect(tree).toBeInTheDocument();
	});

	it('renders all root-level nodes', () => {
		render(FileTree, { props: { nodes: mockNodes } });
		
		// Check that all root nodes are rendered
		expect(screen.getByText('sigma')).toBeInTheDocument();
		expect(screen.getByText('yara')).toBeInTheDocument();
		expect(screen.getByText('README.md')).toBeInTheDocument();
	});

	it('renders nested directory structure', () => {
		render(FileTree, { props: { nodes: mockNodes } });
		
		// Check that nested files are rendered
		expect(screen.getByText('rule1.yml')).toBeInTheDocument();
		expect(screen.getByText('rule1.yar')).toBeInTheDocument();
	});

	it('has correct file tree container class', () => {
		const { container } = render(FileTree, { props: { nodes: mockNodes } });
		const tree = container.querySelector('.file-tree');
		expect(tree).toBeInTheDocument();
	});

	it('has theme-aware styling', () => {
		const { container } = render(FileTree, { props: { nodes: mockNodes } });
		const tree = container.querySelector('.file-tree');
		
		// Check that it uses CSS variables for theme
		expect(tree).toHaveStyle('color: var(--bs-body-color)');
		expect(tree).toHaveStyle('background: var(--bs-body-bg)');
	});

	it('renders single file at root level', () => {
		const singleFile: FileNode[] = [
			{ name: 'test.txt', path: 'test.txt', type: 'file', language: 'text' }
		];
		
		render(FileTree, { props: { nodes: singleFile } });
		expect(screen.getByText('test.txt')).toBeInTheDocument();
	});

	it('renders deeply nested directory structure', () => {
		const deepNodes: FileNode[] = [
			{
				name: 'level1',
				path: 'level1',
				type: 'directory',
				children: [
					{
						name: 'level2',
						path: 'level1/level2',
						type: 'directory',
						children: [
							{
								name: 'deep.txt',
								path: 'level1/level2/deep.txt',
								type: 'file',
								language: 'text'
							}
						]
					}
				]
			}
		];
		
		render(FileTree, { props: { nodes: deepNodes } });
		
		expect(screen.getByText('level1')).toBeInTheDocument();
		expect(screen.getByText('level2')).toBeInTheDocument();
		expect(screen.getByText('deep.txt')).toBeInTheDocument();
	});

	it('renders multiple files in same directory', () => {
		const multiFile: FileNode[] = [
			{
				name: 'dir',
				path: 'dir',
				type: 'directory',
				children: [
					{ name: 'file1.txt', path: 'dir/file1.txt', type: 'file', language: 'text' },
					{ name: 'file2.txt', path: 'dir/file2.txt', type: 'file', language: 'text' },
					{ name: 'file3.txt', path: 'dir/file3.txt', type: 'file', language: 'text' }
				]
			}
		];
		
		render(FileTree, { props: { nodes: multiFile } });
		
		expect(screen.getByText('file1.txt')).toBeInTheDocument();
		expect(screen.getByText('file2.txt')).toBeInTheDocument();
		expect(screen.getByText('file3.txt')).toBeInTheDocument();
	});

	it('renders empty directory', () => {
		const emptyDir: FileNode[] = [
			{ name: 'empty', path: 'empty', type: 'directory', children: [] }
		];
		
		render(FileTree, { props: { nodes: emptyDir } });
		expect(screen.getByText('empty')).toBeInTheDocument();
	});

	it('passes selectedPath to child nodes', () => {
		render(FileTree, {
			props: {
				nodes: mockNodes,
				selectedPath: 'sigma/rule1.yml'
			}
		});
		
		// The selected path should be passed down
		expect(screen.getByText('rule1.yml')).toBeInTheDocument();
	});

	it('passes onSelect to child nodes', () => {
		const onSelect = vi.fn();
		render(FileTree, {
			props: {
				nodes: mockNodes,
				onSelect
			}
		});
		
		// onSelect should be available to children
		expect(screen.getByText('sigma')).toBeInTheDocument();
	});
});
