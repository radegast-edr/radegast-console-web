<script lang="ts">
	import Icon from '@iconify/svelte';
	import { getAlertField, getAlertNumber, getAlertBoolean, getIntegrityBadgeClass } from '$lib/alertHelpers';
	import ProcessTree from './ProcessTree.svelte';

	let { alert }: { alert: Record<string, unknown> } = $props();

	let commandLine = $derived(getAlertField(alert, 'process.command_line'));
	let executable = $derived(getAlertField(alert, 'process.executable'));
	let pid = $derived(getAlertNumber(alert, 'process.pid'));
	let userName = $derived(getAlertField(alert, 'user.name'));
	let osType = $derived(getAlertField(alert, 'host.os.type'));

	let prompt = $derived(osType === 'windows' ? '>' : '$');

	let peOriginalName = $derived(getAlertField(alert, 'process.pe.original_file_name'));
	let peProduct = $derived(getAlertField(alert, 'process.pe.product'));
	let peDescription = $derived(getAlertField(alert, 'process.pe.description'));
	let peCompany = $derived(getAlertField(alert, 'process.pe.company'));
	let peFileVersion = $derived(getAlertField(alert, 'process.pe.file_version'));

	// Hashes
	let hashSha256 = $derived(getAlertField(alert, 'process.hash.sha256'));
	let hashMd5 = $derived(getAlertField(alert, 'process.hash.md5'));
	let hashSha1 = $derived(getAlertField(alert, 'process.hash.sha1'));
	let peImphash = $derived(getAlertField(alert, 'process.pe.imphash'));
	let hasHashes = $derived(!!(hashSha256 || hashMd5 || hashSha1 || peImphash));

	// Context & Security
	let workingDir = $derived(getAlertField(alert, 'process.working_directory'));
	let integrityLevel = $derived(getAlertField(alert, 'edr.process.integrity_level'));
	let targetImage = $derived(getAlertField(alert, 'edr.process.target_image'));
	let imageTruncated = $derived(getAlertBoolean(alert, 'edr.process.image_truncated'));

	// Containers & Namespaces
	let containerId = $derived(getAlertField(alert, 'container.id'));
	let containerRuntime = $derived(getAlertField(alert, 'container.runtime'));
	let cgroupPath = $derived(getAlertField(alert, 'edr.process.cgroup_path'));

	// User elevation
	let realUid = $derived(getAlertField(alert, 'edr.process.real_user_id'));
	let effectiveUid = $derived(getAlertField(alert, 'edr.process.effective_user_id'));
	let isElevated = $derived(realUid && effectiveUid && realUid !== effectiveUid);

	let copiedHash = $state<string | null>(null);

	function copyToClipboard(val: string, key: string) {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(val).then(() => {
				copiedHash = key;
				setTimeout(() => {
					if (copiedHash === key) copiedHash = null;
				}, 2000);
			}).catch(() => {});
		}
	}
</script>

<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
	<div class="card-body">
		<h6 class="fw-bold text-body-secondary mb-3">Process Details</h6>

		{#if commandLine}
			<div
				class="bg-body-secondary p-3 mb-3"
				style="font-family: 'Hack', monospace; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem;"
			>
				<span class="text-body-secondary">{prompt}</span> {commandLine}
			</div>
		{/if}

		<div class="mb-3">
			<ProcessTree {alert} />
		</div>

		<table class="table table-sm table-borderless mb-0">
			<tbody>
				{#if executable}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Executable</td>
						<td style="font-family: 'Hack', monospace;">
							{executable}
							{#if imageTruncated}
								<span class="badge bg-warning text-dark ms-1" title="Path was truncated by operating system limit">Truncated</span>
							{/if}
						</td>
					</tr>
				{/if}
				{#if targetImage}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Target Image</td>
						<td style="font-family: 'Hack', monospace;" class="text-danger fw-semibold">{targetImage}</td>
					</tr>
				{/if}
				{#if pid !== undefined}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Process ID</td>
						<td>{pid}</td>
					</tr>
				{/if}
				{#if workingDir}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Working Dir</td>
						<td style="font-family: 'Hack', monospace;" class="text-break">{workingDir}</td>
					</tr>
				{/if}
				{#if userName}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">User</td>
						<td>
							{userName}
							{#if isElevated}
								<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1" title="Real UID {realUid} raised to Effective UID {effectiveUid}">
									Privilege Elevation (UID {realUid} &rarr; {effectiveUid})
								</span>
							{/if}
						</td>
					</tr>
				{/if}
				{#if integrityLevel}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Integrity Level</td>
						<td>
							<span class="badge {getIntegrityBadgeClass(integrityLevel)}">{integrityLevel}</span>
						</td>
					</tr>
				{/if}
				{#if containerId}
					<tr>
						<td class="text-body-secondary" style="width: 140px;">Container</td>
						<td>
							<span class="badge bg-primary-subtle text-primary border border-primary-subtle me-1">
								<Icon icon="lucide:box" class="me-1" />{containerRuntime ?? 'Container'}: {containerId.slice(0, 12)}
							</span>
							{#if cgroupPath}
								<span class="small text-body-secondary font-monospace">{cgroupPath}</span>
							{/if}
						</td>
					</tr>
				{/if}
			</tbody>
		</table>

		<!-- File / Process Hashes -->
		{#if hasHashes}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Cryptographic Hashes</h6>
			<table class="table table-sm table-borderless small mb-0">
				<tbody>
					{#if hashSha256}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">SHA-256</td>
							<td>
								<span class="font-monospace text-break me-2">{hashSha256}</span>
								<button
									type="button"
									class="btn btn-sm btn-link p-0 text-decoration-none text-body-secondary me-2"
									onclick={() => copyToClipboard(hashSha256!, 'sha256')}
									title="Copy SHA-256"
								>
									<Icon icon={copiedHash === 'sha256' ? 'lucide:check' : 'lucide:copy'} />
								</button>
								<a
									href="https://www.virustotal.com/gui/search/{encodeURIComponent(hashSha256)}"
									target="_blank"
									rel="noopener noreferrer"
									class="text-decoration-none small text-primary d-inline-flex align-items-center gap-1"
									title="Search on VirusTotal"
								>
									VT <Icon icon="lucide:external-link" />
								</a>
							</td>
						</tr>
					{/if}
					{#if hashSha1}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">SHA-1</td>
							<td>
								<span class="font-monospace text-break me-2">{hashSha1}</span>
								<button
									type="button"
									class="btn btn-sm btn-link p-0 text-decoration-none text-body-secondary"
									onclick={() => copyToClipboard(hashSha1!, 'sha1')}
									title="Copy SHA-1"
								>
									<Icon icon={copiedHash === 'sha1' ? 'lucide:check' : 'lucide:copy'} />
								</button>
							</td>
						</tr>
					{/if}
					{#if hashMd5}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">MD5</td>
							<td>
								<span class="font-monospace text-break me-2">{hashMd5}</span>
								<button
									type="button"
									class="btn btn-sm btn-link p-0 text-decoration-none text-body-secondary me-2"
									onclick={() => copyToClipboard(hashMd5!, 'md5')}
									title="Copy MD5"
								>
									<Icon icon={copiedHash === 'md5' ? 'lucide:check' : 'lucide:copy'} />
								</button>
								<a
									href="https://www.virustotal.com/gui/search/{encodeURIComponent(hashMd5)}"
									target="_blank"
									rel="noopener noreferrer"
									class="text-decoration-none small text-primary d-inline-flex align-items-center gap-1"
									title="Search on VirusTotal"
								>
									VT <Icon icon="lucide:external-link" />
								</a>
							</td>
						</tr>
					{/if}
					{#if peImphash}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Imphash</td>
							<td class="font-monospace">{peImphash}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		{/if}

		<!-- Windows Executable PE Metadata -->
		{#if peOriginalName || peProduct || peDescription || peCompany || peFileVersion}
			<h6 class="fw-bold text-body-secondary mt-3 mb-2">Windows Executable Info</h6>
			<table class="table table-sm table-borderless small mb-0">
				<tbody>
					{#if peOriginalName}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Original Name</td>
							<td>{peOriginalName}</td>
						</tr>
					{/if}
					{#if peProduct}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Product</td>
							<td>{peProduct}</td>
						</tr>
					{/if}
					{#if peCompany}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Company</td>
							<td>{peCompany}</td>
						</tr>
					{/if}
					{#if peFileVersion}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">File Version</td>
							<td class="font-monospace">{peFileVersion}</td>
						</tr>
					{/if}
					{#if peDescription}
						<tr>
							<td class="text-body-secondary" style="width: 140px;">Description</td>
							<td>{peDescription}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		{/if}
	</div>
</div>
