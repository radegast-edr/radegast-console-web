<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';
	import Modal from '$lib/components/Modal.svelte';

	let team = $state(null);
	let members = $state([]);
	let groups = $state([]);
	let showInvite = $state(false);
	let inviteEmail = $state('');
	let showCreateGroup = $state(false);
	let newGroupName = $state('');

	let teamId = $derived(page.params.id);

	onMount(async () => {
		await loadTeam();
	});

	async function loadTeam() {
		try {
			team = await api.getTeam(teamId);
			members = await api.listMembers(teamId);
			groups = await api.listTeamGroups(teamId);
		} catch (e) {
			showError(e.message);
		}
	}

	async function invite() {
		try {
			await api.inviteToTeam(teamId, inviteEmail);
			showInvite = false;
			inviteEmail = '';
			showFlash('Invitation sent');
		} catch (e) {
			showError(e.message);
		}
	}

	async function removeMember(userId) {
		if (!confirm('Remove this member?')) return;
		try {
			await api.removeMember(teamId, userId);
			await loadTeam();
			showFlash('Member removed');
		} catch (e) {
			showError(e.message);
		}
	}

	async function createGroup() {
		try {
			await api.createTeamGroup(teamId, newGroupName);
			showCreateGroup = false;
			newGroupName = '';
			await loadTeam();
			showFlash('Group created');
		} catch (e) {
			showError(e.message);
		}
	}

	async function updatePermission(field, value) {
		try {
			await api.updateTeam(teamId, { [field]: value || null });
			await loadTeam();
		} catch (e) {
			showError(e.message);
		}
	}
</script>

{#if team}
	<h2>{team.name}</h2>

	<div class="row mt-4">
		<div class="col-md-6">
			<div class="card">
				<div class="card-header d-flex justify-content-between">
					<span>Members</span>
					<button class="btn btn-sm btn-outline-primary" onclick={() => (showInvite = true)}
						>Invite</button
					>
				</div>
				<ul class="list-group list-group-flush">
					{#each members as member}
						<li class="list-group-item d-flex justify-content-between align-items-center">
							<span>{member.email} <small class="text-muted">({member.role})</small></span>
							<button
								class="btn btn-sm btn-outline-danger"
								onclick={() => removeMember(member.id)}
								disabled={members.length <= 1}>Remove</button
							>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="col-md-6">
			<div class="card">
				<div class="card-header d-flex justify-content-between">
					<span>Device Groups</span>
					<button
						class="btn btn-sm btn-outline-primary"
						onclick={() => (showCreateGroup = true)}>New Group</button
					>
				</div>
				<ul class="list-group list-group-flush">
					{#each groups as group}
						<li class="list-group-item">{group.name}</li>
					{:else}
						<li class="list-group-item text-muted">No groups</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<div class="card mt-4">
		<div class="card-header">Permissions</div>
		<div class="card-body">
			<div class="row g-3">
				<div class="col-md-3">
					<label class="form-label">Pack</label>
					<select
						class="form-select"
						value={team.permission_pack || ''}
						onchange={(e) => updatePermission('permission_pack', e.target.value)}
					>
						<option value="">None</option>
						<option value="read">Read</option>
						<option value="write">Write</option>
					</select>
				</div>
				<div class="col-md-3">
					<label class="form-label">Invite</label>
					<select
						class="form-select"
						value={team.permission_invite || ''}
						onchange={(e) => updatePermission('permission_invite', e.target.value)}
					>
						<option value="">None</option>
						<option value="write">Write</option>
					</select>
				</div>
				<div class="col-md-3">
					<label class="form-label">Admin</label>
					<select
						class="form-select"
						value={team.permission_admin || ''}
						onchange={(e) => updatePermission('permission_admin', e.target.value)}
					>
						<option value="">None</option>
						<option value="write">Write</option>
					</select>
				</div>
				<div class="col-md-3">
					<label class="form-label">Logs</label>
					<select
						class="form-select"
						value={team.permission_logs || ''}
						onchange={(e) => updatePermission('permission_logs', e.target.value)}
					>
						<option value="">None</option>
						<option value="read">Read</option>
					</select>
				</div>
			</div>
		</div>
	</div>
{:else}
	<p>Loading...</p>
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
