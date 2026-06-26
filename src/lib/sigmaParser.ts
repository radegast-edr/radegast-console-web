/**
 * Sigma rule YAML parser – extracts structured metadata for display in the UI.
 *
 * Parses tags into MITRE ATT&CK technique/tactic objects with direct links,
 * and surfaces references, false-positive scenarios, author info, etc.
 */

import { load } from 'js-yaml';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MitreTechnique {
	/** e.g. "T1059.001" */
	id: string;
	/** Full URL to attack.mitre.org */
	url: string;
}

export interface MitreTactic {
	/** Canonical slug, e.g. "execution" */
	name: string;
	/** Human-friendly label, e.g. "Execution" */
	label: string;
	/** Full URL to attack.mitre.org */
	url: string;
}

export interface SigmaRuleMeta {
	title?: string;
	description?: string;
	author?: string;
	date?: string;
	modified?: string;
	status?: string;
	level?: string;
	references: string[];
	falsePositives: string[];
	techniques: MitreTechnique[];
	tactics: MitreTactic[];
}

/* ------------------------------------------------------------------ */
/*  MITRE tactic slug → (TA ID, human label) mapping                  */
/* ------------------------------------------------------------------ */

const TACTIC_MAP: Record<string, { id: string; label: string }> = {
	'reconnaissance': { id: 'TA0043', label: 'Reconnaissance' },
	'resource-development': { id: 'TA0042', label: 'Resource Development' },
	'initial-access': { id: 'TA0001', label: 'Initial Access' },
	'execution': { id: 'TA0002', label: 'Execution' },
	'persistence': { id: 'TA0003', label: 'Persistence' },
	'privilege-escalation': { id: 'TA0004', label: 'Privilege Escalation' },
	'defense-evasion': { id: 'TA0005', label: 'Defense Evasion' },
	'credential-access': { id: 'TA0006', label: 'Credential Access' },
	'discovery': { id: 'TA0007', label: 'Discovery' },
	'lateral-movement': { id: 'TA0008', label: 'Lateral Movement' },
	'collection': { id: 'TA0009', label: 'Collection' },
	'command-and-control': { id: 'TA0011', label: 'Command and Control' },
	'exfiltration': { id: 'TA0010', label: 'Exfiltration' },
	'impact': { id: 'TA0040', label: 'Impact' },
	/* Sigma community sometimes uses alternative slugs */
	'defense-impairment': { id: 'TA0005', label: 'Defense Evasion' },
	'stealth': { id: 'TA0005', label: 'Defense Evasion' },
};

/* ------------------------------------------------------------------ */
/*  Tag parsing helpers                                                */
/* ------------------------------------------------------------------ */

/** Regex matching a MITRE technique ID inside an `attack.*` tag. */
const TECHNIQUE_RE = /^attack\.t(\d{4}(?:\.\d{3})?)$/i;

/**
 * Convert a technique ID like "1059.001" into a MITRE URL.
 * Sub-techniques use `/` instead of `.` in the URL path.
 */
export function techniqueUrl(rawId: string): string {
	const upper = rawId.toUpperCase();
	const parts = upper.split('.');
	if (parts.length === 2) {
		return `https://attack.mitre.org/techniques/T${parts[0]}/${parts[1]}/`;
	}
	return `https://attack.mitre.org/techniques/T${upper}/`;
}

/**
 * Build a MITRE tactic URL from a tactic TA-ID.
 */
function tacticUrl(taId: string): string {
	return `https://attack.mitre.org/tactics/${taId}/`;
}

/**
 * Resolve a tactic name or slug to a MitreTactic object.
 */
export function getMitreTactic(tacticNameOrSlug: string): MitreTactic | null {
	const slug = tacticNameOrSlug.toLowerCase().trim().replace(/_/g, '-');
	const mapped = TACTIC_MAP[slug];
	if (mapped) {
		return {
			name: slug,
			label: mapped.label,
			url: tacticUrl(mapped.id)
		};
	}
	return null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw sigma rule YAML string into structured metadata.
 * Returns `null` if the content cannot be parsed.
 */
export function parseSigmaRule(content: string): SigmaRuleMeta | null {
	let doc: Record<string, unknown>;
	try {
		const parsed = load(content);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return null;
		}
		doc = parsed as Record<string, unknown>;
	} catch {
		return null;
	}

	const techniques: MitreTechnique[] = [];
	const tactics: MitreTactic[] = [];

	const tags = doc['tags'];
	if (Array.isArray(tags)) {
		for (const tag of tags) {
			const t = String(tag).toLowerCase();
			const techMatch = TECHNIQUE_RE.exec(t);
			if (techMatch) {
				const rawId = techMatch[1];
				techniques.push({
					id: `T${rawId.toUpperCase()}`,
					url: techniqueUrl(rawId),
				});
			} else if (t.startsWith('attack.')) {
				const slug = t.slice('attack.'.length);
				const tactic = getMitreTactic(slug);
				if (tactic) {
					/* Avoid duplicate tactics */
					if (!tactics.some((x) => x.name === tactic.name)) {
						tactics.push(tactic);
					}
				}
			}
		}
	}

	const references: string[] = [];
	if (Array.isArray(doc['references'])) {
		for (const r of doc['references']) {
			if (typeof r === 'string' && r.trim().length > 0) {
				references.push(r.trim());
			}
		}
	}

	const falsePositives: string[] = [];
	if (Array.isArray(doc['falsepositives'])) {
		for (const fp of doc['falsepositives']) {
			if (typeof fp === 'string' && fp.trim().length > 0) {
				falsePositives.push(fp.trim());
			}
		}
	}

	return {
		title: typeof doc['title'] === 'string' ? doc['title'] : undefined,
		description: typeof doc['description'] === 'string' ? doc['description'] : undefined,
		author: typeof doc['author'] === 'string' ? doc['author'] : undefined,
		date: doc['date'] != null ? String(doc['date']) : undefined,
		modified: doc['modified'] != null ? String(doc['modified']) : undefined,
		status: typeof doc['status'] === 'string' ? doc['status'] : undefined,
		level: typeof doc['level'] === 'string' ? doc['level'] : undefined,
		references,
		falsePositives,
		techniques,
		tactics,
	};
}
