<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { api, type AccountDeletionConfirm } from '$lib/api';
	import Spinner from '$lib/components/Spinner.svelte';
	import AlertTriangleIcon from '~icons/lucide/alert-triangle';
	import CheckCircleIcon from '~icons/lucide/check-circle';
	import XCircleIcon from '~icons/lucide/x-circle';

	let status = $state<'prompt' | 'confirming' | 'success' | 'error'>('prompt');
	let errorMessage = $state('');
	let result = $state<AccountDeletionConfirm | null>(null);

	const token = $page.url.searchParams.get('token');

	if (!token) {
		status = 'error';
		errorMessage = 'No deletion confirmation token found in the link. Please check your email and try again.';
	}

	async function handleConfirm(): Promise<void> {
		if (!token) return;
		status = 'confirming';
		try {
			result = await api.confirmAccountDeletion(token);
			status = 'success';
		} catch (e) {
			status = 'error';
			errorMessage = (e as Error).message || 'The confirmation link is invalid or has expired.';
		}
	}
</script>

<svelte:head>
	<title>Confirm Account Deletion — Radegast EDR</title>
</svelte:head>

<div class="row justify-content-center mt-5">
	<div class="col-md-8 col-lg-6">
		{#if status === 'prompt'}
			<div class="card border-danger shadow-sm">
				<div class="card-header bg-danger bg-opacity-10 py-3">
					<h5 class="mb-0 text-danger d-flex align-items-center gap-2">
						<AlertTriangleIcon style="width: 20px; height: 20px;" />
						Confirm Account Deletion
					</h5>
				</div>
				<div class="card-body p-4">
					<p class="text-body mb-3">
						You are about to schedule your Radegast EDR account for permanent deletion.
					</p>
					<div class="alert alert-warning small mb-4">
						<strong>Important:</strong> After confirmation, your account enters a grace period before permanent deletion.
						If you change your mind, <strong>logging in at any time during the grace period will automatically cancel the deletion</strong>.
					</div>
					<p class="text-body-secondary small mb-4">
						Do you want to proceed with scheduling your account for deletion?
					</p>
					<div class="d-flex justify-content-end gap-2">
						<a href="{base}/login" class="btn btn-outline-secondary px-4 fw-semibold">
							No, Keep Account
						</a>
						<button class="btn btn-danger px-4 fw-semibold" onclick={handleConfirm}>
							Yes, Confirm Deletion
						</button>
					</div>
				</div>
			</div>

		{:else if status === 'confirming'}
			<div class="text-center py-5">
				<Spinner centered size="lg" color="danger" text="Scheduling account deletion…" py={3} />
			</div>

		{:else if status === 'success'}
			<div class="card border-warning shadow-sm text-center">
				<div class="card-body p-5">
					<div class="text-warning mb-3">
						<CheckCircleIcon style="width: 56px; height: 56px;" />
					</div>
					<h3 class="fw-bold mb-3 text-body">Account Deletion Scheduled</h3>
					{#if result}
						<p class="text-body mb-2">
							Your account has been scheduled for permanent deletion on:
						</p>
						<p class="fs-5 fw-semibold font-monospace text-danger mb-4">
							{new Date(result.deletion_scheduled_at).toUTCString()}
						</p>
						<div class="alert alert-info small text-start mb-4">
							<strong>Grace period: {result.grace_days} days</strong><br />
							If you wish to cancel this deletion, simply log back in to your account before the scheduled deletion date.
						</div>
					{/if}
					<a href="{base}/login" class="btn btn-primary px-5 fw-semibold">
						Back to Login
					</a>
				</div>
			</div>

		{:else}
			<div class="card border-danger shadow-sm text-center">
				<div class="card-body p-5">
					<div class="text-danger mb-3">
						<XCircleIcon style="width: 56px; height: 56px;" />
					</div>
					<h3 class="fw-bold mb-2 text-body">Confirmation Failed</h3>
					<p class="text-body-secondary mb-4">{errorMessage}</p>
					<a href="{base}/login" class="btn btn-outline-secondary px-5 fw-semibold">
						Back to Login
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
