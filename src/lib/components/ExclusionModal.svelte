<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '@iconify/svelte';
	import jsonata from 'jsonata';
	import { api, type Group, type Device } from '$lib/api';
	import { user } from '$lib/store';
	import { agentVersionSupportsE2EE } from '$lib/exclusionHelpers';

	let {
		show = $bindable(false),
		title = 'Create Exclusion',
		name = $bindable(''),
		query = $bindable(''),
		description = $bindable(''),
		exclusionType = $bindable<'hard' | 'soft'>('hard'),
		encrypted = $bindable(false),
		selectedGroupId = $bindable<number | null>(null),
		selectedGroupIds = $bindable<number[]>([]),
		multiGroup = false,
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
		selectedGroupIds?: number[];
		multiGroup?: boolean;
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

	let hasGroupSelection = $derived(multiGroup ? selectedGroupIds.length > 0 : !!selectedGroupId);

	const canSubmit = $derived(
		!!name.trim() && !!query.trim() && queryIsValid && (groups.length === 0 || hasGroupSelection)
	);

	let targetGroupDevices = $state<Device[]>([]);
	let groupsMissingKeys = $state<string[]>([]);
	let loadingDevices = $state(false);
	let targetGroupIds = $derived(multiGroup ? selectedGroupIds : selectedGroupId ? [selectedGroupId] : []);

	function toggleGroup(groupId: number, checked: boolean): void {
		selectedGroupIds = checked
			? [...new Set([...selectedGroupIds, groupId])]
			: selectedGroupIds.filter((id) => id !== groupId);
	}

	let unsupportedDevices = $derived.by(() => {
		return targetGroupDevices.filter((d) => !agentVersionSupportsE2EE(d.agent_version));
	});

	let isE2EESupported = $derived.by(() => {
		if (multiGroup && groupsMissingKeys.length > 0) return false;
		return unsupportedDevices.length === 0;
	});

	$effect(() => {
		const ids = targetGroupIds;
		if (show && ids.length > 0) {
			let cancelled = false;
			loadingDevices = true;
			Promise.all(ids.map((id) => api.getGroup(id)))
				.then((details) => {
					if (cancelled) return;
					targetGroupDevices = details.flatMap((d) => d.devices ?? []);
					groupsMissingKeys = details.filter((d) => !d.public_key || !d.private_key).map((d) => d.name);
				})
				.catch((err) => {
					console.error('Failed to load group devices:', err);
					if (cancelled) return;
					targetGroupDevices = [];
					groupsMissingKeys = [];
				})
				.finally(() => {
					if (!cancelled) loadingDevices = false;
				});
			return () => {
				cancelled = true;
			};
		} else {
			targetGroupDevices = [];
			groupsMissingKeys = [];
			loadingDevices = false;
		}
	});

	$effect(() => {
		if (!isEditMode) {
			if (targetGroupIds.length > 0 && !loadingDevices) {
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

		{#if groups.length > 0 && multiGroup}
			<fieldset class="mb-3">
				<legend class="form-label fs-6 mb-1">Device Groups</legend>
				<div class="border rounded p-2 bg-body-tertiary" style="max-height: 12rem; overflow-y: auto;">
					{#each groups as group (group.id)}
						<div class="form-check">
							<input
								class="form-check-input"
								type="checkbox"
								id="exclusionGroup{group.id}"
								checked={selectedGroupIds.includes(group.id)}
								onchange={(e) => toggleGroup(group.id, (e.currentTarget as HTMLInputElement).checked)}
							/>
							<label class="form-check-label" for="exclusionGroup{group.id}">{group.name}</label>
						</div>
					{/each}
				</div>
				<div class="form-text small">The exclusion is applied to every selected group. You can change the groups later.</div>
			</fieldset>
		{:else if groups.length > 0}
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
			{#if targetGroupIds.length > 0}
				{#if loadingDevices}
					<div class="text-muted small mb-3">
						<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
						Checking group E2EE support...
					</div>
				{:else if isE2EESupported}
					<div class="alert alert-success p-2 small mb-3">
						<strong>End-to-End Encrypted (E2EE):</strong> This exclusion will be E2EE because all devices in the target {multiGroup ? 'groups' : 'group'} support it.
					</div>
				{:else if multiGroup && groupsMissingKeys.length > 0}
					<div class="alert alert-warning p-2 small mb-3">
						<strong>Not E2EE:</strong> This exclusion will not be encrypted because these groups have no encryption keys set up: {groupsMissingKeys.join(', ')}.
					</div>
				{:else}
					<div class="alert alert-warning p-2 small mb-3">
						<strong>Not E2EE:</strong> This exclusion will not be encrypted because at least one device in the {multiGroup ? 'selected groups' : 'group'} does not support it (running an agent with an unknown version or version lower than <strong>python 0.5.0</strong>).
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
