<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type UserInfo, type Device, type Pack } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import { goto } from '$app/navigation';
	import WysiwygEditor from '$lib/components/WysiwygEditor.svelte';

	let users = $state<UserInfo[]>([]);
	let devices = $state<Device[]>([]);
	let packs = $state<Pack[]>([]);
	let activeTab = $state<'users' | 'devices' | 'packs' | 'stats' | 'broadcast'>('users');
	let resetPasswordResult = $state<{ email: string } | null>(null);

	// Stats tab state
	let alertStats = $state<{ severity_distribution: Record<string, number>; rule_distribution: Record<string, number> } | null>(null);
	let deviceStats = $state<{ agent_distribution: Record<string, number>; rustinel_distribution: Record<string, number>; os_distribution: Record<string, number> } | null>(null);

	let alertFromTime = $state<string | null>(null);
	let alertToTime = $state<string | null>(null);

	let excludeOffline = $state(false);
	let excludeNoVersion = $state(false);

	onMount(async () => {
		if ($user?.role !== 'admin') {
			goto(`${base}/`);
			return;
		}

		// Initialize default date range
		const pad = (num: number) => String(num).padStart(2, '0');
		const formatLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
		const now = new Date();
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

		alertFromTime = formatLocal(sevenDaysAgo);
		alertToTime = formatLocal(tomorrow);

		await loadAll();
	});

	async function loadAlertStats() {
		try {
			const fromUtc = alertFromTime ? new Date(alertFromTime).toISOString() : null;
			const toUtc = alertToTime ? new Date(alertToTime).toISOString() : null;
			alertStats = await api.adminGetAlertStats(fromUtc, toUtc);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function loadDeviceStats() {
		try {
			deviceStats = await api.adminGetDeviceStats(excludeOffline, excludeNoVersion);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	function selectStatsTab() {
		activeTab = 'stats';
		loadAlertStats();
		loadDeviceStats();
	}

	async function loadAll(): Promise<void> {
		try {
			const [usersData, devicesData, packsData] = await Promise.all([
				api.adminListUsers(),
				api.adminListDevices(),
				api.adminListPacks()
			]);
			users = usersData;
			devices = devicesData;
			packs = packsData;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deleteUser(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this user?')) return;
		try {
			await api.adminDeleteUser(Number(id));
			await loadAll();
			showFlash('User deleted');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function resetUserPassword(u: UserInfo): Promise<void> {
		if (!await askConfirm(`Are you sure you want to reset the password and clear all MFA devices for user ${u.email}?`)) return;
		try {
			await api.adminResetUserPassword(Number(u.id));
			resetPasswordResult = { email: u.email };
			showFlash('User password reset successfully and MFA cleared');
			await loadAll();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deleteDevice(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this device?')) return;
		try {
			await api.adminDeleteDevice(Number(id));
			await loadAll();
			showFlash('Device deleted');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deletePack(id: string | number): Promise<void> {
		if (!await askConfirm('Delete this pack and all its versions?')) return;
		try {
			await api.adminDeletePack(Number(id));
			await loadAll();
			showFlash('Pack deleted');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	let newSubject = $state('');
	let newEmailType = $state<'downtime_maintenance' | 'news_updates'>('downtime_maintenance');
	let newHtmlBody = $state('');
	let isSubmittingBroadcast = $state(false);

	async function submitBroadcast(e: Event) {
		e.preventDefault();
		if (!newSubject.trim()) {
			showError('Subject is required');
			return;
		}
		if (!newHtmlBody.trim() || newHtmlBody.trim() === '<p><br></p>') {
			showError('Email body is required');
			return;
		}

		if (!await askConfirm(`Send this email to all users subscribed to ${newEmailType === 'downtime_maintenance' ? 'Platform downtime and maintenance' : 'Platform news and updates'}?`)) {
			return;
		}

		isSubmittingBroadcast = true;
		try {
			const res = await api.adminSendBroadcast({
				subject: newSubject,
				html_body: newHtmlBody,
				email_type: newEmailType
			}) as { message?: string };
			showFlash(res.message || 'Broadcast scheduled successfully in waves');
			newSubject = '';
			newHtmlBody = '';
		} catch (e) {
			showError((e as Error).message);
		} finally {
			isSubmittingBroadcast = false;
		}
	}
</script>

<h2>Admin Panel</h2>

<ul class="nav nav-tabs mb-4">
	<li class="nav-item">
		<button class="nav-link" class:active={activeTab === 'users'} onclick={() => (activeTab = 'users')}>
			Users ({users.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link"
			class:active={activeTab === 'devices'}
			onclick={() => (activeTab = 'devices')}
		>
			Devices ({devices.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link"
			class:active={activeTab === 'packs'}
			onclick={() => (activeTab = 'packs')}
		>
			Packs ({packs.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link"
			class:active={activeTab === 'stats'}
			onclick={selectStatsTab}
		>
			Stats
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link"
			class:active={activeTab === 'broadcast'}
			onclick={() => (activeTab = 'broadcast')}
		>
			Broadcast
		</button>
	</li>
</ul>

{#if activeTab === 'users'}
	{#if resetPasswordResult}
		<div class="alert alert-success alert-dismissible fade show shadow-sm border-0 mb-4" role="alert" style="border-radius: 12px; padding: 1.25rem;">
			<h6 class="fw-bold mb-1">🔑 Password Reset Successful</h6>
			<p class="mb-0 small text-dark-emphasis">
				The password for <strong>{resetPasswordResult.email}</strong> has been reset. The user was emailed the new password.
			</p>
			<button type="button" class="btn-close" onclick={() => (resetPasswordResult = null)} aria-label="Close"></button>
		</div>
	{/if}

	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>ID</th>
				<th>Email</th>
				<th>Role</th>
				<th>Verified</th>
				<th>Configured MFA</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each users as u}
				<tr>
					<td>{u.id}</td>
					<td>{u.email}</td>
					<td><span class="badge bg-secondary">{u.role}</span></td>
					<td>{u.verified ? '✓' : '✗'}</td>
					<td>
						{#if u.mfa_configured_level === 'hardware_token'}
							<span class="badge bg-success">Hardware token</span>
						{:else if u.mfa_configured_level === 'otp'}
							<span class="badge bg-primary">OTP</span>
						{:else}
							<span class="badge bg-light text-dark">None</span>
						{/if}
						{#if u.mfa_setup_missing}
							<span class="badge bg-danger ms-1" title="Missing required setup">Setup Missing</span>
						{/if}
					</td>
					<td>
						<button
							class="btn btn-sm btn-outline-warning me-2"
							onclick={() => resetUserPassword(u)}
							disabled={u.id === $user?.id}>Reset Password & MFA</button
						>
						<button
							class="btn btn-sm btn-outline-danger"
							onclick={() => deleteUser(u.id)}
							disabled={u.id === $user?.id}>Delete</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if activeTab === 'devices'}
	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>ID</th>
				<th>Name</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each devices as d}
				<tr>
					<td>{d.id}</td>
					<td>
						<a href="{base}/devices/{d.id}">{d.name}</a>
						{#if !d.signature_public_key}
							<span class="badge bg-danger ms-2" title="Unsigned device! Signing key is not set.">Unsigned</span>
						{/if}
					</td>
					<td>
						<button class="btn btn-sm btn-outline-danger" onclick={() => deleteDevice(d.id)}
							>Delete</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if activeTab === 'packs'}
	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>ID</th>
				<th>Name</th>
				<th>Description</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each packs as p}
				<tr>
					<td>{p.id}</td>
					<td>
						{p.name}
						{#if p.team_ids && p.team_ids.length > 0}
							<span class="badge bg-secondary ms-2" style="font-size: 0.7rem;">Private</span>
						{:else}
							<span class="badge bg-success ms-2" style="font-size: 0.7rem;">Global</span>
						{/if}
					</td>
					<td>{p.description}</td>
					<td>
						<button class="btn btn-sm btn-outline-danger" onclick={() => deletePack(p.id)}
							>Delete</button
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if activeTab === 'stats'}
	<div class="row g-4">
		<!-- Left Column: Alert Stats -->
		<div class="col-md-6">
			<div class="card h-100 border-0 shadow-sm bg-body-tertiary">
				<div class="card-body p-4">
					<h5 class="card-title fw-bold mb-3">Alert Stats</h5>
					<div class="row g-2 mb-4">
						<div class="col-6">
							<label for="stats-from-time" class="form-label small fw-bold mb-1">From</label>
							<input
								id="stats-from-time"
								type="datetime-local"
								class="form-control form-control-sm"
								bind:value={alertFromTime}
								onchange={loadAlertStats}
							/>
						</div>
						<div class="col-6">
							<label for="stats-to-time" class="form-label small fw-bold mb-1">To</label>
							<input
								id="stats-to-time"
								type="datetime-local"
								class="form-control form-control-sm"
								bind:value={alertToTime}
								onchange={loadAlertStats}
							/>
						</div>
					</div>

					{#if alertStats}
						{@const totalAlerts = Object.values(alertStats.severity_distribution).reduce((a, b) => a + b, 0)}

						<h6 class="fw-bold mb-3">Alert Distribution by Severity</h6>
						{#if totalAlerts === 0}
							<p class="text-muted small">No alerts in this time frame.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
								{#each ['critical', 'high', 'medium', 'low', 'informational', 'unknown'] as sev}
									{@const count = alertStats.severity_distribution[sev] || 0}
									{@const pct = totalAlerts > 0 ? Math.round((count / totalAlerts) * 100) : 0}
									{@const barColor = sev === 'critical' || sev === 'high' ? 'bg-danger' : (sev === 'medium' ? 'bg-warning' : (sev === 'low' ? 'bg-primary' : 'bg-secondary'))}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold text-capitalize small">{sev}</span>
											<span class="text-muted small">{count} ({pct})</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar {barColor}" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<h6 class="fw-bold mb-3">Alert Distribution by Rule ID</h6>
						{@const totalRules = Object.values(alertStats.rule_distribution).reduce((a, b) => a + b, 0)}
						{#if totalRules === 0}
							<p class="text-muted small">No matched detection rules.</p>
						{:else}
							<div class="d-flex flex-column gap-3">
								{#each Object.entries(alertStats.rule_distribution).sort((a, b) => b[1] - a[1]) as [ruleId, count]}
									{@const pct = totalRules > 0 ? Math.round((count / totalRules) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small text-truncate" style="max-width: 70%;" title={ruleId}>{ruleId}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-info" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else}
						<div class="text-center py-4">
							<span class="spinner-border spinner-border-sm text-muted"></span> Loading alert stats...
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Right Column: Device Distribution -->
		<div class="col-md-6">
			<div class="card h-100 border-0 shadow-sm bg-body-tertiary">
				<div class="card-body p-4">
					<h5 class="card-title fw-bold mb-3">Device Stats</h5>
					<div class="mb-4">
						<div class="form-check mb-2">
							<input
								class="form-check-input"
								type="checkbox"
								id="excludeOffline"
								bind:checked={excludeOffline}
								onchange={loadDeviceStats}
							/>
							<label class="form-check-label small" for="excludeOffline">
								Exclude offline devices (inactive > 10m)
							</label>
						</div>
						<div class="form-check">
							<input
								class="form-check-input"
								type="checkbox"
								id="excludeNoVersion"
								bind:checked={excludeNoVersion}
								onchange={loadDeviceStats}
							/>
							<label class="form-check-label small" for="excludeNoVersion">
								Exclude devices with unreported version
							</label>
						</div>
					</div>

					{#if deviceStats}
						{@const totalAgentDevices = Object.values(deviceStats.agent_distribution).reduce((a, b) => a + b, 0)}
						{@const totalRustinelDevices = Object.values(deviceStats.rustinel_distribution).reduce((a, b) => a + b, 0)}

						<h6 class="fw-bold mb-3">Agent Version Distribution</h6>
						{#if totalAgentDevices === 0}
							<p class="text-muted small">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
								{#each Object.entries(deviceStats.agent_distribution).sort((a, b) => b[1] - a[1]) as [ver, count]}
									{@const pct = totalAgentDevices > 0 ? Math.round((count / totalAgentDevices) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small">{ver}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-primary" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<h6 class="fw-bold mb-3">Rustinel Version Distribution</h6>
						{#if totalRustinelDevices === 0}
							<p class="text-muted small">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3">
								{#each Object.entries(deviceStats.rustinel_distribution).sort((a, b) => b[1] - a[1]) as [ver, count]}
									{@const pct = totalRustinelDevices > 0 ? Math.round((count / totalRustinelDevices) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small">{ver}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-success" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						{@const totalOsDevices = Object.values(deviceStats.os_distribution).reduce((a, b) => a + b, 0)}
						<h6 class="fw-bold mb-3 mt-4">OS Distribution</h6>
						{#if totalOsDevices === 0}
							<p class="text-muted small">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3">
								{#each Object.entries(deviceStats.os_distribution).sort((a, b) => b[1] - a[1]) as [osName, count]}
									{@const pct = totalOsDevices > 0 ? Math.round((count / totalOsDevices) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small">{osName}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-info" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else}
						<div class="text-center py-4">
							<span class="spinner-border spinner-border-sm text-muted"></span> Loading device stats...
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{:else if activeTab === 'broadcast'}
	<div class="card border-0 shadow-sm bg-body-tertiary p-4" style="border-radius: 3px;">
		<h5 class="fw-bold mb-4">Send HTML Email Broadcast</h5>
		<form onsubmit={submitBroadcast}>
			<div class="mb-3">
				<label for="broadcast-subject" class="form-label fw-bold small">Subject</label>
				<input
					id="broadcast-subject"
					type="text"
					class="form-control"
					bind:value={newSubject}
					placeholder="e.g. Scheduled System Upgrade"
					required
				/>
			</div>

			<div class="mb-3">
				<label for="broadcast-type" class="form-label fw-bold small">Email Category</label>
				<select id="broadcast-type" class="form-select" bind:value={newEmailType}>
					<option value="downtime_maintenance">Maintenance Notification (Important)</option>
					<option value="news_updates">Platform News / Updates</option>
				</select>
				<div class="form-text text-muted">
					Users who have unsubscribed from the selected category will not receive this email.
				</div>
			</div>

			<div class="mb-4">
				<span class="form-label d-block fw-bold small mb-2">Email Content (HTML)</span>
				<WysiwygEditor bind:value={newHtmlBody} />
			</div>

			<button type="submit" class="btn btn-primary" disabled={isSubmittingBroadcast} style="border-radius: 3px;">
				{#if isSubmittingBroadcast}
					<span class="spinner-border spinner-border-sm me-2"></span> Sending...
				{:else}
					Queue Broadcast to All Subscribed Users
				{/if}
			</button>
		</form>
	</div>
{/if}
