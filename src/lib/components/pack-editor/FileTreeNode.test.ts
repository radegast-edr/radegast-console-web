import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileTreeNode from './FileTreeNode.svelte';

interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'directory';
	children?: FileNode[];
	language?: string;
}

const mockFileNode: FileNode = {
	name: 'test.txt',
	path: 'test.txt',
	type: 'file',
	language: 'text'
};

const mockDirectoryNode: FileNode = {
	name: 'src',
	path: 'src',
	type: 'directory',
	children: [
		{ name: 'file1.txt', path: 'src/file1.txt', type: 'file', language: 'text' }
	]
};

const mockEmptyDirectoryNode: FileNode = {
	name: 'empty',
	path: 'empty',
	type: 'directory',
	children: []
};

describe('FileTreeNode Component', () => {
	const onSelect = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders file node with name', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('test.txt')).toBeInTheDocument();
	});

	it('renders directory node with name', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('src')).toBeInTheDocument();
	});

	it('shows expand/collapse button for directories with children', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const button = screen.getByRole('button', { name: /▶|▼/ });
		expect(button).toBeInTheDocument();
	});

	it('shows expand arrow (▶) when directory is collapsed', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const button = screen.getByText('▶');
		expect(button).toBeInTheDocument();
	});

	it('does not show expand button for empty directories', () => {
		render(FileTreeNode, {
			props: {
				node: mockEmptyDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		// Empty directories have no children, so no toggle button
		const buttons = screen.queryAllByRole('button');
		// The node div itself has role="button"
		expect(buttons.length).toBe(0);
	});

	it('does not show expand button for files', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		// Files should have a spacer instead of a button
		const buttons = screen.queryAllByRole('button');
		expect(buttons.length).toBe(0);
	});

	it('calls onSelect when file is clicked', async () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		fireEvent.click(nodeDiv!);
		
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith(mockFileNode);
	});

	it('shows selected state when node path matches selectedPath', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: 'test.txt',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		expect(nodeDiv).toHaveClass('bg-primary-subtle');
	});

	it('shows normal state when not selected', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: 'other.txt',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		expect(nodeDiv).not.toHaveClass('bg-primary-subtle');
	});

	it('shows language badge for files with language', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('(text)')).toBeInTheDocument();
	});

	it('does not show language badge for directories', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const languageBadge = screen.queryByText(/\w+\)$/);
		expect(languageBadge).not.toBeInTheDocument();
	});

	it('shows file icon for files', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		// Should show paperclip icon for generic files
		expect(screen.getByText('📎')).toBeInTheDocument();
	});

	it('shows folder icon for directories', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		// Should show folder icon (closed by default)
		expect(screen.getByText('📁')).toBeInTheDocument();
	});

	it('shows YAML icon for .yml files', () => {
		const yamlNode: FileNode = {
			name: 'rule.yml',
			path: 'rule.yml',
			type: 'file',
			language: 'yaml'
		};
		
		render(FileTreeNode, {
			props: {
				node: yamlNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('📄')).toBeInTheDocument();
	});

	it('shows YARA icon for .yar files', () => {
		const yaraNode: FileNode = {
			name: 'rule.yar',
			path: 'rule.yar',
			type: 'file',
			language: 'yara'
		};
		
		render(FileTreeNode, {
			props: {
				node: yaraNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('🔍')).toBeInTheDocument();
	});

	it('shows TXT icon for .txt files', () => {
		const txtNode: FileNode = {
			name: 'notes.txt',
			path: 'notes.txt',
			type: 'file',
			language: 'text'
		};
		
		render(FileTreeNode, {
			props: {
				node: txtNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('📝')).toBeInTheDocument();
	});

	it('shows JSON icon for .json files', () => {
		const jsonNode: FileNode = {
			name: 'config.json',
			path: 'config.json',
			type: 'file',
			language: 'json'
		};
		
		render(FileTreeNode, {
			props: {
				node: jsonNode,
				selectedPath: '',
				onSelect
			}
		});
		
		expect(screen.getByText('📊')).toBeInTheDocument();
	});

	it('renders children when directory is expanded', async () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});
		
		// Initially children should not be visible
		expect(screen.queryByText('file1.txt')).not.toBeInTheDocument();
		
		// Click the toggle button to expand
		const toggleBtn = screen.getByText('▶');
		fireEvent.click(toggleBtn);
		
		// Now children should be visible
		expect(screen.getByText('file1.txt')).toBeInTheDocument();
	});

	it('hides children when directory is collapsed', async () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});
		
		// Click to expand
		const toggleBtn = screen.getByText('▶');
		fireEvent.click(toggleBtn);
		
		expect(screen.getByText('file1.txt')).toBeInTheDocument();
		
		// Click again to collapse
		fireEvent.click(toggleBtn);
		
		// Children should be hidden again
		expect(screen.queryByText('file1.txt')).not.toBeInTheDocument();
	});

	it('auto-expands when node is selected', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: 'src/file1.txt',
				onSelect,
				depth: 0
			}
		});
		
		// Should auto-expand because descendant is selected
		expect(screen.getByText('file1.txt')).toBeInTheDocument();
	});

	it('auto-expands when node itself is selected', () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: 'src',
				onSelect,
				depth: 0
			}
		});
		
		// Should auto-expand because node is selected
		expect(screen.getByText('file1.txt')).toBeInTheDocument();
	});

	it('has proper indentation based on depth', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect,
				depth: 2
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		// padding-left should be depth * 15 + 10 = 40px
		expect(nodeDiv).toHaveStyle('padding-left: 40px');
	});

	it('has pointer cursor', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		expect(nodeDiv).toHaveStyle('cursor: pointer');
	});

	it('has proper role and tabindex for accessibility', () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		expect(nodeDiv).toHaveAttribute('role', 'button');
		expect(nodeDiv).toHaveAttribute('tabindex', '0');
	});

	it('can be selected via keyboard Enter key', async () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		fireEvent.keyDown(nodeDiv!, { key: 'Enter' });
		
		expect(onSelect).toHaveBeenCalledWith(mockFileNode);
	});

	it('can be selected via keyboard Space key', async () => {
		render(FileTreeNode, {
			props: {
				node: mockFileNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('test.txt').parentElement;
		fireEvent.keyDown(nodeDiv!, { key: ' ' });
		
		expect(onSelect).toHaveBeenCalledWith(mockFileNode);
	});

	it('does not call onSelect for directories when clicked', async () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect
			}
		});
		
		const nodeDiv = screen.getByText('src').parentElement;
		fireEvent.click(nodeDiv!);
		
		// Should NOT call onSelect for directories
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('toggles directory expansion when clicked', async () => {
		render(FileTreeNode, {
			props: {
				node: mockDirectoryNode,
				selectedPath: '',
				onSelect,
				depth: 0
			}
		});
		
		const nodeDiv = screen.getByText('src').parentElement;
		
		// Initially collapsed
		expect(screen.queryByText('file1.txt')).not.toBeInTheDocument();
		
		// Click to expand
		fireEvent.click(nodeDiv!);
		
		// Now expanded
		expect(screen.getByText('file1.txt')).toBeInTheDocument();
		
		// Click again to collapse
		fireEvent.click(nodeDiv!);
		
		// Collapsed again
		expect(screen.queryByText('file1.txt')).not.toBeInTheDocument();
	});
});
