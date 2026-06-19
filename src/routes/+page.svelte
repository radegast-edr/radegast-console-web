<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type Team, type Group, type Device } from '$lib/api';
	import { user } from '$lib/store';
	import { getStoredPrivateKey } from '$lib/crypto';
	import { goto } from '$app/navigation';
	import { mapSeverityToNumber } from '$lib/utils';
	import Spinner from '$lib/components/Spinner.svelte';

	let isLoading = $state(true);
	let teams = $state<Team[]>([]);
	let groups = $state<Group[]>([]);
	let devices = $state<Device[]>([]);
	let hasPrivateKey = $state(true); // default true to avoid flash
	let unreadCount = $state(0);
	let teamCounts = $state<Record<number, number>>({});
	let groupCounts = $state<Record<number, number>>({});
	let severityCounts = $state<Record<string, number>>({});
	let resolutionCounts = $state<Record<string, number>>({});
	let totalLogsCount = $state(0);
	let alertsByGroup = $state<Record<string, number>>({});
	let alertsByTeam = $state<Record<string, number>>({});
 
 	onMount(() => {
 		const loadData = async () => {
 			try {
 				const me = await api.me();
 				$user = me;
 				const data = await api.getDashboardData();

 				const teamsRes = data.teams;
 				const groupsRes = data.groups;
 				const devicesRes = data.devices;
 				const logsRes = data.logs;

 				teamCounts = data.team_device_counts;
 				groupCounts = data.group_device_counts;

 				const deviceToGroups = data.device_groups_map;
 				const deviceToTeams = data.device_teams_map;

 				const sevCounts: Record<string, number> = {
 					critical: 0,
 					high: 0,
 					medium: 0,
 					low: 0,
 					informational: 0,
 					unknown: 0
 				};
 				const resCounts: Record<string, number> = {
 					unread: 0,
 					read: 0,
 					true_positive: 0,
 					false_positive: 0
 				};
 				const gAlerts: Record<string, number> = {};
 				const tAlerts: Record<string, number> = {};
 
 				logsRes.forEach(log => {
 					const sev = (log.severity || 'unknown').toLowerCase();
 					if (sev in sevCounts) {
 						sevCounts[sev]++;
 					} else {
 						sevCounts.unknown++;
 					}
 					const isBelowSeverity = log.severity && $user && mapSeverityToNumber(log.severity) < mapSeverityToNumber($user.notification_level);
					let res = 'unread';
					if (isBelowSeverity) {
						res = 'read';
					} else if (log.alert_resolution && log.alert_resolution !== 'none') {
						if ($user && !$user.extended_edr_enabled) {
							// Basic mode: a log is "read" once seen, regardless of resolution.
							res = log.seen ? log.alert_resolution : 'unread';
						} else {
							res = log.alert_resolution;
						}
					} else {
						// No resolution set:
						// - In basic mode: active/unread only if NOT yet seen.
						// - In extended EDR: always active/unread until explicitly resolved.
						if ($user && !$user.extended_edr_enabled && log.seen) {
							res = 'read';
						}
					}
					if (res in resCounts) {
						resCounts[res]++;
					}
 
 					const gNames = deviceToGroups[log.device_id] || ['Unassigned'];
 					gNames.forEach(gName => {
 						gAlerts[gName] = (gAlerts[gName] || 0) + 1;
 					});
 
 					const tNames = deviceToTeams[log.device_id] || ['Unassigned'];
 					tNames.forEach(tName => {
 						tAlerts[tName] = (tAlerts[tName] || 0) + 1;
 					});
 				});
 				severityCounts = sevCounts;
 				resolutionCounts = resCounts;
 				alertsByGroup = gAlerts;
 				alertsByTeam = tAlerts;
 				totalLogsCount = logsRes.length;
 
 				teams = teamsRes;
 				groups = groupsRes;
 				devices = devicesRes;
 				unreadCount = resCounts.unread;
 				hasPrivateKey = !!(await getStoredPrivateKey(me.id));
 			} catch {
				goto(`${base}/login`);
			} finally {
 				isLoading = false;
 			}
 		};
 		loadData();
 
 		const interval = setInterval(refreshUnreadCount, 60000);
 		return () => clearInterval(interval);
 	});
 
 	async function refreshUnreadCount(): Promise<void> {
 		try {
 			const logsRes = await api.listLogs(1, 1000).catch(() => []);
 			let unread = 0;
 			logsRes.forEach(log => {
 				const isBelowSeverity = log.severity && $user && mapSeverityToNumber(log.severity) < mapSeverityToNumber($user.notification_level);
 				let res = 'unread';
 				if (isBelowSeverity) {
 					res = 'read';
 				} else if (log.alert_resolution && log.alert_resolution !== 'none') {
 					if ($user && !$user.extended_edr_enabled) {
 						res = log.seen ? log.alert_resolution : 'unread';
 					} else {
 						res = log.alert_resolution;
 					}
 				} else {
 					if ($user && !$user.extended_edr_enabled && log.seen) {
 						res = 'read';
 					}
 				}
 				if (res === 'unread') {
 					unread++;
 				}
 			});
 			unreadCount = unread;
 		} catch (e) {
 			console.error("Failed to auto-refresh unread alerts:", e);
 		}
 	}
</script>

<svelte:head>
	<title>Dashboard - Radegast</title>
</svelte:head>

<div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
	<h2 class="mb-0 fw-bold">Overview</h2>
</div>

{#if $user && !hasPrivateKey}
	<div class="alert alert-warning shadow-sm border-0 mb-4" style="border-radius: 12px;">
		<h5 class="fw-bold">Private Key Not Found</h5>
		<p class="mb-2">
			Your private key is not stored in this browser. You won't be able to decrypt logs until
			you restore it.
		</p>
		<a href="{base}/keys/recovery" class="btn btn-warning btn-sm me-2 fw-bold">Recover with Recovery Key</a>
		<a href="{base}/keys/transfer" class="btn btn-outline-dark btn-sm fw-bold">Transfer from Another Browser</a>
	</div>
{/if}

<div class="row g-4 mb-4">
	<div class="col-md-4">
		<div class="card h-100 border-0 shadow-sm" style="background: var(--bs-body-bg);">
			<div class="card-body d-flex flex-column justify-content-center align-items-center py-4">
				<h6 class="text-uppercase text-muted fw-bold mb-3" style="letter-spacing: 0.05em;">Total Devices</h6>
				{#if isLoading}
					<Spinner size="lg" color="primary" />
				{:else}
					<h1 class="display-4 fw-bolder text-primary mb-0">{devices.length}</h1>
				{/if}
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card h-100 border-0 shadow-sm" style="background: var(--bs-body-bg);">
			<div class="card-body d-flex flex-column justify-content-center align-items-center py-4">
				<h6 class="text-uppercase text-muted fw-bold mb-3" style="letter-spacing: 0.05em;">Active Alerts</h6>
				{#if isLoading}
					<Spinner size="lg" color="danger" />
				{:else}
					<h1 class="display-4 fw-bolder mb-0 {unreadCount > 0 ? 'text-danger' : 'text-success'}">{unreadCount}</h1>
				{/if}
			</div>
		</div>
	</div>
	<div class="col-md-4">
		<div class="card h-100 border-0 shadow-sm" style="background: var(--bs-body-bg);">
			<div class="card-body d-flex flex-column justify-content-center align-items-center py-4">
				<h6 class="text-uppercase text-muted fw-bold mb-3" style="letter-spacing: 0.05em;">Total Teams</h6>
				{#if isLoading}
					<Spinner size="lg" color="info" />
				{:else}
					<h1 class="display-4 fw-bolder text-info mb-0">{teams.length}</h1>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="row g-4">
	<div class="col-md-6">
		<div class="card border-0 shadow-sm h-100" style="background: var(--bs-body-bg);">
			<div class="card-body p-4">
				<h5 class="card-title fw-bold mb-4">Alert Distribution by Group</h5>
				{#if isLoading}
					<Spinner centered size="sm" color="primary" text="Loading..." />
				{:else if totalLogsCount === 0 || Object.keys(alertsByGroup).length === 0}
					<p class="text-muted">No group alerts logged.</p>
				{:else}
					<div class="d-flex flex-column gap-3">
						{#each Object.entries(alertsByGroup).sort((a, b) => b[1] - a[1]) as [gName, count]}
							{@const pct = totalLogsCount > 0 ? Math.round((count / totalLogsCount) * 100) : 0}
							<div>
								<div class="d-flex justify-content-between mb-1">
									<span class="fw-semibold">{gName}</span>
									<span class="text-muted small">{count} ({pct}%)</span>
								</div>
								<div class="progress" style="height: 8px; border-radius: 4px;">
									<div class="progress-bar bg-primary" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="col-md-6">
		<div class="card border-0 shadow-sm h-100" style="background: var(--bs-body-bg);">
			<div class="card-body p-4">
				<h5 class="card-title fw-bold mb-4">Alert Distribution by Team</h5>
				{#if isLoading}
					<Spinner centered size="sm" color="info" text="Loading..." />
				{:else if totalLogsCount === 0 || Object.keys(alertsByTeam).length === 0}
					<p class="text-muted">No team alerts logged.</p>
				{:else}
					<div class="d-flex flex-column gap-3">
						{#each Object.entries(alertsByTeam).sort((a, b) => b[1] - a[1]) as [tName, count]}
							{@const pct = totalLogsCount > 0 ? Math.round((count / totalLogsCount) * 100) : 0}
							<div>
								<div class="d-flex justify-content-between mb-1">
									<span class="fw-semibold">{tName}</span>
									<span class="text-muted small">{count} ({pct}%)</span>
								</div>
								<div class="progress" style="height: 8px; border-radius: 4px;">
									<div class="progress-bar bg-info" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<div class="row g-4 mt-2">
	<div class="col-md-6">
		<div class="card border-0 shadow-sm h-100" style="background: var(--bs-body-bg);">
			<div class="card-body p-4">
				<h5 class="card-title fw-bold mb-4">Alert Severity Distribution</h5>
				{#if isLoading}
					<Spinner centered size="sm" color="danger" text="Loading..." />
				{:else if totalLogsCount === 0}
					<p class="text-muted">No alerts logged.</p>
				{:else}
					<div class="d-flex flex-column gap-3">
						{#each ['critical', 'high', 'medium', 'low', 'informational', 'unknown'] as sev}
							{@const count = severityCounts[sev] || 0}
							{@const pct = totalLogsCount > 0 ? Math.round((count / totalLogsCount) * 100) : 0}
							{@const barColor = sev === 'critical' || sev === 'high' ? 'bg-danger' : (sev === 'medium' ? 'bg-warning' : (sev === 'low' ? 'bg-primary' : 'bg-secondary'))}
							<div>
								<div class="d-flex justify-content-between mb-1">
									<span class="fw-semibold text-capitalize">{sev}</span>
									<span class="text-muted small">{count} ({pct}%)</span>
								</div>
								<div class="progress" style="height: 8px; border-radius: 4px;">
									<div class="progress-bar {barColor}" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if $user && $user.extended_edr_enabled}
		<div class="col-md-6">
			<div class="card border-0 shadow-sm h-100" style="background: var(--bs-body-bg);">
				<div class="card-body p-4">
					<h5 class="card-title fw-bold mb-4">Alert Resolution Distribution</h5>
					{#if isLoading}
						<Spinner centered size="sm" color="secondary" text="Loading..." />
					{:else if totalLogsCount === 0}
						<p class="text-muted">No resolved alerts.</p>
					{:else}
						<div class="d-flex flex-column gap-3">
							{#each [
								{ key: 'unread', label: 'Unread (New)', color: 'bg-danger' },
								{ key: 'read', label: 'Read (Acknowledge)', color: 'bg-secondary' },
								{ key: 'true_positive', label: 'True Positive', color: 'bg-warning' },
								{ key: 'false_positive', label: 'False Positive', color: 'bg-success' }
							] as res}
								{@const count = resolutionCounts[res.key] || 0}
								{@const pct = totalLogsCount > 0 ? Math.round((count / totalLogsCount) * 100) : 0}
								<div>
									<div class="d-flex justify-content-between mb-1">
										<span class="fw-semibold">{res.label}</span>
										<span class="text-muted small">{count} ({pct}%)</span>
									</div>
									<div class="progress" style="height: 8px; border-radius: 4px;">
										<div class="progress-bar {res.color}" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<div class="row g-4 mt-2">
	<div class="col-md-6">
		<div class="card border-0 shadow-sm h-100" style="background: var(--bs-body-bg);">
			<div class="card-body p-4">
				<h5 class="card-title fw-bold mb-4">Devices by Group</h5>
				{#if isLoading}
					<Spinner centered size="sm" color="primary" text="Loading..." />
				{:else if groups.length === 0}
					<p class="text-muted">No groups configured.</p>
				{:else}
					<div class="d-flex flex-column gap-3">
						{#each groups as g}
							{@const count = groupCounts[g.id] || 0}
							{@const pct = devices.length > 0 ? Math.round((count / devices.length) * 100) : 0}
							<div>
								<div class="d-flex justify-content-between mb-1">
									<span class="fw-semibold">{g.name}</span>
									<span class="text-muted small">{count} ({pct}%)</span>
								</div>
								<div class="progress" style="height: 8px; border-radius: 4px;">
									<div class="progress-bar bg-primary" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="col-md-6">
		<div class="card border-0 shadow-sm h-100" style="background: var(--bs-body-bg);">
			<div class="card-body p-4">
				<h5 class="card-title fw-bold mb-4">Devices by Team</h5>
				{#if isLoading}
					<Spinner centered size="sm" color="info" text="Loading..." />
				{:else if teams.length === 0}
					<p class="text-muted">No teams configured.</p>
				{:else}
					<div class="d-flex flex-column gap-3">
						{#each teams as t}
							{@const count = teamCounts[t.id] || 0}
							{@const maxCount = devices.length || 1}
							{@const pct = Math.round((count / maxCount) * 100)}
							<div>
								<div class="d-flex justify-content-between mb-1">
									<span class="fw-semibold">{t.name}</span>
									<span class="text-muted small">{count} devices</span>
								</div>
								<div class="progress" style="height: 8px; border-radius: 4px;">
									<div class="progress-bar bg-info" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
