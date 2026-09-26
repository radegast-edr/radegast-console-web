<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { api, type UserInfo, type Device, type Pack } from '$lib/api';
	import { user, showFlash, showError } from '$lib/store';
	import { goto } from '$app/navigation';
	import WysiwygEditor from '$lib/components/WysiwygEditor.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { formatBytes } from '$lib/utils';
	import Icon from '@iconify/svelte';

	let users = $state<UserInfo[]>([]);
	let devices = $state<Device[]>([]);
	let packs = $state<Pack[]>([]);
	let activeTab = $state<'users' | 'devices' | 'packs' | 'stats' | 'broadcast'>('users');
	let resetPasswordResult = $state<{ email: string } | null>(null);

	let totalDevicesSpace = $derived(devices.reduce((acc, d) => acc + (d.total_space_used || 0), 0));

	type DeviceSortColumn = 'id' | 'name' | 'space_used';
	let deviceSortColumn = $state<DeviceSortColumn>('id');
	let deviceSortAsc = $state(true);

	function toggleDeviceSort(column: DeviceSortColumn) {
		if (deviceSortColumn === column) {
			deviceSortAsc = !deviceSortAsc;
		} else {
			deviceSortColumn = column;
			deviceSortAsc = column !== 'space_used';
		}
	}

	let sortedAdminDevices = $derived(
		[...devices].sort((a, b) => {
			let result = 0;
			if (deviceSortColumn === 'id') {
				result = Number(a.id) - Number(b.id);
			} else if (deviceSortColumn === 'name') {
				result = (a.name || '').localeCompare(b.name || '');
			} else if (deviceSortColumn === 'space_used') {
				result = (a.total_space_used || 0) - (b.total_space_used || 0);
			}
			return deviceSortAsc ? result : -result;
		})
	);

	type UserSortColumn = 'id' | 'email' | 'role';
	let userSortColumn = $state<UserSortColumn>('id');
	let userSortAsc = $state(true);

	function toggleUserSort(column: UserSortColumn) {
		if (userSortColumn === column) {
			userSortAsc = !userSortAsc;
		} else {
			userSortColumn = column;
			userSortAsc = true;
		}
	}

	let sortedAdminUsers = $derived(
		[...users].sort((a, b) => {
			let result = 0;
			if (userSortColumn === 'id') {
				result = Number(a.id) - Number(b.id);
			} else if (userSortColumn === 'email') {
				result = (a.email || '').localeCompare(b.email || '');
			} else if (userSortColumn === 'role') {
				result = (a.role || '').localeCompare(b.role || '');
			}
			return userSortAsc ? result : -result;
		})
	);

	type PackSortColumn = 'id' | 'name';
	let packSortColumn = $state<PackSortColumn>('id');
	let packSortAsc = $state(true);

	function togglePackSort(column: PackSortColumn) {
		if (packSortColumn === column) {
			packSortAsc = !packSortAsc;
		} else {
			packSortColumn = column;
			packSortAsc = true;
		}
	}

	let sortedAdminPacks = $derived(
		[...packs].sort((a, b) => {
			let result = 0;
			if (packSortColumn === 'id') {
				result = Number(a.id) - Number(b.id);
			} else if (packSortColumn === 'name') {
				result = (a.name || '').localeCompare(b.name || '');
			}
			return packSortAsc ? result : -result;
		})
	);

	// Stats tab state
	let alertStats = $state<{
		severity_distribution: Record<string, number>;
		resolution_distribution: Record<string, number>;
		rule_distribution: Record<string, number>;
		rule_type_distribution: Record<string, number>;
	} | null>(null);
	let deviceStats = $state<{
		agent_distribution: Record<string, number>;
		rustinel_distribution: Record<string, number>;
		os_distribution: Record<string, number>;
		health_distribution: Record<string, number>;
		online_distribution: Record<string, number>;
	} | null>(null);

	let alertFromTime = $state<string | null>(null);
	let alertToTime = $state<string | null>(null);

	// Alert filter state
	let filterSeverity = $state<string[]>([]);
	let filterRuleType = $state<string[]>([]);
	let filterRuleId = $state<string[]>([]);
	let filterResolution = $state<string[]>([]);
	let availableRuleIds = $state<string[]>([]);
	let ruleIdSearch = $state('');
	let ruleIdDropdownOpen = $state(false);

	let showSeverityDropdown = $state(false);
	let showRuleTypeDropdown = $state(false);
	let showResolutionDropdown = $state(false);

	// Device filter state
	let filterOnlineStatus = $state<string[]>([]);
	let filterHealthStatus = $state<string[]>([]);
	let filterAgentVersion = $state<string[]>([]);
	let filterRustinelVersion = $state<string[]>([]);
	let filterOs = $state<string[]>([]);

	let availableAgentVersions = $state<string[]>([]);
	let availableRustinelVersions = $state<string[]>([]);
	let availableOsList = $state<string[]>([]);

	let showOnlineDropdown = $state(false);
	let showHealthDropdown = $state(false);
	let showAgentDropdown = $state(false);
	let showRustinelDropdown = $state(false);
	let showOsDropdown = $state(false);

	let showRuleModal = $state(false);
	let modalRuleType = $state('');
	let modalRuleId = $state('');
	let modalRuleContent = $state('');
	let loadingRuleContent = $state(false);

	let filteredRuleIds = $derived(
		ruleIdSearch
			? availableRuleIds.filter((r) =>
					r.toLowerCase().includes(ruleIdSearch.toLowerCase())
				)
			: availableRuleIds
	);

	onMount(async () => {
		let currentUser = $user;
		if (!currentUser) {
			try {
				currentUser = await api.me();
				user.set(currentUser);
			} catch {
				// not logged in
			}
		}
		if (currentUser?.role !== 'admin') {
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
			alertStats = await api.adminGetAlertStats({
				from_time: fromUtc,
				to_time: toUtc,
				severity: filterSeverity,
				rule_type: filterRuleType,
				rule_id: filterRuleId,
				alert_resolution: filterResolution
			});
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function loadDeviceStats() {
		try {
			deviceStats = await api.adminGetDeviceStats({
				online_status: filterOnlineStatus,
				health_status: filterHealthStatus,
				agent_version: filterAgentVersion,
				rustinel_version: filterRustinelVersion,
				os: filterOs
			});
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function loadAvailableRuleIds() {
		try {
			availableRuleIds = await api.adminGetAlertRuleIds();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function loadDeviceFilterOptions() {
		try {
			const res = await api.adminGetDeviceFilterOptions();
			availableAgentVersions = res.agent_versions;
			availableRustinelVersions = res.rustinel_versions;
			availableOsList = res.os_list;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	function toggleFilter(
		arr: string[],
		value: string,
		setter: (v: string[]) => void
	) {
		const idx = arr.indexOf(value);
		if (idx >= 0) {
			setter([...arr.slice(0, idx), ...arr.slice(idx + 1)]);
		} else {
			setter([...arr, value]);
		}
		loadAlertStats();
	}

	function toggleDeviceFilter(
		arr: string[],
		value: string,
		setter: (v: string[]) => void
	) {
		const idx = arr.indexOf(value);
		if (idx >= 0) {
			setter([...arr.slice(0, idx), ...arr.slice(idx + 1)]);
		} else {
			setter([...arr, value]);
		}
		loadDeviceStats();
	}

	function removeRuleIdFilter(value: string) {
		filterRuleId = filterRuleId.filter((v) => v !== value);
		loadAlertStats();
	}

	function closeAllFilterDropdowns() {
		showSeverityDropdown = false;
		showRuleTypeDropdown = false;
		showResolutionDropdown = false;
		ruleIdDropdownOpen = false;
		showOnlineDropdown = false;
		showHealthDropdown = false;
		showAgentDropdown = false;
		showRustinelDropdown = false;
		showOsDropdown = false;
	}

	type FilterDropdownName =
		| 'severity'
		| 'ruletype'
		| 'resolution'
		| 'online'
		| 'health'
		| 'agent'
		| 'rustinel'
		| 'os';

	function toggleFilterDropdown(dropdownName: FilterDropdownName) {
		const isOpenMap: Record<FilterDropdownName, boolean> = {
			severity: showSeverityDropdown,
			ruletype: showRuleTypeDropdown,
			resolution: showResolutionDropdown,
			online: showOnlineDropdown,
			health: showHealthDropdown,
			agent: showAgentDropdown,
			rustinel: showRustinelDropdown,
			os: showOsDropdown
		};
		const wasOpen = isOpenMap[dropdownName];
		closeAllFilterDropdowns();
		if (!wasOpen) {
			if (dropdownName === 'severity') showSeverityDropdown = true;
			else if (dropdownName === 'ruletype') showRuleTypeDropdown = true;
			else if (dropdownName === 'resolution') showResolutionDropdown = true;
			else if (dropdownName === 'online') showOnlineDropdown = true;
			else if (dropdownName === 'health') showHealthDropdown = true;
			else if (dropdownName === 'agent') showAgentDropdown = true;
			else if (dropdownName === 'rustinel') showRustinelDropdown = true;
			else if (dropdownName === 'os') showOsDropdown = true;
		}
	}

	function handleStatsWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.filter-dropdown-container') && !target.closest('.rule-id-filter-container')) {
			closeAllFilterDropdowns();
		}
	}

	async function openRuleContent(ruleType: string, ruleId: string) {
		modalRuleType = ruleType;
		modalRuleId = ruleId;
		modalRuleContent = '';
		showRuleModal = true;
		loadingRuleContent = true;
		try {
			const res = await api.adminGetAlertRuleContent(ruleType, ruleId);
			modalRuleContent = res.content;
		} catch (e) {
			showError((e as Error).message);
			showRuleModal = false;
		} finally {
			loadingRuleContent = false;
		}
	}

	function selectStatsTab() {
		activeTab = 'stats';
		loadAlertStats();
		loadDeviceStats();
		loadAvailableRuleIds();
		loadDeviceFilterOptions();
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

<svelte:window onclick={handleStatsWindowClick} />

<h2>Admin Panel</h2>

<ul class="nav nav-tabs mb-4">
	<li class="nav-item">
		<button
			class="nav-link {activeTab === 'users' ? 'active' : 'text-body-secondary bg-transparent'}"
			onclick={() => (activeTab = 'users')}
		>
			Users ({users.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link {activeTab === 'devices' ? 'active' : 'text-body-secondary bg-transparent'}"
			onclick={() => (activeTab = 'devices')}
		>
			Devices ({devices.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link {activeTab === 'packs' ? 'active' : 'text-body-secondary bg-transparent'}"
			onclick={() => (activeTab = 'packs')}
		>
			Packs ({packs.length})
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link {activeTab === 'stats' ? 'active' : 'text-body-secondary bg-transparent'}"
			onclick={selectStatsTab}
		>
			Stats
		</button>
	</li>
	<li class="nav-item">
		<button
			class="nav-link {activeTab === 'broadcast' ? 'active' : 'text-body-secondary bg-transparent'}"
			onclick={() => (activeTab = 'broadcast')}
		>
			Broadcast
		</button>
	</li>
</ul>

{#if activeTab === 'users'}
	{#if resetPasswordResult}
		<div class="alert alert-success alert-dismissible fade show shadow-sm border-0 mb-4" role="alert" style="padding: 1.25rem;">
			<h6 class="fw-bold mb-1"><Icon icon="lucide:key" class="me-1 align-text-bottom" /> Password Reset Successful</h6>
			<p class="mb-0 small text-dark-emphasis">
				The password for <strong>{resetPasswordResult.email}</strong> has been reset. The user was emailed the new password.
			</p>
			<button type="button" class="btn-close" onclick={() => (resetPasswordResult = null)} aria-label="Close"></button>
		</div>
	{/if}

	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => toggleUserSort('id')}
					>
						ID
						{#if userSortColumn === 'id'}
							<Icon icon={userSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => toggleUserSort('email')}
					>
						Email
						{#if userSortColumn === 'email'}
							<Icon icon={userSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => toggleUserSort('role')}
					>
						Role
						{#if userSortColumn === 'role'}
							<Icon icon={userSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>Verified</th>
				<th>Configured MFA</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedAdminUsers as u (u.id)}
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
							<span class="badge bg-body-secondary text-body">None</span>
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
	<div class="d-flex justify-content-between align-items-center mb-3">
		<span class="text-body-secondary small">Total database space used: <strong class="text-body font-monospace">{formatBytes(totalDevicesSpace)}</strong></span>
	</div>
	<table class="table table-hover align-middle">
		<thead>
			<tr>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => toggleDeviceSort('id')}
					>
						ID
						{#if deviceSortColumn === 'id'}
							<Icon icon={deviceSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => toggleDeviceSort('name')}
					>
						Name
						{#if deviceSortColumn === 'name'}
							<Icon icon={deviceSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => toggleDeviceSort('space_used')}
					>
						Space Used
						{#if deviceSortColumn === 'space_used'}
							<Icon icon={deviceSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedAdminDevices as d (d.id)}
				<tr>
					<td>{d.id}</td>
					<td>
						<a href="{base}/devices/{d.id}">{d.name}</a>
						{#if !d.signature_public_key}
							<span class="badge bg-danger ms-2" title="Unsigned device! Signing key is not set.">Unsigned</span>
						{/if}
					</td>
					<td><span class="font-monospace small">{formatBytes(d.total_space_used)}</span></td>
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
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => togglePackSort('id')}
					>
						ID
						{#if packSortColumn === 'id'}
							<Icon icon={packSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>
					<button
						type="button"
						class="btn btn-link text-decoration-none p-0 fw-bold text-body d-inline-flex align-items-center gap-1"
						onclick={() => togglePackSort('name')}
					>
						Name
						{#if packSortColumn === 'name'}
							<Icon icon={packSortAsc ? 'lucide:arrow-up' : 'lucide:arrow-down'} width="14" height="14" />
						{:else}
							<Icon icon="lucide:arrow-up-down" width="12" height="12" class="text-body-secondary opacity-50" />
						{/if}
					</button>
				</th>
				<th>Description</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedAdminPacks as p (p.id)}
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

					<div class="row g-2 mb-3">
						<!-- Severity Dropdown -->
						<div class="col-md-4 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Severity</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showSeverityDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('severity')}
								aria-expanded={showSeverityDropdown}
							>
								<span class="text-truncate">
									{#if filterSeverity.length > 0}
										{filterSeverity.join(', ')}
									{:else}
										All Severities
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showSeverityDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#each ['critical', 'high', 'medium', 'low', 'informational'] as sev}
									<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
										<input
											type="checkbox"
											checked={filterSeverity.includes(sev)}
											onchange={() => toggleFilter(filterSeverity, sev, (v) => (filterSeverity = v))}
										/>
										<span class="text-capitalize small">{sev}</span>
									</label>
								{/each}
							</div>
						</div>

						<!-- Rule Type Dropdown -->
						<div class="col-md-4 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Rule Type</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showRuleTypeDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('ruletype')}
								aria-expanded={showRuleTypeDropdown}
							>
								<span class="text-truncate">
									{#if filterRuleType.length > 0}
										{filterRuleType.map(r => r.toUpperCase()).join(', ')}
									{:else}
										All Rule Types
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showRuleTypeDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#each ['sigma', 'ioc', 'yara'] as rt}
									<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
										<input
											type="checkbox"
											checked={filterRuleType.includes(rt)}
											onchange={() => toggleFilter(filterRuleType, rt, (v) => (filterRuleType = v))}
										/>
										<span class="small">{rt.toUpperCase()}</span>
									</label>
								{/each}
							</div>
						</div>

						<!-- Resolution Dropdown -->
						<div class="col-md-4 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Resolution</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showResolutionDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('resolution')}
								aria-expanded={showResolutionDropdown}
							>
								<span class="text-truncate">
									{#if filterResolution.length > 0}
										{filterResolution.map(r => r === 'none' ? 'Unresolved' : r.replace('_', ' ')).join(', ')}
									{:else}
										All Resolutions
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showResolutionDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#each [['true_positive', 'True positive'], ['false_positive', 'False positive'], ['benign', 'Benign'], ['none', 'Unresolved']] as [res, label]}
									<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
										<input
											type="checkbox"
											checked={filterResolution.includes(res)}
											onchange={() => toggleFilter(filterResolution, res, (v) => (filterResolution = v))}
										/>
										<span class="small">{label}</span>
									</label>
								{/each}
							</div>
						</div>
					</div>

					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="mb-4 rule-id-filter-container">
						<label for="filter-rule-id-search" class="form-label small fw-bold mb-1">Rule ID</label>
						<div class="position-relative">
							<input
								id="filter-rule-id-search"
								type="text"
								class="form-control form-control-sm"
								placeholder="Search rule IDs..."
								bind:value={ruleIdSearch}
								onfocus={() => (ruleIdDropdownOpen = true)}
							/>
							{#if ruleIdDropdownOpen && filteredRuleIds.length > 0}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="list-group position-absolute w-100 shadow-sm"
									style="max-height: 200px; overflow-y: auto; z-index: 10;"
									onkeydown={() => {}}
								>
									{#each filteredRuleIds.slice(0, 50) as rid}
										<button
											type="button"
											class="list-group-item list-group-item-action small"
											class:active={filterRuleId.includes(rid)}
											onclick={() =>
												toggleFilter(filterRuleId, rid, (v) => (filterRuleId = v))}
										>
											{rid}
										</button>
									{/each}
								</div>
							{/if}
						</div>
						{#if filterRuleId.length > 0}
							<div class="d-flex flex-wrap gap-1 mt-1">
								{#each filterRuleId as rid}
									<span class="badge bg-info d-inline-flex align-items-center">
										{rid}
										<button
											type="button"
											class="btn-close btn-close-white ms-1"
											style="font-size: 0.5rem;"
											onclick={() => removeRuleIdFilter(rid)}
											aria-label="Remove {rid}"
										></button>
									</span>
								{/each}
							</div>
						{/if}
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

						<h6 class="fw-bold mb-3">Alert Distribution by Resolution</h6>
						{@const totalResolutions = Object.values(alertStats.resolution_distribution).reduce((a, b) => a + b, 0)}
						{#if totalResolutions === 0}
							<p class="text-muted small mb-4">No resolutions in this time frame.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
								{#each [['true_positive', 'True Positive', 'bg-danger'], ['false_positive', 'False Positive', 'bg-warning'], ['benign', 'Benign', 'bg-success'], ['none', 'Unresolved', 'bg-secondary']] as [res, label, barColor]}
									{@const count = alertStats.resolution_distribution[res] || 0}
									{@const pct = totalResolutions > 0 ? Math.round((count / totalResolutions) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small">{label}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
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
							<p class="text-muted small mb-4">No matched detection rules.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
								{#each Object.entries(alertStats.rule_distribution).sort((a, b) => b[1] - a[1]) as [ruleId, count]}
									{@const pct = totalRules > 0 ? Math.round((count / totalRules) * 100) : 0}
									{@const parts = ruleId.split('::')}
									{@const hasType = parts.length > 1 && parts[0] !== 'unknown'}
									<div>
										<div class="d-flex justify-content-between mb-1">
											{#if hasType}
												<button
													type="button"
													class="btn btn-link btn-sm p-0 text-start text-truncate fw-semibold small text-decoration-none text-body-emphasis"
													style="max-width: 70%;"
													onclick={() => openRuleContent(parts[0], parts.slice(1).join('::'))}
													title="Click to view rule content: {ruleId}"
												>
													{ruleId}
												</button>
											{:else}
												<span class="fw-semibold small text-truncate" style="max-width: 70%;" title={ruleId}>{ruleId}</span>
											{/if}
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-info" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<h6 class="fw-bold mb-3 mt-4">Alert Distribution by Rule Type</h6>
						{@const totalRuleTypes = Object.values(alertStats.rule_type_distribution).reduce((a, b) => a + b, 0)}
						{#if totalRuleTypes === 0}
							<p class="text-muted small">No matched rule types.</p>
						{:else}
							<div class="d-flex flex-column gap-3">
								{#each Object.entries(alertStats.rule_type_distribution).sort((a, b) => b[1] - a[1]) as [ruleType, count]}
									{@const pct = totalRuleTypes > 0 ? Math.round((count / totalRuleTypes) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small text-uppercase">{ruleType}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar bg-primary" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else}
						<Spinner centered size="sm" color="muted" text="Loading alert stats..." py={4} />
					{/if}
				</div>
			</div>
		</div>

		<!-- Right Column: Device Distribution -->
		<div class="col-md-6">
			<div class="card h-100 border-0 shadow-sm bg-body-tertiary">
				<div class="card-body p-4">
					<h5 class="card-title fw-bold mb-3">Device Stats</h5>
					<div class="row g-2 mb-3">
						<!-- Online Status Dropdown -->
						<div class="col-md-6 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Online Status</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showOnlineDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('online')}
								aria-expanded={showOnlineDropdown}
							>
								<span class="text-truncate">
									{#if filterOnlineStatus.length > 0}
										{filterOnlineStatus.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
									{:else}
										All Statuses
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showOnlineDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#each [['online', 'Online'], ['offline', 'Offline']] as [val, label]}
									<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
										<input
											type="checkbox"
											checked={filterOnlineStatus.includes(val)}
											onchange={() => toggleDeviceFilter(filterOnlineStatus, val, (v) => (filterOnlineStatus = v))}
										/>
										<span class="small">{label}</span>
									</label>
								{/each}
							</div>
						</div>

						<!-- Health Status Dropdown -->
						<div class="col-md-6 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Health Status</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showHealthDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('health')}
								aria-expanded={showHealthDropdown}
							>
								<span class="text-truncate">
									{#if filterHealthStatus.length > 0}
										{filterHealthStatus.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
									{:else}
										All Health Statuses
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showHealthDropdown ? 'show' : ''}" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#each [['healthy', 'Healthy'], ['unhealthy', 'Unhealthy'], ['unknown', 'Unknown']] as [val, label]}
									<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
										<input
											type="checkbox"
											checked={filterHealthStatus.includes(val)}
											onchange={() => toggleDeviceFilter(filterHealthStatus, val, (v) => (filterHealthStatus = v))}
										/>
										<span class="small">{label}</span>
									</label>
								{/each}
							</div>
						</div>
					</div>

					<div class="row g-2 mb-4">
						<!-- Agent Version Dropdown -->
						<div class="col-md-4 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Agent Version</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showAgentDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('agent')}
								aria-expanded={showAgentDropdown}
							>
								<span class="text-truncate">
									{#if filterAgentVersion.length > 0}
										{filterAgentVersion.join(', ')}
									{:else}
										All Agent Versions
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showAgentDropdown ? 'show' : ''}" style="max-height: 250px; overflow-y: auto;" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#if availableAgentVersions.length === 0}
									<div class="dropdown-item text-muted small">No versions available</div>
								{:else}
									{#each availableAgentVersions as ver}
										<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
											<input
												type="checkbox"
												checked={filterAgentVersion.includes(ver)}
												onchange={() => toggleDeviceFilter(filterAgentVersion, ver, (v) => (filterAgentVersion = v))}
											/>
											<span class="small text-truncate">{ver}</span>
										</label>
									{/each}
								{/if}
							</div>
						</div>

						<!-- Rustinel Version Dropdown -->
						<div class="col-md-4 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">Rustinel Version</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showRustinelDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('rustinel')}
								aria-expanded={showRustinelDropdown}
							>
								<span class="text-truncate">
									{#if filterRustinelVersion.length > 0}
										{filterRustinelVersion.join(', ')}
									{:else}
										All Rustinel Versions
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showRustinelDropdown ? 'show' : ''}" style="max-height: 250px; overflow-y: auto;" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#if availableRustinelVersions.length === 0}
									<div class="dropdown-item text-muted small">No versions available</div>
								{:else}
									{#each availableRustinelVersions as ver}
										<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
											<input
												type="checkbox"
												checked={filterRustinelVersion.includes(ver)}
												onchange={() => toggleDeviceFilter(filterRustinelVersion, ver, (v) => (filterRustinelVersion = v))}
											/>
											<span class="small text-truncate">{ver}</span>
										</label>
									{/each}
								{/if}
							</div>
						</div>

						<!-- OS Dropdown -->
						<div class="col-md-4 col-12 filter-dropdown-container dropdown position-relative">
							<span class="form-label small fw-bold mb-1 d-block">OS</span>
							<button
								type="button"
								class="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-between dropdown-toggle {showOsDropdown ? 'show' : ''}"
								onclick={() => toggleFilterDropdown('os')}
								aria-expanded={showOsDropdown}
							>
								<span class="text-truncate">
									{#if filterOs.length > 0}
										{filterOs.join(', ')}
									{:else}
										All OS
									{/if}
								</span>
							</button>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div class="dropdown-menu w-100 p-2 shadow-sm {showOsDropdown ? 'show' : ''}" style="max-height: 250px; overflow-y: auto;" onclick={(e) => e.stopPropagation()} role="menu" tabindex="-1">
								{#if availableOsList.length === 0}
									<div class="dropdown-item text-muted small">No OS available</div>
								{:else}
									{#each availableOsList as osItem}
										<label class="dropdown-item d-flex align-items-center gap-2" style="cursor: pointer;">
											<input
												type="checkbox"
												checked={filterOs.includes(osItem)}
												onchange={() => toggleDeviceFilter(filterOs, osItem, (v) => (filterOs = v))}
											/>
											<span class="small text-truncate">{osItem}</span>
										</label>
									{/each}
								{/if}
							</div>
						</div>
					</div>

					{#if deviceStats}
						{@const totalAgentDevices = Object.values(deviceStats.agent_distribution).reduce((a, b) => a + b, 0)}
						{@const totalRustinelDevices = Object.values(deviceStats.rustinel_distribution).reduce((a, b) => a + b, 0)}

						<h6 class="fw-bold mb-3">Agent Version Distribution</h6>
						{#if totalAgentDevices === 0}
							<p class="text-muted small mb-4">No matching devices.</p>
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
							<p class="text-muted small mb-4">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
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
						<h6 class="fw-bold mb-3">OS Distribution</h6>
						{#if totalOsDevices === 0}
							<p class="text-muted small mb-4">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
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

						{@const totalHealthDevices = Object.values(deviceStats.health_distribution).reduce((a, b) => a + b, 0)}
						<h6 class="fw-bold mb-3">Health Status Distribution</h6>
						{#if totalHealthDevices === 0}
							<p class="text-muted small mb-4">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3 mb-4">
								{#each [['healthy', 'Healthy', 'bg-success'], ['unhealthy', 'Unhealthy', 'bg-danger'], ['unknown', 'Unknown', 'bg-secondary']] as [hStatus, label, barColor]}
									{@const count = deviceStats.health_distribution[hStatus] || 0}
									{@const pct = totalHealthDevices > 0 ? Math.round((count / totalHealthDevices) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small">{label}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar {barColor}" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						{@const totalOnlineDevices = Object.values(deviceStats.online_distribution).reduce((a, b) => a + b, 0)}
						<h6 class="fw-bold mb-3">Online Status Distribution</h6>
						{#if totalOnlineDevices === 0}
							<p class="text-muted small">No matching devices.</p>
						{:else}
							<div class="d-flex flex-column gap-3">
								{#each [['online', 'Online', 'bg-success'], ['offline', 'Offline', 'bg-secondary']] as [oStatus, label, barColor]}
									{@const count = deviceStats.online_distribution[oStatus] || 0}
									{@const pct = totalOnlineDevices > 0 ? Math.round((count / totalOnlineDevices) * 100) : 0}
									<div>
										<div class="d-flex justify-content-between mb-1">
											<span class="fw-semibold small">{label}</span>
											<span class="text-muted small">{count} ({pct}%)</span>
										</div>
										<div class="progress" style="height: 6px;">
											<div class="progress-bar {barColor}" role="progressbar" style="width: {pct}%;" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{:else}
						<Spinner centered size="sm" color="muted" text="Loading device stats..." py={4} />
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
					<Spinner inline size="sm" color="light" text="Sending..." />
				{:else}
					Queue Broadcast to All Subscribed Users
				{/if}
			</button>
		</form>
	</div>
{/if}

<!-- Detection Rule Modal -->
<Modal
	show={showRuleModal}
	title="Detection Rule"
	onClose={() => { showRuleModal = false; }}
>
	<div class="mb-2 d-flex gap-2 align-items-center">
		<span class="badge bg-warning text-dark text-uppercase">{modalRuleType}</span>
		<span class="fw-bold text-body font-monospace small">{modalRuleId}</span>
	</div>
	{#if loadingRuleContent}
		<div class="py-4">
			<Spinner centered size="sm" text="Loading rule content..." />
		</div>
	{:else}
		<pre class="p-3 rounded font-monospace mb-0" style="background-color: #282a36; color: #f8f8f2; white-space: pre-wrap; word-break: break-all; font-size: 0.82rem; border: 1px solid #44475a; max-height: 60vh; overflow-y: auto;">{modalRuleContent}</pre>
	{/if}
</Modal>
