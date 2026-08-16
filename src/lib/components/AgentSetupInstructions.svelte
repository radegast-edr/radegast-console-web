<script lang="ts">
	import { api } from '$lib/api';

	let { token = '', deviceName = 'windows', isReinstall = false, onDismiss = () => {} } = $props<{
		deviceName?: string;
		token?: string;
		isReinstall?: boolean;
		onDismiss?: () => void;
	}>();

	let selectedOS = $state<'linux' | 'windows' | 'macos'>('linux');
	const backendUrl = api.getBackendUrl().replace(/\/$/, '');

	async function downloadInstallBat() {
		const url = `${backendUrl}/api/v1/device/install?os=windows`;
		let installScript = await (await fetch(url)).text();
		installScript = `@echo off\nSET "RADEGAST_TOKEN=${token}"\n@echo on\n${installScript}`;
		const blob = new Blob([installScript], { type: 'application/x.bat' });

		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `radegast-agent-install-${deviceName}.bat`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
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
							curl -sSL "{backendUrl}/api/v1/device/install?os=linux" | sudo RADEGAST_TOKEN="{token}" sh
						</code>
					</div>
					<small class="form-text text-muted">
						This will verify system requirements, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and configure systemd services.
					</small>
				</div>
			{:else if selectedOS === 'windows'}
				<div class="mb-3">
					<label for="win-install-cmd" class="form-label fw-semibold">2a. Run this command on your Windows device in an Administrator PowerShell prompt:</label>
					<div class="input-group">
						<code id="win-install-cmd" class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							$env:RADEGAST_TOKEN="{token}"; iwr -useb "{backendUrl}/api/v1/device/install?os=windows" -OutFile install.bat; .\install.bat
						</code>
					</div>
					<small class="form-text text-muted">
						This will download portable Python, install <code>uv</code> and <code>radegast-agent</code>, download <code>rustinel</code>, and register background Scheduled Tasks.
					</small>
					<p class="form-label fw-semibold mt-2">2b. Or you can download the install script directly by clicking on <a href="#install-radegast-{deviceName}.bat" onclick={downloadInstallBat}>this link</a>.</p>
				</div>
			{:else if selectedOS === 'macos'}
				<div class="mb-3">
					<label for="mac-install-cmd" class="form-label fw-semibold">2. Run this command on your macOS device as root:</label>
					<div class="input-group">
						<code id="mac-install-cmd" class="form-control bg-dark text-light p-2 font-monospace" style="user-select: all;">
							curl -sSL "{backendUrl}/api/v1/device/install?os=mac" | sudo RADEGAST_TOKEN="{token}" sh
						</code>
					</div>
					<small class="form-text text-muted">
						This will install <code>uv</code> and <code>radegast-agent</code>, download the official signed <code>rustinel</code> binary, and configure launchd services.
					</small>
				</div>
			{/if}

			<button class="btn btn-secondary btn-sm" onclick={onDismiss}>
				Dismiss
			</button>
		</div>
	</div>
{/if}
