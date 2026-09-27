<script lang="ts">
	import Icon from '@iconify/svelte';

	interface MatchField {
		selection?: string;
		field?: string;
		matcher?: string;
		pattern_type?: string;
		pattern?: string;
		value?: string;
	}

	interface MatchKeyword {
		selection?: string;
		keyword?: string;
		field?: string;
		value?: string;
	}

	interface YaraStringMatch {
		id?: string;
		offset?: number;
		snippet?: string;
	}

	interface YaraRuleMatch {
		rule?: string;
		tags?: string[];
		namespace?: string;
		strings?: YaraStringMatch[];
	}

	interface CorrelationDetails {
		correlation_type?: string;
		group_key?: Array<[string, string]>;
		aggregated_value?: number;
		timespan_secs?: number;
	}

	interface MatchDetailsData {
		summary?: string;
		sigma?: {
			condition?: string;
			selection_results?: Record<string, boolean>;
			matches?: MatchField[];
			keyword_matches?: MatchKeyword[];
		};
		yara?: {
			rules?: YaraRuleMatch[];
		};
		correlation?: CorrelationDetails;
	}

	let { matchDetails }: { matchDetails: MatchDetailsData } = $props();

	let expanded = $state(false);

	let summary = $derived(matchDetails?.summary);
	let sigmaMatches = $derived(matchDetails?.sigma?.matches ?? []);
	let keywordMatches = $derived(matchDetails?.sigma?.keyword_matches ?? []);
	let yaraRules = $derived(matchDetails?.yara?.rules ?? []);
	let correlation = $derived(matchDetails?.correlation);

	let hasTechnicalDetails = $derived(
		sigmaMatches.length > 0 ||
		keywordMatches.length > 0 ||
		yaraRules.length > 0 ||
		correlation !== undefined
	);
</script>

{#if summary || hasTechnicalDetails}
	<div class="card border-0 shadow-sm bg-body-tertiary mb-3">
		<div class="card-body">
			<div class="d-flex justify-content-between align-items-center mb-2">
				<h6 class="fw-bold text-body-secondary mb-0 d-flex align-items-center gap-1">
					<Icon icon="lucide:check-circle-2" class="text-primary" />
					Detection Match Explanation
				</h6>
				{#if hasTechnicalDetails}
					<button
						type="button"
						class="btn btn-sm btn-link text-decoration-none p-0 small fw-semibold"
						onclick={() => (expanded = !expanded)}
					>
						{expanded ? 'Hide Details' : 'View Match Details'}
					</button>
				{/if}
			</div>

			{#if summary}
				<div class="p-2 mb-2 bg-body-secondary text-body small font-monospace" style="border-radius: 3px; white-space: pre-wrap; word-break: break-all;">
					{summary}
				</div>
			{/if}

			{#if expanded && hasTechnicalDetails}
				<div class="mt-3 pt-3 border-top">
					<!-- Correlation Match Details -->
					{#if correlation}
						<div class="mb-3">
							<span class="small fw-bold text-body-secondary d-block mb-1">Correlation Summary:</span>
							<table class="table table-sm table-borderless small mb-0">
								<tbody>
									{#if correlation.correlation_type}
										<tr>
											<td class="text-body-secondary" style="width: 140px;">Type</td>
											<td><span class="badge bg-secondary">{correlation.correlation_type}</span></td>
										</tr>
									{/if}
									{#if correlation.aggregated_value !== undefined}
										<tr>
											<td class="text-body-secondary">Aggregated Value</td>
											<td class="fw-semibold">{correlation.aggregated_value}</td>
										</tr>
									{/if}
									{#if correlation.timespan_secs !== undefined}
										<tr>
											<td class="text-body-secondary">Window</td>
											<td>{correlation.timespan_secs} seconds</td>
										</tr>
									{/if}
									{#if correlation.group_key && correlation.group_key.length > 0}
										<tr>
											<td class="text-body-secondary">Group Keys</td>
											<td>
												{#each correlation.group_key as [k, v]}
													<span class="badge bg-body-secondary text-body border me-1">{k}: {v}</span>
												{/each}
											</td>
										</tr>
									{/if}
								</tbody>
							</table>
						</div>
					{/if}

					<!-- Sigma Field Matches -->
					{#if sigmaMatches.length > 0}
						<div class="mb-3">
							<span class="small fw-bold text-body-secondary d-block mb-1">Matched Sigma Fields:</span>
							<div class="table-responsive">
								<table class="table table-sm table-bordered border-secondary-subtle small mb-0">
									<thead class="table-light">
										<tr>
											<th>Field</th>
											<th>Condition / Matcher</th>
											<th>Pattern</th>
											<th>Observed Value</th>
										</tr>
									</thead>
									<tbody>
										{#each sigmaMatches as m}
											<tr>
												<td class="font-monospace fw-semibold">{m.field || m.selection || '-'}</td>
												<td><span class="badge bg-info-subtle text-info-emphasis border">{m.matcher || m.pattern_type || 'exact'}</span></td>
												<td class="font-monospace text-break">{m.pattern ?? '-'}</td>
												<td class="font-monospace text-break">{m.value ?? '-'}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<!-- Sigma Keyword Matches -->
					{#if keywordMatches.length > 0}
						<div class="mb-3">
							<span class="small fw-bold text-body-secondary d-block mb-1">Matched Keywords:</span>
							<div class="d-flex flex-wrap gap-1">
								{#each keywordMatches as kw}
									<span class="badge bg-secondary-subtle text-secondary-emphasis border font-monospace">
										{kw.keyword || kw.value}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<!-- YARA String Matches -->
					{#if yaraRules.length > 0}
						<div class="mb-2">
							<span class="small fw-bold text-body-secondary d-block mb-1">YARA Rule Hits:</span>
							{#each yaraRules as yr}
								<div class="mb-2 p-2 border border-secondary-subtle bg-body-secondary" style="border-radius: 3px;">
									<div class="fw-bold small mb-1">{yr.rule ?? 'Rule hit'}</div>
									{#if yr.strings && yr.strings.length > 0}
										<div class="table-responsive">
											<table class="table table-sm table-borderless small mb-0">
												<thead>
													<tr class="text-body-secondary">
														<th>Identifier</th>
														<th>Offset</th>
														<th>Snippet</th>
													</tr>
												</thead>
												<tbody>
													{#each yr.strings as st}
														<tr>
															<td class="font-monospace">{st.id ?? '-'}</td>
															<td class="font-monospace">{st.offset !== undefined ? `0x${st.offset.toString(16)}` : '-'}</td>
															<td class="font-monospace text-break text-danger">{st.snippet ?? '-'}</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
