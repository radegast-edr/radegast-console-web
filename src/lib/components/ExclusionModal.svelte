<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import jsonata from 'jsonata';
	import type { Group } from '$lib/api';
	import { user } from '$lib/store';

	let {
		show = $bindable(false),
		title = 'Create Exclusion',
		name = $bindable(''),
		query = $bindable(''),
		description = $bindable(''),
		exclusionType = $bindable<'hard' | 'soft'>('hard'),
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
					<div class="alert alert-success mt-2 mb-0 p-2 small">✓ This query matches the current alert</div>
				{:else if queryMatchesAlert === false && query.trim()}
					<div class="alert alert-warning mt-2 mb-0 p-2 small">⚠ This query does NOT match the current alert</div>
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
			<button type="button" class="btn btn-outline-secondary" onclick={onClose}>Cancel</button>
			<button type="submit" class="btn btn-primary" disabled={!canSubmit}>
				{isEditMode ? 'Update Exclusion' : 'Create Exclusion'}
			</button>
		</div>
	</form>
</Modal>
