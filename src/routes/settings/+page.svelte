<script>
	import { onMount } from 'svelte';
	import { api } from '$lib/api.js';
	import { showFlash, showError } from '$lib/store.js';

	// Password change
	let oldPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let pwSaving = $state(false);

	// Notification prefs
	/** @type {{notify_login: boolean, notify_new_keys: boolean, notify_recovery_used: boolean, notify_keys_transferred: boolean, notify_device_log: boolean}|null} */
	let notifications = $state(null);
	let notifSaving = $state(false);

	onMount(async () => {
		try {
			notifications = await api.getNotifications();
		} catch (e) {
			showError('Failed to load notification settings: ' + e.message);
		}
	});

	async function changePassword() {
		if (newPassword !== confirmPassword) {
			showError('New passwords do not match.');
			return;
		}
		if (newPassword.length < 8) {
			showError('New password must be at least 8 characters.');
			return;
		}
		pwSaving = true;
		try {
			await api.changePassword(oldPassword, newPassword);
			showFlash('Password changed successfully.');
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (e) {
			showError(e.message);
		} finally {
			pwSaving = false;
		}
	}

	async function saveNotifications() {
		if (!notifications) return;
		notifSaving = true;
		try {
			notifications = await api.updateNotifications(notifications);
			showFlash('Notification preferences saved.');
		} catch (e) {
			showError(e.message);
		} finally {
			notifSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - Radegast</title>
</svelte:head>

<h2 class="mb-4">User Settings</h2>

<div class="row g-4">
	<!-- Change Password -->
	<div class="col-md-6">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Change Password</h5></div>
			<div class="card-body">
				<form onsubmit={(e) => { e.preventDefault(); changePassword(); }}>
					<div class="mb-3">
						<label for="oldPassword" class="form-label">Current Password</label>
						<input
							type="password"
							class="form-control"
							id="oldPassword"
							bind:value={oldPassword}
							required
						/>
					</div>
					<div class="mb-3">
						<label for="newPassword" class="form-label">New Password</label>
						<input
							type="password"
							class="form-control"
							id="newPassword"
							bind:value={newPassword}
							minlength="8"
							required
						/>
					</div>
					<div class="mb-3">
						<label for="confirmPassword" class="form-label">Confirm New Password</label>
						<input
							type="password"
							class="form-control"
							id="confirmPassword"
							bind:value={confirmPassword}
							required
						/>
					</div>
					<button type="submit" class="btn btn-primary" disabled={pwSaving}>
						{pwSaving ? 'Saving…' : 'Change Password'}
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- Email Notifications -->
	<div class="col-md-6">
		<div class="card">
			<div class="card-header"><h5 class="mb-0">Email Notifications</h5></div>
			<div class="card-body">
				{#if !notifications}
					<div class="text-muted">Loading…</div>
				{:else}
					<p class="text-muted small mb-3">Choose which events trigger email notifications.</p>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyLogin"
							bind:checked={notifications.notify_login}
						/>
						<label class="form-check-label" for="notifyLogin">New login alert</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyNewKeys"
							bind:checked={notifications.notify_new_keys}
						/>
						<label class="form-check-label" for="notifyNewKeys">New keys added</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyRecovery"
							bind:checked={notifications.notify_recovery_used}
						/>
						<label class="form-check-label" for="notifyRecovery">Recovery key used</label>
					</div>
					<div class="form-check form-switch mb-2">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyTransfer"
							bind:checked={notifications.notify_keys_transferred}
						/>
						<label class="form-check-label" for="notifyTransfer">Keys transferred to another device</label>
					</div>
					<div class="form-check form-switch mb-3">
						<input
							class="form-check-input"
							type="checkbox"
							id="notifyDeviceLog"
							bind:checked={notifications.notify_device_log}
						/>
						<label class="form-check-label" for="notifyDeviceLog">New device log entry</label>
					</div>
					<button class="btn btn-primary" onclick={saveNotifications} disabled={notifSaving}>
						{notifSaving ? 'Saving…' : 'Save Preferences'}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
