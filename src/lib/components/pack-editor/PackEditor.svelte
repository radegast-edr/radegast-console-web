<script lang="ts">
	import type { PackVersion } from '$lib/api';
	import FileTree from './FileTree.svelte';
	import CodeEditor from './CodeEditor.svelte';
	import Modal from '$lib/components/Modal.svelte';

	interface FileNode {
		name: string;
		path: string;
		type: 'file' | 'directory';
		children?: FileNode[];
		content?: string;
		language?: string;
	}

	interface EditorState {
		loading: boolean;
		error: string | null;
		files: FileNode[];
		currentFile: FileNode | null;
		currentContent: string;
		unsavedChanges: Map<string, string>;
		newVersion: string;
		releaseNotes: string;
		isSaving: boolean;
	}

	let {
		packId = $bindable(0),
		packName = $bindable(''),
		versionId = $bindable(0),
		initialVersion = $bindable(''),
		versions = $bindable<PackVersion[]>([]),
		files: filesProp = $bindable({}),
		onSave = $bindable(() => {}),
		onClose = $bindable(() => {})
	} = $props<{
		packId?: number;
		packName?: string;
		versionId?: number;
		initialVersion?: string;
		versions?: PackVersion[];
		files?: Record<string, string>;
		onSave?: (files: Record<string, string>, version: string, releaseNotes: string) => Promise<void>;
		onClose?: () => void;
	}>();

	interface ModalState {
		showNewFileModal: boolean;
		newFileName: string;
		showDeleteConfirmModal: boolean;
		fileToDelete: FileNode | null;
		showErrorModal: boolean;
		errorModalMessage: string;
	}

	interface FullState extends EditorState {
		modal: ModalState;
	}

	let state = $state<FullState>({
		loading: false,
		error: null,
		files: [],
		currentFile: null,
		currentContent: '',
		unsavedChanges: new Map(),
		newVersion: '',
		releaseNotes: '',
		isSaving: false,
		modal: {
			showNewFileModal: false,
			newFileName: '',
			showDeleteConfirmModal: false,
			fileToDelete: null,
			showErrorModal: false,
			errorModalMessage: ''
		}
	});

	// File type to language mapping for syntax highlighting
	const languageMap: Record<string, string> = {
		'.yaml': 'yaml',
		'.yml': 'yaml',
		'.yara': 'yara',
		'.yar': 'yara',
		'.txt': 'text',
		'.json': 'json',
		'.js': 'javascript',
		'.ts': 'typescript',
		'.py': 'python',
		'.sh': 'bash',
		'.md': 'markdown'
	};

	function getLanguage(filename: string): string {
		const ext = filename.slice(filename.lastIndexOf('.'));
		return languageMap[ext.toLowerCase()] || 'text';
	}

	function getFileIcon(filename: string, type: 'file' | 'directory'): string {
		if (type === 'directory') return '📁';
		const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
		if (['.yaml', '.yml'].includes(ext)) return '📄';
		if (['.yara', '.yar'].includes(ext)) return '🔍';
		if (['.txt'].includes(ext)) return '📝';
		if (['.json'].includes(ext)) return '📊';
		return '📎';
	}

	// Build file tree from extracted files
	function buildFileTree(files: Record<string, string>): FileNode[] {
		const root: FileNode[] = [];
		const pathMap: Record<string, FileNode> = {};

		// Sort paths to ensure directories come before files
		const sortedPaths = Object.keys(files).sort();

		for (const path of sortedPaths) {
			const parts = path.split('/').filter(p => p);
			const filename = parts.pop() || path;
			const isDir = path.endsWith('/');

			if (isDir) continue;

			// Build the tree structure
			let currentLevel = root;
			let currentPath = '';

			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				currentPath += (currentPath ? '/' : '') + part;

				let node = pathMap[currentPath];
				if (!node) {
					node = {
						name: part,
						path: currentPath,
						type: 'directory',
						children: []
					};
					pathMap[currentPath] = node;
					currentLevel.push(node);
				}
				currentLevel = node.children!;
			}

			// Add the file
			const filePath = currentPath + (currentPath ? '/' : '') + filename;
			const fileNode: FileNode = {
				name: filename,
				path: filePath,
				type: 'file',
				content: files[path],
				language: getLanguage(filename)
			};
			currentLevel.push(fileNode);
		}

		return root;
	}

	// Set files from extracted content
	export function setFiles(files: Record<string, string>): void {
		state.files = buildFileTree(files);
		if (state.files.length > 0) {
			// Select first file
			const firstFile = findFirstFile(state.files);
			if (firstFile) {
				selectFile(firstFile);
			}
		}
		state.unsavedChanges = new Map();
	}

	function findFirstFile(nodes: FileNode[]): FileNode | null {
		const stack = [...nodes];
		while (stack.length > 0) {
			const node = stack.pop()!;
			if (node.type === 'file') return node;
			if (node.children) {
				stack.push(...node.children);
			}
		}
		return null;
	}

	function selectFile(node: FileNode): void {
		if (node.type === 'directory') return;
		
		state.currentFile = node;
		// Check if there are unsaved changes for this file
		const unsaved = state.unsavedChanges.get(node.path);
		state.currentContent = unsaved !== undefined ? unsaved : (node.content || '');
	}

	function updateContent(newContent: string): void {
		if (!state.currentFile) return;
		state.currentContent = newContent;
		state.unsavedChanges.set(state.currentFile.path, newContent);
	}

	function hasUnsavedChanges(): boolean {
		return state.unsavedChanges.size > 0 || state.newVersion !== '';
	}

	// Create a new file
	function createNewFile(): void {
		state.modal.showNewFileModal = true;
		state.modal.newFileName = '';
	}

	function confirmCreateNewFile(): void {
		if (!state.modal.newFileName.trim()) {
			state.modal.showErrorModal = true;
			state.modal.errorModalMessage = 'Please enter a filename.';
			return;
		}

		const currentPath = state.currentFile?.path || '';
		const dirPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
		const fullPath = dirPath ? `${dirPath}/${state.modal.newFileName.trim()}` : state.modal.newFileName.trim();

		// Check if file already exists
		if (findFileByPath(state.files, fullPath)) {
			state.modal.showErrorModal = true;
			state.modal.errorModalMessage = 'File already exists!';
			return;
		}

		// Add the new file
		const newFile: FileNode = {
			name: state.modal.newFileName.trim(),
			path: fullPath,
			type: 'file',
			content: '',
			language: getLanguage(state.modal.newFileName.trim())
		};

		state.files = addFileToTree(state.files, newFile);
		selectFile(newFile);
		state.currentContent = '';
		state.unsavedChanges.set(fullPath, '');
		
		state.modal.showNewFileModal = false;
		state.modal.newFileName = '';
	}

	function cancelCreateNewFile(): void {
		state.modal.showNewFileModal = false;
		state.modal.newFileName = '';
	}

	function findFileByPath(nodes: FileNode[], path: string): FileNode | null {
		const stack = [...nodes];
		while (stack.length > 0) {
			const node = stack.pop()!;
			if (node.path === path) return node;
			if (node.children) {
				stack.push(...node.children);
			}
		}
		return null;
	}

	function deepCloneNode(node: FileNode): FileNode {
		return {
			...node,
			children: node.children ? node.children.map(deepCloneNode) : undefined
		};
	}

	function addFileToTree(nodes: FileNode[], file: FileNode): FileNode[] {
		// Create a deep copy of the tree to avoid mutation
		const clonedNodes = nodes.map(deepCloneNode);
		const pathParts = file.path.split('/').filter(p => p);
		const filename = pathParts.pop();
		
		if (pathParts.length === 0) {
			// Root level file
			return [...clonedNodes, { ...file }];
		}

		// Find the directory to add to
		let currentLevel = clonedNodes;
		let currentPath = '';
		for (const part of pathParts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const dir = currentLevel.find(n => n.path === currentPath && n.type === 'directory');
			if (dir && dir.children) {
				currentLevel = dir.children;
			} else {
				// Directory doesn't exist, create it
				const newDir: FileNode = {
					name: part,
					path: currentPath,
					type: 'directory',
					children: []
				};
				currentLevel.push(newDir);
				currentLevel = newDir.children!;
			}
		}

		currentLevel.push({ ...file });
		return clonedNodes;
	}

	// Delete a file
	function deleteFile(): void {
		if (!state.currentFile || state.currentFile.type === 'directory') return;
		
		state.modal.fileToDelete = state.currentFile;
		state.modal.showDeleteConfirmModal = true;
	}

	function confirmDeleteFile(): void {
		if (!state.modal.fileToDelete) return;
		
		state.files = removeFileFromTree(state.files, state.modal.fileToDelete.path);
		state.unsavedChanges.delete(state.modal.fileToDelete.path);
		
		// Select next file or parent
		const nextFile = findFirstFile(state.files);
		if (nextFile) {
			selectFile(nextFile);
		} else {
			state.currentFile = null;
			state.currentContent = '';
		}
		
		state.modal.fileToDelete = null;
		state.modal.showDeleteConfirmModal = false;
	}

	function cancelDeleteFile(): void {
		state.modal.fileToDelete = null;
		state.modal.showDeleteConfirmModal = false;
	}

	function removeFileFromTree(nodes: FileNode[], path: string): FileNode[] {
		return nodes.map(node => {
			if (node.path === path) return null as any;
			if (node.children) {
				const filteredChildren = removeFileFromTree(node.children, path).filter(Boolean);
				return {
					...node,
					children: filteredChildren.length > 0 ? filteredChildren : undefined
				};
			}
			return { ...node };
		}).filter(Boolean) as FileNode[];
	}

	// Suggest version bump
	function suggestVersionBump(): string {
		if (!initialVersion) return '1.0.0';
		
		const parts = initialVersion.split('.').map((p: string) => parseInt(p, 10) || 0);
		if (parts.length !== 3) return `${parts[0]}.${parts[1] || 0}.${parts[2] || 0}`;
		
		// Simple bump: patch version
		parts[2] += 1;
		return parts.join('.');
	}

	// Create new version from changes
	async function saveAsNewVersion(): Promise<void> {
		if (!hasUnsavedChanges()) {
			state.modal.showErrorModal = true;
			state.modal.errorModalMessage = 'No changes to save!';
			return;
		}

		const version = state.newVersion || suggestVersionBump();
		if (!version) {
			state.modal.showErrorModal = true;
			state.modal.errorModalMessage = 'Please enter a version number';
			return;
		}

		// Validate version format
		if (!/^\d+\.\d+\.\d+$/.test(version)) {
			state.modal.showErrorModal = true;
			state.modal.errorModalMessage = 'Version must be in format X.Y.Z (e.g., 1.0.0)';
			return;
		}

		// Check if version already exists
		if (versions.some((v: { version: string }) => v.version === version)) {
			state.modal.showErrorModal = true;
			state.modal.errorModalMessage = `Version ${version} already exists for this pack!`;
			return;
		}

		state.isSaving = true;
		
		try {
			// Collect all files (original + modified + new)
			const allFiles = collectAllFiles(state.files, state.unsavedChanges);
			
			// Call parent's save handler
			await onSave(allFiles, version, state.releaseNotes);
			
			// Reset after save
			state.unsavedChanges = new Map();
			state.newVersion = '';
			state.releaseNotes = '';
		} catch (e) {
			state.error = e instanceof Error ? e.message : String(e);
		} finally {
			state.isSaving = false;
		}
	}

	function collectAllFiles(nodes: FileNode[], unsaved: Map<string, string>): Record<string, string> {
		const files: Record<string, string> = {};
		
		function traverse(node: FileNode) {
			if (node.type === 'file') {
				const content = unsaved.get(node.path) !== undefined 
					? unsaved.get(node.path)! 
					: (node.content || '');
				files[node.path] = content;
			}
			if (node.children) {
				for (const child of node.children) {
					traverse(child);
				}
			}
		}

		for (const node of nodes) {
			traverse(node);
		}

		return files;
	}

	// Auto-suggest version and load files
	$effect(() => {
		if (initialVersion) {
			state.newVersion = suggestVersionBump();
		}
		// Always update files when filesProp changes
		if (Object.keys(filesProp).length > 0) {
			setFiles(filesProp);
		}
	});
</script>

<div class="pack-editor-container d-flex flex-column h-100">
	{#if state.error}
		<div class="alert alert-danger m-3">{state.error}</div>
	{/if}
			<div class="d-flex flex-column h-100">
				<!-- Header -->
				<div class="d-flex justify-content-between align-items-center p-3 border-bottom">
					<div class="d-flex align-items-center gap-3">
						<h5 class="mb-0">
							{#if packName}Pack: {packName}{/if}
							{#if initialVersion} - Version: {initialVersion}{/if}
						</h5>
						{#if hasUnsavedChanges()}
							<span class="badge bg-warning text-dark">Unsaved Changes</span>
						{/if}
					</div>
					<div class="d-flex gap-2">
						<button class="btn btn-sm btn-outline-secondary" onclick={createNewFile} title="Create new file">
							New File
						</button>
						{#if state.currentFile && state.currentFile.type === 'file'}
							<button class="btn btn-sm btn-outline-danger" onclick={deleteFile} title="Delete current file">
								Delete
							</button>
						{/if}
						<button class="btn btn-sm btn-outline-primary" onclick={onClose}>
							Close
						</button>
					</div>
				</div>

				<!-- Main Content Area -->
				<div class="d-flex flex-grow-1 overflow-hidden">
					<!-- File Tree Sidebar -->
					<div class="file-tree-sidebar border-end bg-body-tertiary overflow-auto" style="width: 250px; min-width: 200px;">
						<div class="p-2">
							<strong class="small text-body-secondary">Files</strong>
						</div>
						<FileTree nodes={state.files} selectedPath={state.currentFile?.path || ''} onSelect={selectFile} />
					</div>

					<!-- Editor Area -->
					<div class="editor-area flex-grow-1 d-flex flex-column overflow-hidden">
						{#if state.currentFile}
							<div class="editor-header border-bottom d-flex justify-content-between align-items-center p-2">
								<div class="d-flex align-items-center gap-2">
									<span class="file-icon">{getFileIcon(state.currentFile.name, state.currentFile.type)}</span>
									<span class="fw-semibold small">{state.currentFile.name}</span>
									<span class="badge bg-body-secondary text-body small">{state.currentFile.language}</span>
								</div>
							</div>
							<div class="editor-content flex-grow-1 overflow-auto">
								<CodeEditor 
									bind:value={state.currentContent}
									language={state.currentFile.language}
									onChange={updateContent}
								/>
							</div>
						{:else}
							<div class="d-flex align-items-center justify-content-center flex-grow-1 text-body-secondary">
								Select a file to edit
							</div>
						{/if}
					</div>
				</div>

				<!-- Save Bar -->
				<div class="save-bar border-top p-3 bg-body-tertiary">
					<div class="row g-3 align-items-end">
						<div class="col-md-4">
							<label for="newVersion" class="form-label small fw-semibold">New Version</label>
							<div class="input-group">
								<input
									type="text"
									class="form-control form-control-sm"
									id="newVersion"
									bind:value={state.newVersion}
									placeholder={suggestVersionBump()}
								/>
								<button class="btn btn-outline-secondary btn-sm" onclick={() => state.newVersion = suggestVersionBump()} title="Auto-suggest version">
									Auto
								</button>
								</div>
							</div>
						<div class="col-md-5">
							<label for="releaseNotes" class="form-label small fw-semibold">Release Notes</label>
							<input
								type="text"
								class="form-control form-control-sm"
								id="releaseNotes"
								bind:value={state.releaseNotes}
								placeholder="Describe changes..."
							/>
						</div>
						<div class="col-md-3">
							<button 
								class="btn btn-primary btn-sm w-100"
								disabled={!hasUnsavedChanges() || state.isSaving}
								onclick={saveAsNewVersion}
							>
								{state.isSaving ? 'Saving...' : 'Save as New Version'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- New File Modal -->
		<Modal show={state.modal.showNewFileModal} title="Create New File" onClose={cancelCreateNewFile}>
			<div class="mb-3">
				<label for="newFileName" class="form-label">Filename:</label>
				<input 
					id="newFileName" 
					class="form-control" 
					bind:value={state.modal.newFileName}
					placeholder="Enter filename (e.g., rule.yml)"
				/>
			</div>
			<div class="text-end">
				<button class="btn btn-secondary me-2" onclick={cancelCreateNewFile}>Cancel</button>
				<button class="btn btn-primary" onclick={confirmCreateNewFile}>Create</button>
			</div>
		</Modal>

		<!-- Delete Confirmation Modal -->
		<Modal show={state.modal.showDeleteConfirmModal} title="Confirm Delete" onClose={cancelDeleteFile}>
			<p>Are you sure you want to delete {state.modal.fileToDelete?.name}?</p>
			<div class="text-end">
				<button class="btn btn-secondary me-2" onclick={cancelDeleteFile}>Cancel</button>
				<button class="btn btn-danger" onclick={confirmDeleteFile}>Delete</button>
			</div>
		</Modal>

		<!-- Error Modal -->
		<Modal show={state.modal.showErrorModal} title="Error" onClose={() => state.modal.showErrorModal = false}>
			<p>{state.modal.errorModalMessage}</p>
			<div class="text-end">
				<button class="btn btn-primary" onclick={() => state.modal.showErrorModal = false}>OK</button>
			</div>
		</Modal>

<style>
	.pack-editor-container {
		background: var(--bs-body-bg);
		color: var(--bs-body-color);
		min-height: 600px;
	}
	
	.file-tree-sidebar {
		background: var(--bs-body-bg);
		max-height: calc(100vh - 200px);
		color: var(--bs-body-color);
	}
	
	.editor-area {
		background: var(--bs-body-bg);
		color: var(--bs-body-color);
	}
	
	.editor-header {
		background: var(--bs-body-tertiary-bg);
		border-bottom: 1px solid var(--bs-border-color);
		color: var(--bs-body-color);
	}
	
	.save-bar {
		background: var(--bs-body-tertiary-bg);
		color: var(--bs-body-color);
	}
	
	.file-icon {
		font-size: 0.9em;
	}
	
	.editor-content {
		min-height: 0;
	}
</style>
