<script lang="ts">
	import Icon from '@iconify/svelte';
	import { parseSigmaRule, type SigmaRuleMeta } from '$lib/sigmaParser';
	import { parseYaraRule } from '$lib/yaraParser';
	import { getAlertField, getAlertArray } from '$lib/alertHelpers';

	let { triggeredRule = null, alert = undefined } = $props<{
		triggeredRule?: {
			rule_type: string;
			rule_id: string;
			rule_content: string;
			pack_id?: number | null;
			pack_name?: string | null;
		} | null;
		alert?: Record<string, unknown>;
	}>();

	let parsedMeta = $derived<SigmaRuleMeta | null>(
		triggeredRule
			? triggeredRule.rule_type === 'sigma'
				? parseSigmaRule(triggeredRule.rule_content)
				: triggeredRule.rule_type === 'yara'
					? parseYaraRule(triggeredRule.rule_content, triggeredRule.rule_id)
					: null
			: null
	);

	// Extract native threat intelligence from alert JSON (ECS 9.5.0)
	let alertTechniqueIds = $derived(alert ? getAlertArray(alert, 'threat.technique.id') ?? [] : []);
	let alertTechniqueRefs = $derived(alert ? getAlertArray(alert, 'threat.technique.reference') ?? [] : []);
	let alertSubtechniqueIds = $derived(alert ? getAlertArray(alert, 'threat.technique.subtechnique.id') ?? [] : []);
	let alertSubtechniqueRefs = $derived(alert ? getAlertArray(alert, 'threat.technique.subtechnique.reference') ?? [] : []);

	let alertTacticNames = $derived(alert ? getAlertArray(alert, 'threat.tactic.name') ?? [] : []);
	let alertTacticIds = $derived(alert ? getAlertArray(alert, 'threat.tactic.id') ?? [] : []);
	let alertTacticRefs = $derived(alert ? getAlertArray(alert, 'threat.tactic.reference') ?? [] : []);

	let alertReferences = $derived(alert ? getAlertArray(alert, 'rule.reference') ?? [] : []);
	let alertAuthors = $derived(alert ? getAlertArray(alert, 'rule.author') ?? [] : []);
	let alertAuthor = $derived(alertAuthors.length > 0 ? alertAuthors.join(', ') : getAlertField(alert ?? {}, 'rule.author'));
	let alertLevel = $derived(alert ? getAlertField(alert, 'edr.sigma.level') : undefined);
	let alertStatus = $derived(alert ? getAlertField(alert, 'edr.sigma.status') : undefined);
	let alertTags = $derived(alert ? getAlertArray(alert, 'tags') ?? [] : []);

	// Combined techniques (deduplicated by ID)
	let combinedTechniques = $derived.by(() => {
		const result: Array<{ id: string; url: string }> = [];
		const seen = new Set<string>();

		if (parsedMeta?.techniques) {
			for (const t of parsedMeta.techniques) {
				if (!seen.has(t.id)) {
					seen.add(t.id);
					result.push(t);
				}
			}
		}

		// Add technique subtechniques from alert
		alertSubtechniqueIds.forEach((id, idx) => {
			if (!seen.has(id)) {
				seen.add(id);
				const url = alertSubtechniqueRefs[idx] || `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;
				result.push({ id, url });
			}
		});

		// Add top-level techniques from alert
		alertTechniqueIds.forEach((id, idx) => {
			if (!seen.has(id)) {
				seen.add(id);
				const url = alertTechniqueRefs[idx] || `https://attack.mitre.org/techniques/${id}/`;
				result.push({ id, url });
			}
		});

		return result;
	});

	// Combined tactics
	let combinedTactics = $derived.by(() => {
		const result: Array<{ label: string; url: string }> = [];
		const seen = new Set<string>();

		if (parsedMeta?.tactics) {
			for (const tac of parsedMeta.tactics) {
				if (!seen.has(tac.label)) {
					seen.add(tac.label);
					result.push(tac);
				}
			}
		}

		alertTacticNames.forEach((name, idx) => {
			if (!seen.has(name)) {
				seen.add(name);
				const id = alertTacticIds[idx];
				const url = alertTacticRefs[idx] || (id ? `https://attack.mitre.org/tactics/${id}/` : 'https://attack.mitre.org/');
				result.push({ label: name, url });
			}
		});

		return result;
	});

	// Combined references
	let combinedReferences = $derived.by(() => {
		const set = new Set<string>();
		if (parsedMeta?.references) {
			parsedMeta.references.forEach((r) => set.add(r));
		}
		alertReferences.forEach((r) => set.add(r));
		return Array.from(set);
	});

	// Non-attack tags
	let extraTags = $derived(
		alertTags.filter((t) => !t.startsWith('attack.'))
	);

	let effectiveAuthor = $derived(parsedMeta?.author || alertAuthor);
	let effectiveLevel = $derived(parsedMeta?.level || alertLevel);
	let effectiveStatus = $derived(parsedMeta?.status || alertStatus);
	let effectiveFalsePositives = $derived(parsedMeta?.falsePositives ?? []);

	let hasContent = $derived(
		combinedTechniques.length > 0 ||
		combinedTactics.length > 0 ||
		combinedReferences.length > 0 ||
		effectiveFalsePositives.length > 0 ||
		extraTags.length > 0 ||
		effectiveAuthor !== undefined ||
		effectiveLevel !== undefined ||
		effectiveStatus !== undefined
	);

	function levelBadgeClass(level?: string): string {
		switch (level?.toLowerCase()) {
			case 'critical':
			case 'high':
				return 'bg-danger text-white';
			case 'medium':
				return 'bg-warning text-dark';
			case 'low':
				return 'bg-info text-white';
			case 'informational':
				return 'bg-secondary text-white';
			default:
				return 'bg-secondary text-white';
		}
	}

	function statusBadgeClass(status?: string): string {
		switch (status?.toLowerCase()) {
			case 'stable':
				return 'bg-success text-white';
			case 'test':
				return 'bg-warning text-dark';
			case 'experimental':
				return 'bg-info text-white';
			default:
				return 'bg-secondary text-white';
		}
	}

	/** Truncate a URL for display so it doesn't overflow. */
	function displayUrl(url: string): string {
		try {
			const u = new URL(url);
			const path = u.pathname.length > 60 ? u.pathname.slice(0, 57) + '...' : u.pathname;
			return u.hostname + path;
		} catch {
			return url.length > 80 ? url.slice(0, 77) + '...' : url;
		}
	}
</script>

{#if hasContent}
	<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
		<div class="card-body">
			<h6 class="fw-bold text-body-secondary mb-3 d-flex align-items-center gap-2" title="Security intelligence extracted from the detection rule">
				<Icon icon="lucide:shield-alert" class="text-primary" />
				Rule Intelligence
			</h6>

			<!-- MITRE ATT&CK Techniques -->
			{#if combinedTechniques.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="Specific adversary behaviors and sub-techniques used to execute this threat">
						<Icon icon="lucide:target" />
						MITRE ATT&CK Techniques
					</div>
					<div class="d-flex flex-wrap gap-1">
						{#each combinedTechniques as tech}
							<a
								href={tech.url}
								target="_blank"
								rel="noopener noreferrer"
								class="badge bg-danger-subtle text-danger border border-danger-subtle text-decoration-none d-inline-flex align-items-center gap-1"
								style="font-size: 0.78rem;"
								title="View technique {tech.id} on MITRE ATT&CK"
							>
								{tech.id}
								<Icon icon="lucide:external-link" style="font-size: 0.65rem;" />
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- MITRE ATT&CK Tactics -->
			{#if combinedTactics.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="The adversarial tactical objectives (e.g. Execution, Collection)">
						<Icon icon="lucide:swords" />
						Tactics
					</div>
					<div class="d-flex flex-wrap gap-1">
						{#each combinedTactics as tactic}
							<a
								href={tactic.url}
								target="_blank"
								rel="noopener noreferrer"
								class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle text-decoration-none d-inline-flex align-items-center gap-1"
								style="font-size: 0.78rem;"
								title="View tactic {tactic.label} on MITRE ATT&CK"
							>
								{tactic.label}
								<Icon icon="lucide:external-link" style="font-size: 0.65rem;" />
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Non-ATT&CK Tags (e.g. CVE, malware family) -->
			{#if extraTags.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1">
						<Icon icon="lucide:tag" />
						Tags
					</div>
					<div class="d-flex flex-wrap gap-1">
						{#each extraTags as tag}
							<span class="badge bg-body-secondary text-body border" style="font-size: 0.75rem;">
								{tag}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- References -->
			{#if combinedReferences.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="External analysis, documentation, and write-ups regarding this threat">
						<Icon icon="lucide:link" />
						References
					</div>
					<ul class="list-unstyled mb-0 small">
						{#each combinedReferences as ref}
							<li class="mb-1">
								<a
									href={ref}
									target="_blank"
									rel="noopener noreferrer"
									class="text-primary text-decoration-none d-inline-flex align-items-center gap-1"
									style="word-break: break-all;"
									title="Open reference link"
								>
									{displayUrl(ref)}
									<Icon icon="lucide:external-link" style="font-size: 0.65rem; flex-shrink: 0;" />
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- False Positives -->
			{#if effectiveFalsePositives.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="Common benign activities or business-justified actions that may trigger this alert">
						<Icon icon="lucide:alert-triangle" />
						Known False Positives
					</div>
					<ul class="mb-0 small ps-3">
						{#each effectiveFalsePositives as fp}
							<li class="text-body-secondary">{fp}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Metadata row: author, status, level -->
			<div class="d-flex flex-wrap gap-3 small text-body-secondary">
				{#if effectiveAuthor}
					<span class="d-flex align-items-center gap-1" title="Detection Rule Author">
						<Icon icon="lucide:pen-tool" />
						{effectiveAuthor}
					</span>
				{/if}
				{#if effectiveLevel}
					<span class="d-flex align-items-center gap-1" title="Rule Severity Classification: {effectiveLevel}">
						<Icon icon="lucide:gauge" />
						<span class="badge {levelBadgeClass(effectiveLevel)} text-uppercase" style="font-size: 0.7rem;">
							{effectiveLevel}
						</span>
					</span>
				{/if}
				{#if effectiveStatus}
					<span class="d-flex align-items-center gap-1" title="Rule Development Phase: {effectiveStatus}">
						<Icon icon="lucide:flask-conical" />
						<span class="badge {statusBadgeClass(effectiveStatus)} text-uppercase" style="font-size: 0.7rem;">
							{effectiveStatus}
						</span>
					</span>
				{/if}
			</div>
		</div>
	</div>
{/if}
