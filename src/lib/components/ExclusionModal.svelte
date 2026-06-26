<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '@iconify/svelte';
	import jsonata from 'jsonata';
	import { api, type Group, type Device } from '$lib/api';
	import { user } from '$lib/store';

	let {
		show = $bindable(false),
		title = 'Create Exclusion',
		name = $bindable(''),
		query = $bindable(''),
		description = $bindable(''),
		exclusionType = $bindable<'hard' | 'soft'>('hard'),
		encrypted = $bindable(false),
		selectedGroupId = $bindable<number | null>(null),
		groups = [],
		alertObj = null,
		isEditMode = false,
		onClose,
		onSave
	}: {
		show: boolean;
		title?: string;
		name: string;
		query: string;
		description: string;
		exclusionType?: 'hard' | 'soft';
		encrypted?: boolean;
		selectedGroupId?: number | null;
		groups?: Group[];
		alertObj?: Record<string, unknown> | null;
		isEditMode?: boolean;
		onClose: () => void;
		onSave: () => Promise<void> | void;
	} = $props();

	let queryIsValid = $derived.by(() => {
		if (!query.trim()) return true;
		try {
			jsonata(query);
			return true;
		} catch {
			return false;
		}
	});

	// Async alert match state — updated reactively via $effect
	let queryMatchesAlert = $state<boolean | null>(null);

	$effect(() => {
		if (!query.trim() || !alertObj || !queryIsValid) {
			queryMatchesAlert = null;
			return;
		}

		let cancelled = false;
		// Svelte 5 reactive state is wrapped in a Proxy — snapshot to a plain object before passing to jsonata
		const plainAlertObj = $state.snapshot(alertObj);
		console.info('Evaluating JSONata query against alert:', { query, alert: plainAlertObj });
		jsonata(query)
			.evaluate(plainAlertObj)
			.then((result) => {
				console.info('JSONata evaluation result:', result);
				if (!cancelled) queryMatchesAlert = !!result;
			})
			.catch(() => {
				if (!cancelled) queryMatchesAlert = false;
			});

		return () => {
			cancelled = true;
		};
	});

	const canSubmit = $derived(
		!!name.trim() && !!query.trim() && queryIsValid && (groups.length === 0 || !!selectedGroupId)
	);

	let targetGroupDevices = $state<Device[]>([]);
	let loadingDevices = $state(false);

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

	let unsupportedDevices = $derived.by(() => {
		return targetGroupDevices.filter(d => isAgentVersionUnsupported(d.agent_version));
	});

	let isE2EESupported = $derived.by(() => {
		return unsupportedDevices.length === 0;
	});

	$effect(() => {
		if (show && selectedGroupId) {
			loadingDevices = true;
			api.getGroup(selectedGroupId)
				.then((groupDetail) => {
					targetGroupDevices = groupDetail.devices ?? [];
				})
				.catch((err) => {
					console.error('Failed to load group devices:', err);
					targetGroupDevices = [];
				})
				.finally(() => {
					loadingDevices = false;
				});
		} else {
			targetGroupDevices = [];
			loadingDevices = false;
		}
	});

	$effect(() => {
		if (!isEditMode) {
			if (selectedGroupId && !loadingDevices) {
				encrypted = isE2EESupported;
			} else {
				encrypted = false;
			}
		}
	});
</script>

<Modal {show} {title} {onClose}>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onSave();
		}}
	>
		<div class="mb-3">
			<label for="exclusionName" class="form-label">Name</label>
			<input
				type="text"
				class="form-control"
				id="exclusionName"
				bind:value={name}
				required
			/>
		</div>

		{#if groups.length > 0}
			<div class="mb-3">
				<label for="groupSelect" class="form-label">Device Group</label>
				<select class="form-select" id="groupSelect" bind:value={selectedGroupId} required>
					<option value={null}>Select a group...</option>
					{#each groups as group}
						<option value={group.id}>{group.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="mb-3">
			<label for="exclusionQuery" class="form-label">JSONata Query</label>
			<textarea
				class="form-control font-monospace mb-1 {!queryIsValid && query.trim() ? 'is-invalid' : ''}"
				id="exclusionQuery"
				rows={3}
				bind:value={query}
				placeholder="e.g., `rule.name`='Test Rule'"
				required
			></textarea>
			{#if !queryIsValid && query.trim()}
				<div class="invalid-feedback">Invalid JSONata syntax</div>
			{/if}
			{#if alertObj !== null}
				{#if queryMatchesAlert === true}
					<div class="alert alert-success mt-2 mb-0 p-2 small d-flex align-items-center gap-1">
						<Icon icon="lucide:check" /> This query matches the current alert
					</div>
				{:else if queryMatchesAlert === false && query.trim()}
					<div class="alert alert-warning mt-2 mb-0 p-2 small d-flex align-items-center gap-1">
						<Icon icon="lucide:alert-triangle" /> This query does NOT match the current alert
					</div>
				{/if}
			{/if}
			<small class="form-text text-muted">
				<a href="https://docs.jsonata.org/overview.html" target="_blank" title="JSONata documentation">JSONata</a>
				expression matched against alert data. Example:
				<code>`rule.name`='Test Rule'</code>
			</small>
		</div>

		{#if $user?.extended_edr_enabled}
			<div class="mb-3">
				<label for="exclusionTypeSelect" class="form-label">Exclusion Type</label>
				<select class="form-select" id="exclusionTypeSelect" bind:value={exclusionType}>
					<option value="hard">Hard Exclusion</option>
					<option value="soft">Soft Exclusion</option>
				</select>
				<div class="form-text mt-1 small text-body-secondary">
					{#if exclusionType === 'hard'}
						Alert is completely filtered out on the agent and never sent to console.
					{:else if exclusionType === 'soft'}
						Alert is still sent, but overridden to informational severity.
					{/if}
				</div>
			</div>
		{/if}

		{#if !isEditMode}
			{#if selectedGroupId}
				{#if loadingDevices}
					<div class="text-muted small mb-3">
						<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
						Checking group E2EE support...
					</div>
				{:else if isE2EESupported}
					<div class="alert alert-success p-2 small mb-3">
						<strong>End-to-End Encrypted (E2EE):</strong> This exclusion will be E2EE because all devices in the target group support it.
					</div>
				{:else}
					<div class="alert alert-warning p-2 small mb-3">
						<strong>Not E2EE:</strong> This exclusion will not be encrypted because at least one device in the group does not support it (running an agent with an unknown version or version lower than <strong>python 0.5.0</strong>).
					</div>
				{/if}
			{/if}
		{:else}
			<div class="form-check mb-3">
				<input
					class="form-check-input"
					type="checkbox"
					id="exclusionEncrypted"
					checked={encrypted}
					disabled
				/>
				<label class="form-check-label" for="exclusionEncrypted">
					Encrypt this exclusion (End-to-End Encrypted)
				</label>
			</div>
		{/if}

		<div class="mb-3">
			<label for="exclusionDescription" class="form-label">Description</label>
			<textarea
				class="form-control"
				id="exclusionDescription"
				rows={2}
				bind:value={description}
				placeholder="Why this exclusion exists..."
			></textarea>
		</div>

		<div class="d-flex gap-2 justify-content-end">
			<button type="button" class="btn btn-outline-secondary" onclick={onClose}>
				Cancel
			</button>
			<button type="submit" class="btn btn-primary" disabled={!canSubmit}>
				{isEditMode ? 'Update Exclusion' : 'Create Exclusion'}
			</button>
		</div>
	</form>
</Modal>
