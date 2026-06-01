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
				<label for="agent-os-group" class="form-label fw-semibold">1. Select Target Operating System:</label>
				<div id="agent-os-group" class="btn-group d-block" role="group">
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
					<button
						type="button"
						class="btn {selectedOS === 'macos' ? 'btn-primary' : 'btn-outline-primary'}"
						onclick={() => (selectedOS = 'macos')}
					>
						macOS
					</button>
				</div>
			</div>

			{#if selectedOS === 'linux'}
				<div class="mb-3">
					<label for="linux-install-cmd" class="form-label fw-semibold">2. Run this command on your Linux device as root:</label>
					<div class="input-group">
						<code id="linux-install-cmd" class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							curl -sSL "{backendUrl}/device/install?os=linux" | sudo RADEGAST_TOKEN="{token}" sh
						</code>
					</div>
					<small class="form-text text-muted">
						This will verify system requirements, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and configure systemd services.
					</small>
				</div>
			{:else if selectedOS === 'windows'}
				<div class="mb-3">
					<label for="win-install-cmd" class="form-label fw-semibold">2. Run this command on your Windows device in an Administrator PowerShell prompt:</label>
					<div class="input-group">
						<code id="win-install-cmd" class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							$env:RADEGAST_TOKEN="{token}"; iwr -useb "{backendUrl}/device/install?os=windows" -OutFile install.bat; .\install.bat
						</code>
					</div>
					<small class="form-text text-muted">
						This will download portable Python, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and register background Scheduled Tasks.
					</small>
				</div>
			{:else if selectedOS === 'macos'}
				<div class="mb-3">
					<div class="alert alert-info border-0 shadow-sm" style="border-radius: 8px;">
						<div class="d-flex align-items-center gap-2 mb-2">
							<span class="fs-4">🍏</span>
							<strong class="text-info-emphasis">macOS Support is coming soon!</strong>
						</div>
						<p class="mb-3 small text-dark-emphasis">
							In the meantime, you can set up the agent manually by using the device token below.
						</p>
						<div class="mb-3">
							<label for="macos-token-input" class="form-label fw-bold small text-secondary">Device Token:</label>
							<div class="input-group">
								<code id="macos-token-input" class="form-control bg-dark text-light p-2 font-monospace w-100" style="user-select: all;">{token}</code>
							</div>
						</div>
						<small class="text-muted">
							Configure your manual agent installation with the token above to authenticate this device.
						</small>
					</div>
				</div>
			{/if}

			<button class="btn btn-secondary btn-sm" onclick={onDismiss}>
				Dismiss
			</button>
		</div>
	</div>
{/if}
