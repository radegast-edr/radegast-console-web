<script>
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user, showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let releases = $state([]);
	let loading = $state(true);

	// Upload state
	let showUpload = $state(false);
	let uploadVersion = $state('');
	let uploadOS = $state('linux');
	let uploadArch = $state('amd64');
	let uploadFile = $state(null);
	let uploading = $state(false);

	// Grouped view: { version -> { os -> [arch, ...] } }
	let grouped = $derived(groupReleases(releases));

	function groupReleases(list) {
		const map = new Map();
		for (const r of list) {
			if (!map.has(r.version)) map.set(r.version, new Map());
			const osMap = map.get(r.version);
			if (!osMap.has(r.os)) osMap.set(r.os, []);
			osMap.get(r.os).push(r);
		}
		// Sort versions descending
		return [...map.entries()].sort((a, b) => {
			const av = a[0].split('.').map(Number);
			const bv = b[0].split('.').map(Number);
			for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return bv[i] - av[i];
			return 0;
		});
	}

	function formatBytes(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	onMount(loadReleases);

	async function loadReleases() {
		loading = true;
		try {
			releases = await api.listReleases();
		} catch (e) {
			showError(e.message);
		} finally {
			loading = false;
		}
	}

	async function uploadRelease() {
		if (!uploadFile) { showError('Please select a file'); return; }
		uploading = true;
		try {
			await api.uploadRelease(uploadVersion, uploadOS, uploadArch, uploadFile);
			showUpload = false;
			uploadVersion = ''; uploadFile = null;
			await loadReleases();
			showFlash(`Release ${uploadVersion || ''} uploaded successfully`);
		} catch (e) {
			showError(e.message);
		} finally {
			uploading = false;
		}
	}

	async function deleteRelease(version, os, arch) {
		if (!confirm(`Delete release ${version}/${os}/${arch}? This cannot be undone.`)) return;
		try {
			await api.deleteRelease(version, os, arch);
			await loadReleases();
			showFlash(`Deleted ${version}/${os}/${arch}`);
		} catch (e) {
			showError(e.message);
		}
	}

	let isAdmin = $derived($user && $user.role === 'admin');
</script>

<svelte:head>
	<title>Releases — Radegast EDR</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4">
	<div>
		<h2 class="mb-0">Rustinel Releases</h2>
		<p class="text-muted small mb-0">Manage Rustinel eBPF sensor release binaries distributed to enrolled devices.</p>
	</div>
	{#if isAdmin}
		<button class="btn btn-primary" onclick={() => (showUpload = true)}>
			Upload Release
		</button>
	{/if}
</div>

{#if loading}
	<div class="text-center py-5">
		<div class="spinner-border text-primary" role="status"></div>
	</div>
{:else if grouped.length === 0}
	<div class="text-center py-5 text-muted">
		<div style="font-size: 3rem;">📦</div>
		<p class="mt-2">No releases uploaded yet.</p>
		{#if isAdmin}
			<button class="btn btn-outline-primary btn-sm" onclick={() => (showUpload = true)}>Upload First Release</button>
		{/if}
	</div>
{:else}
	{#each grouped as [version, osMap]}
		<div class="card mb-4 border-0 shadow-sm">
			<div class="card-header d-flex align-items-center justify-content-between bg-white border-bottom">
				<div class="d-flex align-items-center gap-2">
					<span class="badge bg-success fs-6 px-3 py-2">{version}</span>
					<span class="text-muted small">{[...osMap.values()].flat().length} artifact(s)</span>
				</div>
				<a href="{base}/releases/{version}" class="btn btn-sm btn-outline-secondary">Details</a>
			</div>
			<div class="card-body p-0">
				<div class="table-responsive">
					<table class="table table-hover align-middle mb-0">
						<thead class="table-light">
							<tr>
								<th class="ps-3">OS</th>
								<th>Architecture</th>
								<th>Size</th>
								<th>Uploaded</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each [...osMap.entries()] as [os, arches]}
								{#each arches as release, i}
									<tr>
										{#if i === 0}
											<td class="ps-3 fw-semibold" rowspan={arches.length}>
												{#if os === 'linux'}🐧{:else}🪟{/if}
												{os}
											</td>
										{/if}
										<td><code>{release.arch}</code></td>
										<td class="text-muted small">{formatBytes(release.size_bytes)}</td>
										<td class="text-muted small">{new Date(release.uploaded_at * 1000).toLocaleString()}</td>
										<td class="text-end pe-3">
											<div class="d-flex gap-2 justify-content-end">
												<a
													href={api.downloadReleaseUrl(release.version, release.os, release.arch)}
													class="btn btn-sm btn-outline-primary"
													download="rustinel-{release.version}-{release.os}-{release.arch}.zip"
												>Download</a>
												{#if isAdmin}
													<button
														class="btn btn-sm btn-outline-danger"
														onclick={() => deleteRelease(release.version, release.os, release.arch)}
													>Delete</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/each}
{/if}

<Modal show={showUpload} title="Upload Rustinel Release" onClose={() => (showUpload = false)}>
	<form onsubmit={(e) => { e.preventDefault(); uploadRelease(); }}>
		<div class="mb-3">
			<label for="rel-version" class="form-label">Version <span class="text-danger">*</span></label>
			<input
				type="text"
				class="form-control font-monospace"
				id="rel-version"
				bind:value={uploadVersion}
				placeholder="1.2.3"
				pattern="\d+\.\d+\.\d+"
				required
			/>
			<div class="form-text">Semantic version, e.g. 1.2.3</div>
		</div>
		<div class="row g-3 mb-3">
			<div class="col">
				<label for="rel-os" class="form-label">OS <span class="text-danger">*</span></label>
				<select class="form-select" id="rel-os" bind:value={uploadOS} required>
					<option value="linux">Linux</option>
					<option value="windows">Windows</option>
				</select>
			</div>
			<div class="col">
				<label for="rel-arch" class="form-label">Architecture <span class="text-danger">*</span></label>
				<select class="form-select" id="rel-arch" bind:value={uploadArch} required>
					<option value="amd64">amd64 (x86_64)</option>
					<option value="arm64">arm64 (AArch64)</option>
				</select>
			</div>
		</div>
		<div class="mb-3">
			<label for="rel-file" class="form-label">Zip File <span class="text-danger">*</span></label>
			<input
				type="file"
				class="form-control"
				id="rel-file"
				accept=".zip"
				onchange={(e) => (uploadFile = e.target.files[0])}
				required
			/>
		</div>
		<button type="submit" class="btn btn-primary w-100" disabled={uploading}>
			{uploading ? 'Uploading…' : 'Upload Release'}
		</button>
	</form>
</Modal>
