import { describe, it, expect } from 'vitest';
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

	it('renders with empty nodes', () => {
		render(FileTree, { props: { nodes: [] } });
		const tree = screen.getByTestId('file-tree');
		expect(tree).toBeInTheDocument();
	});

	it('renders file nodes', () => {
		render(FileTree, { props: { nodes: mockNodes } });
		
		// Check that files are rendered
		expect(screen.getByText('sigma')).toBeInTheDocument();
		expect(screen.getByText('yara')).toBeInTheDocument();
		expect(screen.getByText('README.md')).toBeInTheDocument();
	});

	it('renders nested directory structure', () => {
		render(FileTree, { props: { nodes: mockNodes } });
		
		// Check that directory structure is rendered
		expect(screen.getByText('sigma')).toBeInTheDocument();
		expect(screen.getByText('rule1.yml')).toBeInTheDocument();
	});

	it('has correct file tree styling', () => {
		const { container } = render(FileTree, { props: { nodes: mockNodes } });
		const tree = container.querySelector('.file-tree');
		expect(tree).toBeInTheDocument();
	});
});
