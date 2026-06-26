<script lang="ts">
	import { askConfirm } from '$lib/confirm';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, type Team, type TeamMember, type Group, type Device } from '$lib/api';
	import { showFlash, showError, triggerKeyRefresh } from '$lib/store';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { initAgeWasm, decrypt, encrypt, getStoredPrivateKey } from '$lib/crypto';

	let team = $state<Team | null>(null);
	let members = $state<TeamMember[]>([]);
	let groups = $state<Group[]>([]);
	let teamDevices = $state<Device[]>([]);
	let allTeams = $state<Team[]>([]);
	let showInvite = $state(false);
	let inviteEmail = $state('');
	let showCreateGroup = $state(false);
	let newGroupName = $state('');

	// inline rename
	let editingName = $state(false);
	let editName = $state('');

	let teamId = $derived(Number(page.params.id ?? '0'));
	let eligibleTeams = $derived(team ? allTeams.filter((t) => t.id !== team?.id) : []);

	onMount(async () => {
		await loadTeam();
	});

	async function loadTeam(): Promise<void> {
		try {
			const [teamRes, membersRes, groupsRes, teamDevicesRes, allTeamsRes] = await Promise.all([
				api.getTeam(teamId),
				api.listMembers(teamId),
				api.listTeamGroups(teamId),
				api.listTeamDevices(teamId),
				api.listTeams()
			]);
			team = teamRes;
			members = membersRes;
			groups = groupsRes;
			teamDevices = teamDevicesRes;
			allTeams = allTeamsRes;
		} catch (e) {
			showError((e as Error).message);
		}
	}

	function startRename(): void {
		if (team) {
			editName = team.name;
			editingName = true;
		}
	}

	async function saveName(): Promise<void> {
		try {
			await api.updateTeam(teamId, { name: editName });
			editingName = false;
			await loadTeam();
			showFlash('Team renamed');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function invite(): Promise<void> {
		try {
			const newPubs = await api.getPublicKeysByEmail(inviteEmail.trim());
			const groupKeysMap: Record<number, string> = {};
			await initAgeWasm();
			const me = await api.me();
			const userPrivKey = await getStoredPrivateKey(me.id);

			for (const g of groups) {
				const fullGroup = await api.getGroup(g.id);
				if (fullGroup.private_key && userPrivKey) {
					const currentPubKeys = await api.getGroupRecipientPublicKeys(g.id);
					newPubs.forEach(p => {
						if (!currentPubKeys.includes(p)) currentPubKeys.push(p);
					});
					const groupPrivKey = decrypt(fullGroup.private_key, userPrivKey);
					groupKeysMap[g.id] = encrypt(groupPrivKey, currentPubKeys);
				}
			}

			await api.inviteToTeam(teamId, inviteEmail.trim(), groupKeysMap);
			triggerKeyRefresh.update(n => n + 1);
			showInvite = false;
			inviteEmail = '';
			showFlash('Invitation sent');
			await loadTeam();
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function removeMember(userId: string | number): Promise<void> {
		if (!await askConfirm('Remove this member?')) return;
		try {
			const groupKeysMap: Record<number, string> = {};
			await initAgeWasm();
			const me = await api.me();
			const userPrivKey = await getStoredPrivateKey(me.id);

			for (const g of groups) {
				const fullGroup = await api.getGroup(g.id);
				if (fullGroup.private_key && userPrivKey) {
					const updatedPubKeys = await api.getGroupRecipientPublicKeys(g.id, Number(userId));
					const groupPrivKey = decrypt(fullGroup.private_key, userPrivKey);
					groupKeysMap[g.id] = encrypt(groupPrivKey, updatedPubKeys);
				}
			}

			await api.removeMember(teamId, Number(userId), groupKeysMap);
			triggerKeyRefresh.update(n => n + 1);
			await loadTeam();
			showFlash('Member removed');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function createGroup(): Promise<void> {
		try {
			await api.createTeamGroup(teamId, newGroupName);
			showCreateGroup = false;
			newGroupName = '';
			await loadTeam();
			showFlash('Group created');
		} catch (e) {
			showError((e as Error).message);
		}
	}

	async function updatePermission(field: string, value: string | number | null): Promise<void> {
		try {
			await api.updateTeam(teamId, { [field]: value || null });
			await loadTeam();
			showFlash('Permissions updated successfully');
		} catch (e) {
			showError((e as Error).message);
		}
	}
</script>

{#if team}
	<div class="d-flex align-items-center gap-2 mb-4">
		{#if editingName}
			<input class="form-control form-control-lg w-auto" bind:value={editName} />
			<button class="btn btn-success btn-sm" onclick={saveName}>Save</button>
			<button class="btn btn-outline-secondary btn-sm" onclick={() => (editingName = false)}>Cancel</button>
		{:else}
			<h2 class="mb-0">{team.name}</h2>
			<button class="btn btn-outline-secondary btn-sm" onclick={startRename} title="Rename team">✎</button>
		{/if}
	</div>

	<div class="row mt-2">
		<div class="col-md-6">
			<div class="card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<span>Members</span>
					<button class="btn btn-sm btn-outline-primary" onclick={() => (showInvite = true)}>Invite</button>
				</div>
				<ul class="list-group list-group-flush">
					{#each members as member}
						<li class="list-group-item d-flex justify-content-between align-items-center">
							<span>{member.email} <small class="text-muted">({member.role})</small></span>
							<span
								class="d-inline-block"
								title={members.length <= 1 ? 'Cannot remove the last member' : ''}
							>
								<button
									class="btn btn-sm btn-outline-danger"
									onclick={() => removeMember(member.id)}
									disabled={members.length <= 1}
									style={members.length <= 1 ? 'pointer-events:none' : ''}>Remove</button
								>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="col-md-6">
			<div class="card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<span>Device Groups</span>
					<button class="btn btn-sm btn-outline-primary" onclick={() => (showCreateGroup = true)}>New Group</button>
				</div>
				<ul class="list-group list-group-flush">
					{#each groups as group}
						<li class="list-group-item">
							<a href="{base}/groups/{group.id}">{group.name}</a>
						</li>
					{:else}
						<li class="list-group-item text-muted">No groups</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<!-- All devices in this team -->
	<div class="card mt-4">
		<div class="card-header d-flex justify-content-between align-items-center">
			<span>All Devices ({teamDevices.length})</span>
		</div>
		{#if teamDevices.length === 0}
			<div class="card-body text-muted">No devices in any group of this team.</div>
		{:else}
			<table class="table table-sm mb-0">
				<thead>
					<tr>
						<th>Device</th>
					</tr>
				</thead>
				<tbody>
					{#each teamDevices as d}
						<tr>
							<td>
								<a href="{base}/devices/{d.id}">{d.name}</a>
								{#if !d.signature_public_key}
									<span class="badge bg-danger ms-2" title="Unsigned device! Signing key is not set.">Unsigned</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="card mt-4">
		<div class="card-header">Permissions & Management</div>
		<div class="card-body">
			<div class="row g-3">
				<div class="col-md-2">
					<label for="team-perm-pack" class="form-label">Pack</label>
					<select
						id="team-perm-pack"
						class="form-select"
						value={team.permission_pack || ''}
						onchange={(e) => {
							const target = e.target as HTMLSelectElement;
							updatePermission('permission_pack', target.value);
						}}
					>
						<option value="">None</option>
						<option value="read">Read</option>
						<option value="write">Write</option>
					</select>
				</div>
				<div class="col-md-2">
					<label for="team-perm-invite" class="form-label">Invite</label>
					<select
						id="team-perm-invite"
						class="form-select"
						value={team.permission_invite || ''}
						onchange={(e) => {
							const target = e.target as HTMLSelectElement;
							updatePermission('permission_invite', target.value);
						}}
					>
						<option value="">None</option>
						<option value="write">Write</option>
					</select>
				</div>
				<div class="col-md-2">
					<label for="team-perm-admin" class="form-label">Admin</label>
					<select
						id="team-perm-admin"
						class="form-select"
						value={team.permission_admin || ''}
						onchange={(e) => {
							const target = e.target as HTMLSelectElement;
							updatePermission('permission_admin', target.value);
						}}
					>
						<option value="">None</option>
						<option value="write">Write</option>
					</select>
				</div>
				<div class="col-md-2">
					<label for="team-perm-logs" class="form-label">Logs</label>
					<select
						id="team-perm-logs"
						class="form-select"
						value={team.permission_logs || ''}
						onchange={(e) => {
							const target = e.target as HTMLSelectElement;
							updatePermission('permission_logs', target.value);
						}}
					>
						<option value="">None</option>
						<option value="read">Read</option>
					</select>
				</div>
				<div class="col-md-4">
					<label for="team-managing-team" class="form-label">Managing Team</label>
					<select
						id="team-managing-team"
						class="form-select"
						value={team.managing_team_id || ''}
						onchange={(e) => {
							const target = e.target as HTMLSelectElement;
							updatePermission('managing_team_id', target.value ? Number(target.value) : null);
						}}
					>
						<option value="">None (Self-managed)</option>
						{#each eligibleTeams as t}
							<option value={t.id}>{t.name}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
	</div>
{:else}
	<Spinner centered text="Loading team details..." py={5} />
{/if}

<Modal show={showInvite} title="Invite User" onClose={() => (showInvite = false)}>
	<form onsubmit={(e) => { e.preventDefault(); invite(); }}>
		<div class="mb-3">
			<label for="inviteEmail" class="form-label">Email</label>
			<input
				type="email"
				class="form-control"
				id="inviteEmail"
				bind:value={inviteEmail}
				required
			/>
		</div>
		<button type="submit" class="btn btn-primary">Send Invitation</button>
	</form>
</Modal>

<Modal show={showCreateGroup} title="Create Device Group" onClose={() => (showCreateGroup = false)}>
	<form onsubmit={(e) => { e.preventDefault(); createGroup(); }}>
		<div class="mb-3">
			<label for="groupName" class="form-label">Group Name</label>
			<input
				type="text"
				class="form-control"
				id="groupName"
				bind:value={newGroupName}
				required
			/>
		</div>
		<button type="submit" class="btn btn-primary">Create</button>
	</form>
</Modal>
