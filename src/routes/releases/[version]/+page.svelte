<script>
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { user, showFlash, showError } from '$lib/store.js';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';

	let currentVersion = $derived(page.params.version);
	let releases = $state([]);
	let loading = $state(true);

	// Upload new artifact for this version state
	let showUpload = $state(false);
	let uploadOS = $state('linux');
	let uploadArch = $state('amd64');
	let uploadFile = $state(null);
	let uploading = $state(false);

	const ARCHES_BY_OS = {
		linux: [
			{ value: 'amd64', label: 'amd64 (x86_64)' },
			{ value: 'arm64', label: 'arm64 (AArch64)' }
		],
		windows: [
			{ value: 'amd64', label: 'amd64 (x86_64)' }
		],
		mac: [
			{ value: 'm5', label: 'm5 (Apple Silicon M5)' }
		]
	};

	let allowedArches = $derived(ARCHES_BY_OS[uploadOS] || []);

	// Filtering releases matching this version
	let artifacts = $derived(releases.filter(r => r.version === currentVersion));

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

	function formatBytes(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	async function uploadArtifact() {
		if (!uploadFile) {
			showError('Please select a file');
			return;
		}
		uploading = true;
		try {
			await api.uploadRelease(currentVersion, uploadOS, uploadArch, uploadFile);
			showUpload = false;
			uploadFile = null;
			await loadReleases();
			showFlash(`Artifact for ${uploadOS}/${uploadArch} uploaded successfully`);
		} catch (e) {
			showError(e.message);
		} finally {
			uploading = false;
		}
	}

	async function deleteArtifact(os, arch) {
		if (!confirm(`Delete artifact ${currentVersion}/${os}/${arch}? This cannot be undone.`)) return;
		try {
			await api.deleteRelease(currentVersion, os, arch);
			showFlash(`Deleted artifact ${os}/${arch}`);
			await loadReleases();
			// If no artifacts left for this version, redirect back to releases list
			if (releases.filter(r => r.version === currentVersion).length === 0) {
				goto(`${base}/releases`);
			}
		} catch (e) {
			showError(e.message);
		}
	}

	let isAdmin = $derived($user && $user.role === 'admin');
	let backendUrl = $derived(api.getBackendUrl().replace(/\/$/, ''));
</script>

<svelte:head>
	<title>Release {currentVersion} — Radegast EDR</title>
</svelte:head>

<div class="mb-4">
	<a href="{base}/releases" class="btn btn-outline-secondary btn-sm">← Back to Releases</a>
</div>

{#if loading}
	<div class="text-center py-5">
		<div class="spinner-border text-primary" role="status"></div>
	</div>
{:else if artifacts.length === 0}
	<div class="alert alert-warning">
		<h4 class="alert-heading fw-bold">Release Not Found</h4>
		<p class="mb-0">No artifacts found for release version <strong>{currentVersion}</strong>. It may have been deleted or does not exist.</p>
	</div>
{:else}
	<div class="d-flex justify-content-between align-items-center mb-4">
		<div>
			<div class="d-flex align-items-center gap-2">
				<h2 class="mb-0 fw-bold">Release {currentVersion}</h2>
				<span class="badge bg-success fs-6 px-3 py-1">Active</span>
			</div>
			<p class="text-muted small mb-0">Inspect artifacts and deployment endpoints for this Rustinel release.</p>
		</div>
		{#if isAdmin}
			<button class="btn btn-primary" onclick={() => (showUpload = true)}>
				Add OS/Arch Artifact
			</button>
		{/if}
	</div>

	<div class="row g-4">
		<!-- Left Column: Artifacts Table -->
		<div class="col-lg-7">
			<div class="card border-0 shadow-sm">
				<div class="card-header bg-white border-bottom py-3">
					<h5 class="mb-0 fw-bold">Artifacts</h5>
				</div>
				<div class="card-body p-0">
					<div class="table-responsive">
						<table class="table table-hover align-middle mb-0">
							<thead class="table-light">
								<tr>
									<th class="ps-3">OS</th>
									<th>Architecture</th>
									<th>Size</th>
									<th>Uploaded At</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each artifacts as release}
									<tr>
										<td class="ps-3 fw-semibold">
											{#if release.os === 'linux'}
												🐧
											{:else if release.os === 'windows'}
												🪟
											{:else if release.os === 'mac'}
												🍏
											{/if}
											{release.os}
										</td>
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
														onclick={() => deleteArtifact(release.os, release.arch)}
													>Delete</button>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>

		<!-- Right Column: Integration & Endpoints Info -->
		<div class="col-lg-5">
			<div class="card border-0 shadow-sm">
				<div class="card-header bg-white border-bottom py-3">
					<h5 class="mb-0 fw-bold">Endpoints & Integration</h5>
				</div>
				<div class="card-body">
					<p class="text-muted small">
						Use the following HTTP API endpoints and commands to download and deploy this specific version of the eBPF agent to your endpoints.
					</p>

					<div class="accordion" id="endpointsAccordion">
						<!-- Linux Endpoint -->
						<div class="accordion-item border-0 mb-3 shadow-sm rounded">
							<h2 class="accordion-header" id="headingLinux">
								<button class="accordion-button bg-light fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseLinux" aria-expanded="true" aria-controls="collapseLinux">
									🐧 Linux Deployment
								</button>
							</h2>
							<div id="collapseLinux" class="accordion-collapse collapse show" aria-labelledby="headingLinux" data-bs-parent="#endpointsAccordion">
								<div class="accordion-body bg-white pt-2">
									<div class="mb-3">
										<label for="linux-dl-amd64" class="form-label small fw-bold text-secondary mb-1">Direct Download Link (amd64):</label>
										<div class="input-group">
											<input id="linux-dl-amd64" type="text" class="form-control form-control-sm font-monospace text-muted" readonly value="{backendUrl}/api/v1/device/rustinel/download?os=linux&arch=amd64&version={currentVersion}" />
										</div>
									</div>
									<div class="mb-3">
										<label for="linux-dl-arm64" class="form-label small fw-bold text-secondary mb-1">Direct Download Link (arm64):</label>
										<div class="input-group">
											<input id="linux-dl-arm64" type="text" class="form-control form-control-sm font-monospace text-muted" readonly value="{backendUrl}/api/v1/device/rustinel/download?os=linux&arch=arm64&version={currentVersion}" />
										</div>
									</div>
									<div class="mb-0">
										<label for="linux-curl-cmd" class="form-label small fw-bold text-secondary mb-1">curl Download Command:</label>
										<pre id="linux-curl-cmd" class="bg-dark text-light p-2 rounded small font-monospace mb-0" style="white-space: pre-wrap; word-break: break-all; user-select: all;">curl -L -o rustinel.zip "{backendUrl}/api/v1/device/rustinel/download?os=linux&arch=amd64&version={currentVersion}"</pre>
									</div>
								</div>
							</div>
						</div>

						<!-- Windows Endpoint -->
						<div class="accordion-item border-0 shadow-sm rounded">
							<h2 class="accordion-header" id="headingWindows">
								<button class="accordion-button collapsed bg-light fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseWindows" aria-expanded="false" aria-controls="collapseWindows">
									🪟 Windows Deployment
								</button>
							</h2>
							<div id="collapseWindows" class="accordion-collapse collapse" aria-labelledby="headingWindows" data-bs-parent="#endpointsAccordion">
								<div class="accordion-body bg-white pt-2">
									<div class="mb-3">
										<label for="win-dl-amd64" class="form-label small fw-bold text-secondary mb-1">Direct Download Link (amd64):</label>
										<div class="input-group">
											<input id="win-dl-amd64" type="text" class="form-control form-control-sm font-monospace text-muted" readonly value="{backendUrl}/api/v1/device/rustinel/download?os=windows&arch=amd64&version={currentVersion}" />
										</div>
									</div>
									<div class="mb-0">
										<label for="win-ps-cmd" class="form-label small fw-bold text-secondary mb-1">PowerShell Download Command:</label>
										<pre id="win-ps-cmd" class="bg-dark text-light p-2 rounded small font-monospace mb-0" style="white-space: pre-wrap; word-break: break-all; user-select: all;">Invoke-WebRequest -Uri "{backendUrl}/api/v1/device/rustinel/download?os=windows&arch=amd64&version={currentVersion}" -OutFile "rustinel.zip"</pre>
									</div>
								</div>
							</div>
						</div>

						<!-- macOS Endpoint -->
						<div class="accordion-item border-0 shadow-sm rounded mt-3">
							<h2 class="accordion-header" id="headingMacOS">
								<button class="accordion-button collapsed bg-light fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseMacOS" aria-expanded="false" aria-controls="collapseMacOS">
									🍏 macOS Deployment
								</button>
							</h2>
							<div id="collapseMacOS" class="accordion-collapse collapse" aria-labelledby="headingMacOS" data-bs-parent="#endpointsAccordion">
								<div class="accordion-body bg-white pt-2">
									<div class="mb-3">
										<label for="mac-dl-m5" class="form-label small fw-bold text-secondary mb-1">Direct Download Link (m5):</label>
										<div class="input-group">
											<input id="mac-dl-m5" type="text" class="form-control form-control-sm font-monospace text-muted" readonly value="{backendUrl}/api/v1/device/rustinel/download?os=mac&arch=m5&version={currentVersion}" />
										</div>
									</div>
									<div class="mb-0">
										<label for="mac-curl-cmd" class="form-label small fw-bold text-secondary mb-1">curl Download Command:</label>
										<pre id="mac-curl-cmd" class="bg-dark text-light p-2 rounded small font-monospace mb-0" style="white-space: pre-wrap; word-break: break-all; user-select: all;">curl -L -o rustinel.zip "{backendUrl}/api/v1/device/rustinel/download?os=mac&arch=m5&version={currentVersion}"</pre>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Upload Artifact Modal -->
<Modal show={showUpload} title="Upload OS/Arch Artifact" onClose={() => (showUpload = false)}>
	<form onsubmit={(e) => { e.preventDefault(); uploadArtifact(); }}>
		<div class="mb-3">
			<label for="upload-version" class="form-label">Version</label>
			<input id="upload-version" type="text" class="form-control font-monospace" value={currentVersion} disabled />
			<div class="form-text">Artifacts will be added to release version {currentVersion}.</div>
		</div>
		<div class="row g-3 mb-3">
			<div class="col">
				<label for="art-os" class="form-label">OS <span class="text-danger">*</span></label>
				<select
					class="form-select"
					id="art-os"
					bind:value={uploadOS}
					onchange={() => {
						const options = ARCHES_BY_OS[uploadOS] || [];
						if (options.length > 0) {
							uploadArch = options[0].value;
						}
					}}
					required
				>
					<option value="linux">Linux</option>
					<option value="windows">Windows</option>
					<option value="mac">macOS</option>
				</select>
			</div>
			<div class="col">
				<label for="art-arch" class="form-label">Architecture <span class="text-danger">*</span></label>
				<select class="form-select" id="art-arch" bind:value={uploadArch} required>
					{#each allowedArches as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="mb-3">
			<label for="art-file" class="form-label">Zip File <span class="text-danger">*</span></label>
			<input
				type="file"
				class="form-control"
				id="art-file"
				accept=".zip"
				onchange={(e) => (uploadFile = e.target.files[0])}
				required
			/>
		</div>
		<button type="submit" class="btn btn-primary w-100" disabled={uploading}>
			{uploading ? 'Uploading…' : 'Upload Artifact'}
		</button>
	</form>
</Modal>
