<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, type Pack, type PackVersion } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import { PackEditor } from '$lib/components/pack-editor';
	import JSZip from 'jszip';

	let pack = $state<Pack | null>(null);
	let versions = $state<PackVersion[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let editorKey = $state(0); // Used to force remount editor

	let showEditor = $state(false);
	let extractedFiles = $state<Record<string, string>>({});

	const packId = $derived(Number(page.params.id));
	const versionId = $derived(Number(page.params.version_id));

	// Check permissions
	let canManage = $derived.by(() => {
		if (!pack || !$user) return false;
		if ($user.role === 'maintainer' || $user.role === 'admin') return true;
		if (pack.creator_id === $user.id) return true;
		return false;
	});

	// Load data when packId or versionId changes
	$effect(() => {
		packId;
		versionId;
		loadData();
	});

	async function loadData(): Promise<void> {
		loading = true;
		error = null;
		
		try {
			const [packRes, versionsRes] = await Promise.all([
				api.getPack(packId),
				api.listVersions(packId)
			]);
			
			pack = packRes;
			versions = versionsRes;
			
			// Find the specific version
			const version = versions.find(v => v.id === versionId);
			if (version) {
				// Download and extract the pack version
				await downloadAndExtractVersion(version);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			showError(error);
		} finally {
			loading = false;
		}
	}

	async function downloadAndExtractVersion(version: PackVersion): Promise<void> {
		try {
			const response = await api.downloadVersion(version.id);
			const blob = await response.blob();
			
			// Extract the zip file
			extractedFiles = await extractZip(blob);
			
			// Show editor
			showEditor = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			showError(error);
		}
	}

	// Extract files from zip using JSZip
	async function extractZip(zipBlob: Blob): Promise<Record<string, string>> {
		const files: Record<string, string> = {};
		
		try {
			const zip = await JSZip.loadAsync(zipBlob);
			
			for (const [filename, file] of Object.entries(zip.files)) {
				if (!file.dir) {
					try {
						const content = await file.asyncText();
						files[filename] = content;
					} catch (e) {
						console.error(`Error reading file ${filename}:`, e);
					}
				}
			}
		} catch (e) {
			console.error('Error extracting zip:', e);
			throw new Error('Failed to extract pack zip file');
		}

		return files;
	}

	async function handleSave(files: Record<string, string>, version: string, releaseNotes: string): Promise<void> {
		if (!pack) return;

		try {
			// Create a zip file from the modified files
			const zipBlob = await createZip(files);
			
			// Create a file object for upload
			const file = new File([zipBlob], `${pack.name}-${version}.zip`, { type: 'application/zip' });
			
			// Upload the new version
			await api.uploadVersion(pack.id, version, file, releaseNotes);
			
			showFlash(`New version ${version} saved successfully!`);
			
			// Reload data and reset editor
			showEditor = false;
			editorKey++;
			
			// Navigate back to pack detail page
			goto(`${base}/packs/${pack.id}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			showError(msg);
			throw e;
		}
	}

	// Create zip file from files using JSZip
	async function createZip(files: Record<string, string>): Promise<Blob> {
		try {
			const zip = JSZip();
			
			for (const [filename, content] of Object.entries(files)) {
				zip.file(filename, content);
			}
			
			return await zip.generateAsync({ type: 'blob' });
		} catch (e) {
			console.error('Error creating zip:', e);
			throw new Error('Failed to create zip file');
		}
	}

	function handleClose(): void {
		goto(`${base}/packs/${packId}`);
	}
</script>

<svelte:head>
	<title>Edit Pack {pack?.name || ''} - Radegast</title>
</svelte:head>

<div class="container-fluid p-3">
	<div class="mb-4">
		<a href="{base}/packs/{packId}" class="btn btn-outline-secondary btn-sm mb-2">← Back to Pack</a>
	</div>

	{#if loading}
		<div class="text-center py-5">
			<div class="spinner-border text-primary" role="status">
				<span class="visually-hidden">Loading...</span>
			</div>
			<p class="mt-2 text-muted">Loading pack version...</p>
		</div>
	{:else if error}
		<div class="alert alert-danger">{error}</div>
	{:else if !pack}
		<div class="alert alert-warning">Pack not found</div>
	{:else if !canManage}
		<div class="alert alert-warning">You do not have permission to edit this pack.</div>
	{:else}
		<div class="card shadow-sm">
			<div class="card-header bg-body-tertiary">
				<h4 class="mb-0">
					Editing: {pack.name}
					{#if versions.find(v => v.id === versionId)}
						- Version: {versions.find(v => v.id === versionId)?.version}
					{/if}
				</h4>
			</div>
			<div class="card-body p-0">
				{#if showEditor}
					{#key editorKey}
						<PackEditor
							packId={packId}
							packName={pack.name}
							versionId={versionId}
							initialVersion={versions.find(v => v.id === versionId)?.version || ''}
							versions={versions}
							files={extractedFiles}
							onSave={handleSave}
							onClose={handleClose}
						/>
					{/key}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.container-fluid {
		max-width: 1400px;
		margin: 0 auto;
	}
</style>
