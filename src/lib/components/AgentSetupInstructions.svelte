<script>
	import { api } from '$lib/api.js';

	let { token = '', isReinstall = false, onDismiss = () => {} } = $props();

	let selectedOS = $state('linux');
	const backendUrl = api.getBackendUrl().replace(/\/$/, '');
</script>

{#if token}
	<div class="card border-warning mb-4 shadow-sm">
		<div class="card-header bg-warning-subtle text-warning-emphasis py-3">
			<h5 class="mb-0 fw-bold">
				{isReinstall ? 'Device Reinstallation: Setup Agent' : 'Device Created: Setup Agent'}
			</h5>
		</div>
		<div class="card-body">
			<div class="mb-3">
				<label class="form-label fw-semibold">1. Select Target Operating System:</label>
				<div class="btn-group d-block" role="group">
					<button
						type="button"
						class="btn {selectedOS === 'linux' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => (selectedOS = 'linux')}
					>
						Linux
					</button>
					<button
						type="button"
						class="btn {selectedOS === 'windows' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => (selectedOS = 'windows')}
					>
						Windows
					</button>
				</div>
			</div>

			{#if selectedOS === 'linux'}
				<div class="mb-3">
					<label class="form-label fw-semibold">2. Run this command on your Linux device as root:</label>
					<div class="input-group">
						<code class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							curl -sSL "{backendUrl}/device/install?os=linux" | sudo RADEGAST_TOKEN="{token}" sh
						</code>
					</div>
					<small class="form-text text-muted">
						This will verify system requirements, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and configure systemd services.
					</small>
				</div>
			{:else}
				<div class="mb-3">
					<label class="form-label fw-semibold">2. Run this command on your Windows device in an Administrator PowerShell prompt:</label>
					<div class="input-group">
						<code class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							$env:RADEGAST_TOKEN="{token}"; iwr -useb "{backendUrl}/device/install?os=windows" -OutFile install.bat; .\install.bat
						</code>
					</div>
					<small class="form-text text-muted">
						This will download portable Python, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and register background Scheduled Tasks.
					</small>
				</div>
			{/if}

			<button class="btn btn-secondary btn-sm" onclick={onDismiss}>
				Dismiss
			</button>
		</div>
	</div>
{/if}
