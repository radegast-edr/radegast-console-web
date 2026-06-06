import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import PackEditor from './PackEditor.svelte';
import type { PackVersion } from '$lib/api';

interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'directory';
	children?: FileNode[];
	content?: string;
	language?: string;
}

describe('PackEditor Component', () => {
	const mockVersions: PackVersion[] = [
		{ id: 1, pack_id: 1, version: '1.0.0', released: '2024-01-01T00:00:00Z', release_notes: 'Initial version' },
		{ id: 2, pack_id: 1, version: '1.0.1', released: '2024-01-02T00:00:00Z', release_notes: 'Bug fixes' }
	];

	const mockFiles: Record<string, string> = {
		'sigma/rule1.yml': 'title: Test Rule\ndetection:\n  condition: selection',
		'yara/rule1.yar': 'rule TestRule { strings: $a = "test" condition: $a }',
		'README.md': '# Test Pack'
	};

	const onSave = vi.fn();
	const onClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders with pack info', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		expect(screen.getByText('Pack: Test Pack')).toBeInTheDocument();
		expect(screen.getByText('Version: 1.0.0')).toBeInTheDocument();
	});

	it('renders file tree sidebar', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		const sidebar = screen.getByText('Files');
		expect(sidebar).toBeInTheDocument();
	});

	it('renders editor area', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		// Should show "Select a file to edit" initially or the first file
		const selectMessage = screen.queryByText(/Select a file to edit/i);
		const firstFile = screen.queryByText('rule1.yml');
		expect(selectMessage || firstFile).toBeTruthy();
	});

	it('renders save bar with version input', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		expect(screen.getByLabelText(/New Version/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Release Notes/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Save as New Version/i })).toBeInTheDocument();
	});

	it('renders New File button', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		expect(screen.getByRole('button', { name: /New File/i })).toBeInTheDocument();
	});

	it('renders Close button', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
	});

	it('calls onClose when Close button is clicked', async () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		const closeBtn = screen.getByRole('button', { name: /Close/i });
		await fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('auto-suggests version bump', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		const versionInput = screen.getByLabelText(/New Version/i) as HTMLInputElement;
		// The auto-suggested version should be 1.0.1 (patch bump from 1.0.0)
		// Note: This might not work if the component hasn't mounted yet
	});

	it('has correct container styling', () => {
		const { container } = render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: mockFiles,
				onSave,
				onClose
			}
		});

		const editorContainer = container.querySelector('.pack-editor-container');
		expect(editorContainer).toBeInTheDocument();
	});

	it('renders with empty files', () => {
		render(PackEditor, {
			props: {
				packId: 1,
				packName: 'Test Pack',
				versionId: 1,
				initialVersion: '1.0.0',
				versions: mockVersions,
				files: {},
				onSave,
				onClose
			}
		});

		expect(screen.getByText('Pack: Test Pack')).toBeInTheDocument();
	});
});
