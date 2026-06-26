<script lang="ts">
	import Icon from '@iconify/svelte';
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { decryptExclusionsList, encryptExclusion } from '$lib/exclusionHelpers';
	import { page } from '$app/stores';
	import { api, type GroupDetail, type Team, type TeamMember, type Device, type EnabledPack, type Pack, type PackVersion, type Exclusion, type ExclusionCreate } from '$lib/api';
	import { showFlash, showError } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';
	import ExclusionModal from '$lib/components/ExclusionModal.svelte';
	import { isDeviceActive } from '$lib/utils';
	import Spinner from '$lib/components/Spinner.svelte';
	import { initAgeWasm, generateKeypair, encrypt, decrypt, getStoredPrivateKey, getStoredPublicKey } from '$lib/crypto';
	import { goto } from '$app/navigation';

	let group = $state<(GroupDetail & { devices: Device[]; teams: Team[]; exclusions: Exclusion[]; public_key?: string | null; private_key?: string | null; invitations?: any[] }) | null>(null);
	let allTeams = $state<Team[]>([]);
	let allDevices = $state<Device[]>([]);
	let addTeamId = $state('');
	let addDeviceId = $state('');

	// Exclusion Management State
	let showExclusionModal = $state(false);
	let exclusionName = $state('');
	let exclusionQuery = $state('');
	let exclusionDescription = $state('');
	let exclusionType = $state<'hard' | 'soft'>('hard');
	let exclusionEncrypted = $state(false);
	let editingExclusion = $state<Exclusion | null>(null);

	// User teams and Pack Write/Admin Permissions
	let userTeams = $state<Team[]>([]);
	let hasPackWrite = $derived.by(() => {
		if (!group || userTeams.length === 0) return false;
		const userTeamIds = new Set(userTeams.map((t) => t.id));
		return (group.teams ?? []).some((t: { id: number; permission_pack?: string | null }) => userTeamIds.has(t.id) && t.permission_pack === 'write');
	});

	let hasAdminWrite = $derived.by(() => {
		if (!group || userTeams.length === 0) return false;
		const userTeamIds = new Set(userTeams.map((t) => t.id));
		return (group.teams ?? []).some((t: { id: number; permission_admin?: string | null }) => userTeamIds.has(t.id) && t.permission_admin === 'write');
	});

	// Unsupported Agent Warning
	let unsupportedDevices = $derived.by(() => {
		if (!group) return [];
		return (group.devices ?? []).filter(d => isAgentVersionUnsupported(d.agent_version));
	});

	function isAgentVersionUnsupported(version: string | null | undefined): boolean {
		if (!version) return true;
		const trimmed = version.trim();
		if (!trimmed) return true;
		if (trimmed.toLowerCase() === 'unknown') return true;
		
		if (trimmed.startsWith('python ')) {
			const verNum = trimmed.substring(7).trim();
			const parts = verNum.split('.').map(Number);
			if (parts.length >= 3) {
				const [major, minor] = parts;
				if (major < 0 || (major === 0 && minor < 5)) {
					return true;
				}
			} else {
				return true;
			}
			return false;
		}
		return false;
	}

	// Pack Management State
	let enabledPacks = $state<EnabledPack[]>([]);
	let showEnablePackModal = $state(false);
	let availablePacks = $state<Pack[]>([]);
	let selectedPackId = $state('');
	let packVersions = $state<PackVersion[]>([]);
	let selectedVersionId = $state('');
	let autoupdate = $state(true);

	// inline rename
	let editingName = $state(false);
	let editName = $state('');

	// Invitation State
	let inviteEmail = $state('');
	let groupMembers = $state<TeamMember[]>([]);

	$effect(() => {
		loadGroup($page.params.id ?? '');
	});

	async function loadGroup(id: string | number): Promise<void> {
		try {
			const [g, teams, devices] = await Promise.all([
				api.getGroup(Number(id)),
				api.listTeams(),
				api.listDevices()
			]);
			
			// Decrypt group private key if present and user has keys
			const me = await api.me();
			const userPriv = await getStoredPrivateKey(me.id);
			
			// Self-healing group key generation
			if ((!g.public_key || !g.private_key) && userPriv) {
				await initAgeWasm();
				const { publicKey, privateKey } = generateKeypair();
				
				const pubKeys = await api.getGroupRecipientPublicKeys(g.id);
				const myPub = await getStoredPublicKey(me.id);
				if (myPub && !pubKeys.includes(myPub)) {
					pubKeys.push(myPub);
				}
				const encPriv = encrypt(privateKey, pubKeys);
				
				await api.setupGroupKeys(g.id, {
					public_key: publicKey,
					private_key: encPriv
				});
				
				// Reload keys
				const updatedGroup = await api.getGroup(Number(id));
				g.public_key = updatedGroup.public_key;
				g.private_key = updatedGroup.private_key;
			}

			// Decrypt exclusions if encrypted
			if (g.exclusions) {
				g.exclusions = await decryptExclusionsList(g.exclusions, g.private_key, me.id);
			}

			// Load members for all linked teams
			const allGroupMembers: TeamMember[] = [];
			if (g.teams && g.teams.length > 0) {
				const membersRes = await Promise.all(g.teams.map(t => api.listMembers(t.id)));
				const seenMemberIds = new Set<number>();
				for (const mList of membersRes) {
					for (const m of mList) {
						if (!seenMemberIds.has(m.id)) {
							seenMemberIds.add(m.id);
							allGroupMembers.push(m);
						}
					}
				}
			}
			groupMembers = allGroupMembers;

			group = g;
			userTeams = teams;

			const groupTeamIds = new Set((g.teams ?? []).map((t) => t.id));
			allTeams = teams.filter((t) => !groupTeamIds.has(t.id));
			addTeamId = allTeams.length > 0 ? String(allTeams[0].id) : '';

			const groupDeviceIds = new Set((g.devices ?? []).map((d) => d.id));
			allDevices = devices.filter((d) => !groupDeviceIds.has(d.id));
			addDeviceId = allDevices.length > 0 ? String(allDevices[0].id) : '';

			await loadEnabledPacks(id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function getReencryptedGroupKey(groupId: number, newRecipientPubKeys: string[]): Promise<string> {
		if (!group) throw new Error('Group not loaded');
		await initAgeWasm();
		const me = await api.me();
		const userPrivKey = await getStoredPrivateKey(me.id);
		if (!userPrivKey) {
			throw new Error('You do not have your private encryption key configured locally on this browser.');
		}
		if (!group.private_key) {
			throw new Error('Group E2EE keys not set up');
		}
		const groupPrivKey = decrypt(group.private_key, userPrivKey);
		if (newRecipientPubKeys.length === 0) {
			const myPub = await getStoredPublicKey(me.id);
			if (myPub) {
				return encrypt(groupPrivKey, [myPub]);
			}
			throw new Error('No recipients and no user public key available');
		}
		return encrypt(groupPrivKey, newRecipientPubKeys);
	}

	function startRename(): void {
		if (group) {
			editName = group.name;
			editingName = true;
		}
	}

	async function saveName(): Promise<void> {
		if (!group) return;
		try {
			await api.renameGroup(Number(group.id), editName);
			editingName = false;
			await loadGroup(group.id);
			showFlash('Group renamed');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function unlinkTeam(teamId: string | number): Promise<void> {
		if (!group) return;
		try {
			const remainingTeams = (group.teams ?? []).filter(t => t.id !== Number(teamId));
			const remainingPubs = new Set<string>();
			for (const t of remainingTeams) {
				const pubs = await api.getTeamRecipientPublicKeys(t.id);
				pubs.forEach(p => remainingPubs.add(p));
			}
			(group.devices ?? []).forEach(d => {
				if (d.encryption_public_key) remainingPubs.add(d.encryption_public_key);
			});
			const updatedKeys = Array.from(remainingPubs);
			let reencryptedKey = '';
			if (group.private_key) {
				reencryptedKey = await getReencryptedGroupKey(group.id, updatedKeys);
			}

			await api.unlinkGroupFromTeam(Number(group.id), Number(teamId), reencryptedKey);
			showFlash('Team unlinked from group');
			await loadGroup(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function linkTeam(): Promise<void> {
		if (!addTeamId || !group) return;
		try {
			const newPubs = await api.getTeamRecipientPublicKeys(Number(addTeamId));
			const currentPubKeys = await api.getGroupRecipientPublicKeys(group.id);
			newPubs.forEach(p => {
				if (!currentPubKeys.includes(p)) currentPubKeys.push(p);
			});
			let reencryptedKey = '';
			if (group.private_key) {
				reencryptedKey = await getReencryptedGroupKey(group.id, currentPubKeys);
			}

			await api.linkGroupToTeam(Number(addTeamId), Number(group.id), reencryptedKey);
			showFlash('Team linked');
			await loadGroup(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function removeDevice(deviceId: string | number): Promise<void> {
		if (!group) return;
		try {
			const d = group.devices.find(dev => dev.id === Number(deviceId));
			const currentPubKeys = await api.getGroupRecipientPublicKeys(group.id);
			const updatedPubKeys = d?.encryption_public_key 
				? currentPubKeys.filter(k => k !== d.encryption_public_key)
				: currentPubKeys;
			let reencryptedKey = '';
			if (group.private_key) {
				reencryptedKey = await getReencryptedGroupKey(group.id, updatedPubKeys);
			}

			await api.removeDeviceFromGroupViaGroup(Number(group.id), Number(deviceId), reencryptedKey);
			showFlash('Device removed from group');
			await loadGroup(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function addDevice(): Promise<void> {
		if (!addDeviceId || !group) return;
		try {
			const d = allDevices.find(dev => dev.id === Number(addDeviceId));
			if (!d) throw new Error('Device not found');
			const currentPubKeys = await api.getGroupRecipientPublicKeys(group.id);
			if (d.encryption_public_key && !currentPubKeys.includes(d.encryption_public_key)) {
				currentPubKeys.push(d.encryption_public_key);
			}
			let reencryptedKey = '';
			if (group.private_key) {
				reencryptedKey = await getReencryptedGroupKey(group.id, currentPubKeys);
			}

			await api.addDeviceToGroupViaGroup(Number(group.id), Number(addDeviceId), reencryptedKey);
			showFlash('Device added to group');
			await loadGroup(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function loadEnabledPacks(groupId: string | number): Promise<void> {
		try {
			const data = await api.listEnabledPacks(Number(groupId));
			enabledPacks = data;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function disablePack(enabledId: string | number): Promise<void> {
		if (!group) return;
		if (!await askConfirm('Disable this pack for the group?')) return;
		try {
			await api.disablePack(Number(group.id), Number(enabledId));
			showFlash('Pack disabled');
			await loadEnabledPacks(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function openEnablePack(): Promise<void> {
		try {
			const data = await api.listPacks();
			availablePacks = data;
			selectedPackId = availablePacks.length > 0 ? String(availablePacks[0].id) : '';
			packVersions = [];
			selectedVersionId = '';
			autoupdate = true;
			if (selectedPackId) {
				await loadVersionsForSelectedPack(Number(selectedPackId));
			}
			showEnablePackModal = true;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function handlePackChange(e: Event): Promise<void> {
		const target = e.target as HTMLSelectElement;
		const packId = Number(target.value);
		await loadVersionsForSelectedPack(packId);
	}

	async function loadVersionsForSelectedPack(packId: number): Promise<void> {
		try {
			const data = await api.listVersions(Number(packId));
			packVersions = data;
			selectedVersionId = packVersions.length > 0 ? String(packVersions[0].id) : '';
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function enablePack(): Promise<void> {
		if (!selectedVersionId || !group) {
			showError('Please select a version');
			return;
		}
		try {
			await api.enablePack(Number(group.id), Number(selectedVersionId), autoupdate);
			showEnablePackModal = false;
			showFlash('Pack enabled successfully');
			await loadEnabledPacks(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	// Exclusion Management Functions
	async function openCreateExclusion(exclusion: Exclusion | null = null): Promise<void> {
		editingExclusion = exclusion;
		if (exclusion) {
			exclusionName = exclusion.name;
			exclusionQuery = exclusion.jsonata_query;
			exclusionDescription = exclusion.description || '';
			exclusionType = (exclusion.exclusion_type as 'hard' | 'soft') || 'hard';
			exclusionEncrypted = exclusion.encrypted || false;
		} else {
			exclusionName = '';
			exclusionQuery = '';
			exclusionDescription = '';
			exclusionType = 'hard';
			exclusionEncrypted = false;
		}
		showExclusionModal = true;
	}

	async function saveExclusion(): Promise<void> {
		if (!group || !exclusionName.trim() || !exclusionQuery.trim()) {
			showError('Name and JSONata query are required');
			return;
		}
		try {
			const { name: finalName, jsonata_query: finalQuery, description: finalDesc } = await encryptExclusion(
				exclusionName.trim(),
				exclusionQuery.trim(),
				exclusionDescription.trim() || null,
				exclusionEncrypted,
				group.public_key
			);

			const data: ExclusionCreate = {
				name: finalName,
				jsonata_query: finalQuery,
				description: finalDesc,
				alert_id: editingExclusion ? editingExclusion.alert_id : null,
				exclusion_type: exclusionType,
				encrypted: exclusionEncrypted
			};
			
			if (editingExclusion) {
				await api.deleteExclusion(editingExclusion.id);
			}
			
			await api.createExclusion(Number(group.id), data);
			showExclusionModal = false;
			showFlash('Exclusion saved');
			await loadGroup(group.id);
			
			// Clear form
			exclusionName = '';
			exclusionQuery = '';
			exclusionDescription = '';
			exclusionType = 'hard';
			exclusionEncrypted = false;
			editingExclusion = null;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function deleteExclusionHandler(exclusionId: number, e: MouseEvent): Promise<void> {
		e.stopPropagation();
		if (!await askConfirm('Are you sure you want to delete this exclusion?')) return;
		try {
			await api.deleteExclusion(exclusionId);
			showFlash('Exclusion deleted');
			
			if (group) {
				await loadGroup(group.id);
			}
		} catch (e) {
			showError((e as Error).message);
		}
	}

	// Group actions
	async function deleteGroup(): Promise<void> {
		if (!group) return;
		if (!await askConfirm('Are you sure you want to delete this group? All exclusions and associated packs will be permanently deleted. This action is irreversible.')) return;
		try {
			await api.deleteGroup(group.id);
			showFlash('Group deleted successfully');
			await goto(`${base}/groups`);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	// Invitation Management
	async function handleInvite(): Promise<void> {
		if (!inviteEmail.trim() || !group || (group.teams ?? []).length === 0) return;
		try {
			const targetTeamId = group.teams[0].id;
			const newPubs = await api.getPublicKeysByEmail(inviteEmail.trim());
			
			// Re-encrypt group private key including the new user's public keys
			const currentPubKeys = await api.getGroupRecipientPublicKeys(group.id);
			newPubs.forEach(p => {
				if (!currentPubKeys.includes(p)) currentPubKeys.push(p);
			});
			
			let reencryptedKey = '';
			if (group.private_key) {
				reencryptedKey = await getReencryptedGroupKey(group.id, currentPubKeys);
			}
			
			const groupKeysMap: Record<number, string> = {};
			if (reencryptedKey) {
				groupKeysMap[group.id] = reencryptedKey;
			}
			
			await api.inviteToTeam(targetTeamId, inviteEmail.trim(), groupKeysMap);
			showFlash(`Invitation sent to ${inviteEmail}`);
			inviteEmail = '';
			await loadGroup(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function cancelInvitationHandler(teamId: number, userId: number): Promise<void> {
		if (!group) return;
		if (!await askConfirm('Cancel this invitation? The user will be removed from the team immediately.')) return;
		try {
			const updatedPubKeys = await api.getGroupRecipientPublicKeys(group.id, userId);
			
			let reencryptedKey = '';
			if (group.private_key) {
				reencryptedKey = await getReencryptedGroupKey(group.id, updatedPubKeys);
			}
			
			const groupKeysMap: Record<number, string> = {};
			if (reencryptedKey) {
				groupKeysMap[group.id] = reencryptedKey;
			}
			
			await api.cancelInvitation(teamId, userId, groupKeysMap);
			showFlash('Invitation cancelled');
			await loadGroup(group.id);
		} catch (e) {
			showError((e as Error).message);
		}
	}

</script>

<svelte:head>
	<title>{group?.name ?? 'Group'} - Radegast</title>
</svelte:head>

{#if group}
	<div class="mb-4">
		<a href="{base}/groups" class="btn btn-outline-secondary btn-sm mb-2">← Back to Groups</a>
		<div class="d-flex align-items-center justify-content-between gap-2 mt-1">
			<div class="d-flex align-items-center gap-2">
				{#if editingName}
					<input class="form-control form-control-lg w-auto" bind:value={editName} />
					<button class="btn btn-success btn-sm" onclick={saveName}>Save</button>
					<button class="btn btn-outline-secondary btn-sm" onclick={() => (editingName = false)}>Cancel</button>
				{:else}
					<h2 class="mb-0">{group.name}</h2>
					<button class="btn btn-outline-secondary btn-sm" onclick={startRename} title="Rename group">✎</button>
				{/if}
			</div>
			{#if hasAdminWrite}
				<button class="btn btn-danger btn-sm" onclick={deleteGroup}>Delete Group</button>
			{/if}
		</div>
	</div>

	{#if unsupportedDevices.length > 0}
		<div class="alert alert-warning border-0 mb-4" role="alert">
			<h5 class="alert-heading">Unsupported Agent Version Warning</h5>
			<p class="mb-0">
				The following devices in this group are running an agent with an unknown version or version lower than <strong>python 0.5.0</strong>.
				These devices do not support E2EE exclusions and will not be able to process them correctly:
			</p>
			<ul class="mb-0 mt-2">
				{#each unsupportedDevices as device}
					<li>
						<a href="{base}/devices/{device.id}">{device.name}</a>
						(version: <code>{device.agent_version || 'unknown'}</code>)
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Teams section -->
	<div class="card mb-4">
		<div class="card-header"><h5 class="mb-0">Teams</h5></div>
		<div class="card-body">
			{#if (group.teams ?? []).length === 0}
				<p class="text-muted">No teams linked to this group.</p>
			{:else}
				<table class="table table-sm mb-3">
					<thead>
						<tr>
							<th>Team</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each group.teams as team}
							{@const isLast = (group.teams ?? []).length <= 1}
							<tr>
								<td><a href="{base}/teams/{team.id}">{team.name}</a></td>
								<td>
									<span
										class="d-inline-block"
										title={isLast ? 'Cannot remove the last team from a group' : ''}
									>
										<button
											class="btn btn-sm btn-outline-danger"
											onclick={() => unlinkTeam(team.id)}
											disabled={isLast}
											style={isLast ? 'pointer-events:none' : ''}>Unlink</button>
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="d-flex gap-2 align-items-center">
				{#if allTeams.length > 0}
					<select class="form-select form-select-sm" bind:value={addTeamId}>
						{#each allTeams as t}
							<option value={String(t.id)}>{t.name}</option>
						{/each}
					</select>
					<button class="btn btn-sm btn-primary" onclick={linkTeam}>Link Team</button>
				{:else}
					<span class="text-muted small">All your teams are already linked to this group.</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Devices section -->
	<div class="card mb-4">
		<div class="card-header"><h5 class="mb-0">Devices</h5></div>
		<div class="card-body">
			{#if (group.devices ?? []).length === 0}
				<p class="text-muted">No devices in this group.</p>
			{:else}
				<table class="table table-sm mb-3">
					<thead>
						<tr>
							<th>Device</th>
							<th>Status</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each group.devices as device}
							<tr>
								<td><a href="{base}/devices/{device.id}">{device.name}</a></td>
								<td>
									{#if isDeviceActive(device.last_seen)}
										<span class="badge bg-success">Online</span>
									{:else}
										<span class="badge bg-secondary">Offline</span>
									{/if}
								</td>
								<td>
									<button
										class="btn btn-sm btn-outline-danger"
										onclick={() => removeDevice(device.id)}>Remove</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="d-flex gap-2 align-items-center">
				{#if allDevices.length > 0}
					<select class="form-select form-select-sm" bind:value={addDeviceId}>
						{#each allDevices as d}
							<option value={String(d.id)}>{d.name}</option>
						{/each}
					</select>
					<button class="btn btn-sm btn-primary" onclick={addDevice}>Add Device</button>
				{:else}
					<span class="text-muted small">All your devices are already in this group.</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Members & Pending Invitations section -->
	<div class="card mb-4">
		<div class="card-header"><h5 class="mb-0">Members & Pending Invitations</h5></div>
		<div class="card-body">
			<!-- Members Table -->
			<h6 class="card-subtitle mb-2 text-muted">Active Members</h6>
			{#if groupMembers.length === 0}
				<p class="text-muted small">No active members.</p>
			{:else}
				<table class="table table-sm mb-3 align-middle">
					<thead>
						<tr>
							<th>Email</th>
							<th>Role</th>
						</tr>
					</thead>
					<tbody>
						{#each groupMembers as m}
							<tr>
								<td>{m.email}</td>
								<td><span class="badge bg-secondary">{m.role}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<!-- Pending Invitations Table -->
			<h6 class="card-subtitle mb-2 text-muted mt-4">Pending Invitations</h6>
			{#if !group.invitations || group.invitations.length === 0}
				<p class="text-muted small">No pending invitations.</p>
			{:else}
				<table class="table table-sm mb-3 align-middle">
					<thead>
						<tr>
							<th>Email</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each group.invitations as inv}
							<tr>
								<td>{inv.email}</td>
								<td>
									<button
										class="btn btn-sm btn-outline-danger"
										onclick={() => cancelInvitationHandler(inv.team_id, inv.user_id)}
									>
										Cancel Invitation
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<!-- Invite form -->
			{#if (group.teams ?? []).length > 0}
				<hr />
				<form onsubmit={(e) => { e.preventDefault(); handleInvite(); }} class="d-flex gap-2 align-items-center mt-3">
					<input
						type="email"
						class="form-control form-control-sm"
						placeholder="user@example.com"
						bind:value={inviteEmail}
						required
					/>
					<button type="submit" class="btn btn-sm btn-primary text-nowrap">Invite User</button>
				</form>
			{/if}
		</div>
	</div>

	<!-- Exclusions section -->
	<div class="card mb-4">
		<div class="card-header d-flex justify-content-between align-items-center">
			<h5 class="mb-0">Detection Exclusions</h5>
			{#if hasPackWrite}
				<button class="btn btn-sm btn-primary" onclick={() => openCreateExclusion(null)}>Create Exclusion</button>
			{/if}
		</div>
		<div class="card-body">
			{#if (group.exclusions ?? []).length === 0}
				<p class="text-muted">No exclusions configured for this group. Exclusions use JSONata queries to filter out false positives from alerts.</p>
			{:else}
				<table class="table table-sm mb-3">
					<thead>
						<tr>
							<th>Name</th>
							<th>Type</th>
							<th>JSONata Query</th>
							<th>Description</th>
							<th>Source Alert</th>
							{#if hasPackWrite}
								<th></th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each group.exclusions as exclusion}
							<tr>
								<td>
									<strong>{exclusion.name}</strong>
									{#if !exclusion.encrypted}
										<span class="badge bg-secondary-subtle text-secondary-emphasis ms-1" style="font-size: 0.75rem;"><Icon icon="lucide:unlock" class="me-1" style="vertical-align: text-bottom;" />Unencrypted</span>
									{/if}
								</td>
								<td>
									{#if exclusion.exclusion_type === 'soft'}
										<span class="badge bg-info text-dark">Soft</span>
									{:else}
										<span class="badge bg-secondary">Hard</span>
									{/if}
								</td>
								<td><code class="small">{exclusion.jsonata_query}</code></td>
								<td>{exclusion.description || '-'}</td>
								<td>
									{#if exclusion.alert_id}
										<a href="{base}/alert/{exclusion.alert_id}" class="badge bg-secondary text-decoration-none">Alert #{exclusion.alert_id}</a>
									{:else}
										-
									{/if}
								</td>
								{#if hasPackWrite}
									<td>
										<button class="btn btn-sm btn-outline-secondary me-2" onclick={() => openCreateExclusion(exclusion)} title="Edit">✎</button>
										<button class="btn btn-sm btn-outline-danger" onclick={(e) => deleteExclusionHandler(exclusion.id, e)} title="Delete">×</button>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if hasPackWrite}
				<p class="text-muted small mb-0">
					Exclusions are JSONata queries that match against alert data. 
					When an alert matches any exclusion in its device group, it will be excluded from detection.
				</p>
			{/if}
		</div>
	</div>

	<!-- Packs section -->
	<div class="card mb-4">
		<div class="card-header d-flex justify-content-between align-items-center">
			<h5 class="mb-0">Enabled Packs</h5>
			{#if hasPackWrite}
				<button class="btn btn-sm btn-primary" onclick={openEnablePack}>Enable Pack</button>
			{/if}
		</div>
		<div class="card-body">
			{#if enabledPacks.length === 0}
				<p class="text-muted">No packs enabled for this group.</p>
			{:else}
				<table class="table table-sm mb-0 align-middle">
					<thead>
						<tr>
							<th>Pack Name</th>
							<th>Version</th>
							<th>Autoupdate</th>
							{#if hasPackWrite}
								<th></th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each enabledPacks as pe}
							<tr>
								<td class="fw-bold">{pe.pack_name}</td>
								<td><span class="badge bg-success">{pe.version}</span></td>
								<td>
									{#if pe.autoupdate}
										<span class="text-success">✓ Yes</span>
									{:else}
										<span class="text-muted">✗ No</span>
									{/if}
								</td>
								{#if hasPackWrite}
									<td>
										<button
											class="btn btn-sm btn-outline-danger"
											onclick={() => disablePack(pe.id)}>Disable</button>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>

	<!-- Create/Edit Exclusion Modal -->
	<ExclusionModal
		bind:show={showExclusionModal}
		bind:name={exclusionName}
		bind:query={exclusionQuery}
		bind:description={exclusionDescription}
		bind:exclusionType={exclusionType}
		bind:encrypted={exclusionEncrypted}
		selectedGroupId={group.id}
		title={editingExclusion ? 'Edit Exclusion' : 'Create Exclusion'}
		isEditMode={!!editingExclusion}
		onClose={() => { showExclusionModal = false; editingExclusion = null; }}
		onSave={saveExclusion}
	/>

	<!-- Enable Pack Modal -->
	<Modal show={showEnablePackModal} title="Enable Pack for Group" onClose={() => (showEnablePackModal = false)}>
		<form onsubmit={(e) => { e.preventDefault(); enablePack(); }}>
			<div class="mb-3">
				<label for="selectPack" class="form-label">Select Pack</label>
				<select class="form-select" id="selectPack" bind:value={selectedPackId} onchange={handlePackChange} required>
					{#each availablePacks as p}
						<option value={String(p.id)}>{p.name}</option>
					{/each}
				</select>
			</div>
			<div class="mb-3">
				<label for="selectVersion" class="form-label">Select Version</label>
				{#if packVersions.length === 0}
					<p class="text-danger small">No versions available for this pack. Upload a version first.</p>
				{:else}
					<select class="form-select" id="selectVersion" bind:value={selectedVersionId} required>
						{#each packVersions as v}
							<option value={String(v.id)}>{v.version}</option>
						{/each}
					</select>
				{/if}
			</div>
			<div class="form-check mb-3">
				<input class="form-check-input" type="checkbox" id="autoupdate" bind:checked={autoupdate} />
				<label class="form-check-label" for="autoupdate">
					Automatically update to newer versions
				</label>
			</div>
			<button type="submit" class="btn btn-primary" disabled={packVersions.length === 0}>Enable Pack</button>
		</form>
	</Modal>
{:else}
	<Spinner centered text="Loading group details..." py={5} />
{/if}
