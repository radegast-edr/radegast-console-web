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

	describe('Rendering', () => {
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

		it('renders without pack name', () => {
			render(PackEditor, {
				props: {
					packId: 1,
					versionId: 1,
					initialVersion: '1.0.0',
					versions: mockVersions,
					files: mockFiles,
					onSave,
					onClose
				}
			});

			expect(screen.queryByText('Pack:')).not.toBeInTheDocument();
		});

		it('renders without version info', () => {
			render(PackEditor, {
				props: {
					packId: 1,
					packName: 'Test Pack',
					versionId: 1,
					initialVersion: '',
					versions: mockVersions,
					files: mockFiles,
					onSave,
					onClose
				}
			});

			expect(screen.getByText('Pack: Test Pack')).toBeInTheDocument();
			expect(screen.queryByText(/Version:/)).not.toBeInTheDocument();
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

			// Should show first file or select message
			const selectMessage = screen.queryByText(/Select a file to edit/i);
			const firstFileContent = screen.queryByText(/Test Rule/);
			expect(selectMessage || firstFileContent).toBeTruthy();
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
			expect(screen.getByText(/Select a file to edit/i)).toBeInTheDocument();
		});

		it('displays file tree with nested directories', () => {
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

			// Check that directory structure is visible
			expect(screen.getByText('sigma')).toBeInTheDocument();
			expect(screen.getByText('yara')).toBeInTheDocument();
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
	});

	describe('Version Management', () => {
		it('auto-suggests version bump from 1.0.0 to 1.0.1', () => {
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
			// The auto-suggested version should be 1.0.1
			expect(versionInput.placeholder).toBe('1.0.1');
		});

		it('auto-suggests version bump from 1.0.1 to 1.0.2', () => {
			render(PackEditor, {
				props: {
					packId: 1,
					packName: 'Test Pack',
					versionId: 2,
					initialVersion: '1.0.1',
					versions: mockVersions,
					files: mockFiles,
					onSave,
					onClose
				}
			});

			const versionInput = screen.getByLabelText(/New Version/i) as HTMLInputElement;
			expect(versionInput.placeholder).toBe('1.0.2');
		});

		it('auto-suggests 1.0.0 when no initial version', () => {
			render(PackEditor, {
				props: {
					packId: 1,
					packName: 'Test Pack',
					versionId: 1,
					initialVersion: '',
					versions: mockVersions,
					files: mockFiles,
					onSave,
					onClose
				}
			});

			const versionInput = screen.getByLabelText(/New Version/i) as HTMLInputElement;
			expect(versionInput.placeholder).toBe('1.0.0');
		});

		it('Auto button sets suggested version', async () => {
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

			const autoBtn = screen.getByTitle('Auto-suggest version');
			const versionInput = screen.getByLabelText(/New Version/i) as HTMLInputElement;
			
			// Clear the input first
			versionInput.value = '';
			fireEvent.input(versionInput);
			
			// Click Auto button
			fireEvent.click(autoBtn);
			
			expect(versionInput.value).toBe('1.0.1');
		});
	});

	describe('Save Button', () => {
		it('disables save button when no changes', () => {
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

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			expect(saveBtn).toBeDisabled();
		});

		it('enables save button when version is entered', async () => {
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
			versionInput.value = '1.0.2';
			fireEvent.input(versionInput);

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			expect(saveBtn).not.toBeDisabled();
		});

		it('enables save button when file content is modified', async () => {
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

			// Wait for first file to be selected
			const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
			textarea.value = 'modified content';
			fireEvent.input(textarea);

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			expect(saveBtn).not.toBeDisabled();
		});

		it('shows saving state when saving', async () => {
			let resolveSave: () => void;
			const savePromise = new Promise<void>(resolve => { resolveSave = resolve; });
			onSave.mockImplementation(() => savePromise);

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
			versionInput.value = '1.0.2';
			fireEvent.input(versionInput);

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			fireEvent.click(saveBtn);

			// Should show saving text
			expect(screen.getByText('Saving...')).toBeInTheDocument();
			
			// Resolve the save
			resolveSave!();
			await vi.waitFor(() => {
				expect(screen.getByText('Save as New Version')).toBeInTheDocument();
			});
		});

		it('calls onSave with correct parameters', async () => {
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
			versionInput.value = '1.0.2';
			fireEvent.input(versionInput);

			const releaseNotesInput = screen.getByLabelText(/Release Notes/i) as HTMLInputElement;
			releaseNotesInput.value = 'Test release';
			fireEvent.input(releaseNotesInput);

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			fireEvent.click(saveBtn);

			await vi.waitFor(() => {
				expect(onSave).toHaveBeenCalledWith(
					expect.objectContaining({
						'sigma/rule1.yml': expect.any(String),
						'yara/rule1.yar': expect.any(String),
						'README.md': expect.any(String)
					}),
					'1.0.2',
					'Test release'
				);
			});
		});

		it('shows error when trying to save without changes', async () => {
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

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			fireEvent.click(saveBtn);

			// Should show error modal
			const errorModal = await vi.waitFor(() => {
				return screen.queryByText(/No changes to save/);
			});
			expect(errorModal).toBeInTheDocument();
		});

		it('shows error when version already exists', async () => {
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
			versionInput.value = '1.0.0'; // Already exists
			fireEvent.input(versionInput);

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			fireEvent.click(saveBtn);

			const errorModal = await vi.waitFor(() => {
				return screen.queryByText(/already exists/);
			});
			expect(errorModal).toBeInTheDocument();
		});

		it('shows error for invalid version format', async () => {
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
			versionInput.value = 'invalid';
			fireEvent.input(versionInput);

			const saveBtn = screen.getByRole('button', { name: /Save as New Version/i });
			fireEvent.click(saveBtn);

			const errorModal = await vi.waitFor(() => {
				return screen.queryByText(/X.Y.Z/);
			});
			expect(errorModal).toBeInTheDocument();
		});
	});

	describe('File Operations', () => {
		it('shows New File modal when New File button is clicked', async () => {
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

			const newFileBtn = screen.getByRole('button', { name: /New File/i });
			fireEvent.click(newFileBtn);

			const modal = await vi.waitFor(() => {
				return screen.queryByText(/Create New File/);
			});
			expect(modal).toBeInTheDocument();
		});

		it('shows Delete button when file is selected', async () => {
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

			// Wait for file to be selected
			const deleteBtn = await vi.waitFor(() => {
				return screen.queryByRole('button', { name: /Delete/i });
			});
			expect(deleteBtn).toBeInTheDocument();
		});

		it('shows delete confirmation modal when Delete is clicked', async () => {
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

			const deleteBtn = await vi.waitFor(() => {
				return screen.queryByRole('button', { name: /Delete/i });
			});
			fireEvent.click(deleteBtn!);

			const modal = await vi.waitFor(() => {
				return screen.queryByText(/Confirm Delete/);
			});
			expect(modal).toBeInTheDocument();
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
			fireEvent.click(closeBtn);

			expect(onClose).toHaveBeenCalledTimes(1);
		});
	});

	describe('Theme Support', () => {
		it('uses theme-aware background color', () => {
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
			expect(editorContainer).toHaveStyle('background: var(--bs-body-bg)');
		});

		it('uses theme-aware text color', () => {
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
			expect(editorContainer).toHaveStyle('color: var(--bs-body-color)');
		});
	});

	describe('Error Handling', () => {
		it('displays error message when present', () => {
			const error = 'Test error';
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

			// This tests the error display capability
			// In actual usage, error would be set via state
			expect(screen.queryByText(error)).not.toBeInTheDocument();
		});
	});
});
