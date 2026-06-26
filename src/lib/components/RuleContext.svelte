<script lang="ts">
	import Icon from '@iconify/svelte';
	import { parseSigmaRule, type SigmaRuleMeta } from '$lib/sigmaParser';
	import { parseYaraRule } from '$lib/yaraParser';

	let { triggeredRule = null } = $props<{
		triggeredRule?: {
			rule_type: string;
			rule_id: string;
			rule_content: string;
			pack_id?: number | null;
			pack_name?: string | null;
		} | null;
	}>();

	let ruleMeta = $derived<SigmaRuleMeta | null>(
		triggeredRule
			? triggeredRule.rule_type === 'sigma'
				? parseSigmaRule(triggeredRule.rule_content)
				: triggeredRule.rule_type === 'yara'
					? parseYaraRule(triggeredRule.rule_content, triggeredRule.rule_id)
					: null
			: null
	);

	let hasContent = $derived(
		ruleMeta !== null &&
			(ruleMeta.techniques.length > 0 ||
				ruleMeta.tactics.length > 0 ||
				ruleMeta.references.length > 0 ||
				ruleMeta.falsePositives.length > 0 ||
				ruleMeta.author !== undefined)
	);

	function levelBadgeClass(level?: string): string {
		switch (level) {
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
		switch (status) {
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

{#if hasContent && ruleMeta}
	<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
		<div class="card-body">
			<h6 class="fw-bold text-body-secondary mb-3 d-flex align-items-center gap-2" title="Security intelligence extracted from the triggered detection rule">
				<Icon icon="lucide:shield-alert" />
				Rule Intelligence
			</h6>

			<!-- MITRE ATT&CK Techniques -->
			{#if ruleMeta.techniques.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="Specific adversary behaviors and sub-techniques used to execute this threat">
						<Icon icon="lucide:target" />
						MITRE ATT&CK Techniques
					</div>
					<div class="d-flex flex-wrap gap-1">
						{#each ruleMeta.techniques as tech}
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
			{#if ruleMeta.tactics.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="The adversarial tactical objectives (e.g. Execution, Collection)">
						<Icon icon="lucide:swords" />
						Tactics
					</div>
					<div class="d-flex flex-wrap gap-1">
						{#each ruleMeta.tactics as tactic}
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

			<!-- References -->
			{#if ruleMeta.references.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="External analysis, documentation, and write-ups regarding this threat">
						<Icon icon="lucide:link" />
						References
					</div>
					<ul class="list-unstyled mb-0 small">
						{#each ruleMeta.references as ref}
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
			{#if ruleMeta.falsePositives.length > 0}
				<div class="mb-3">
					<div class="small text-body-secondary fw-bold mb-1 d-flex align-items-center gap-1" title="Common benign activities or business-justified actions that may trigger this alert">
						<Icon icon="lucide:alert-triangle" />
						Known False Positives
					</div>
					<ul class="mb-0 small ps-3">
						{#each ruleMeta.falsePositives as fp}
							<li class="text-body-secondary">{fp}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Metadata row: author, status, level -->
			<div class="d-flex flex-wrap gap-3 small text-body-secondary">
				{#if ruleMeta.author}
					<span class="d-flex align-items-center gap-1" title="Detection Rule Author">
						<Icon icon="lucide:pen-tool" />
						{ruleMeta.author}
					</span>
				{/if}
				{#if ruleMeta.level}
					<span class="d-flex align-items-center gap-1" title="Rule Severity Classification: {ruleMeta.level}">
						<Icon icon="lucide:gauge" />
						<span class="badge {levelBadgeClass(ruleMeta.level)} text-uppercase" style="font-size: 0.7rem;">
							{ruleMeta.level}
						</span>
					</span>
				{/if}
				{#if ruleMeta.status}
					<span class="d-flex align-items-center gap-1" title="Rule Development Phase: {ruleMeta.status}">
						<Icon icon="lucide:flask-conical" />
						<span class="badge {statusBadgeClass(ruleMeta.status)} text-uppercase" style="font-size: 0.7rem;">
							{ruleMeta.status}
						</span>
					</span>
				{/if}
				{#if ruleMeta.date}
					<span class="d-flex align-items-center gap-1" title="Rule Creation Date: {ruleMeta.date}{ruleMeta.modified ? ` (Last Modified: ${ruleMeta.modified})` : ''}">
						<Icon icon="lucide:calendar" />
						{ruleMeta.date}
					</span>
				{/if}
			</div>
		</div>
	</div>
{/if}
