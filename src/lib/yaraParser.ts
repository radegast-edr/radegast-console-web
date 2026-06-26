/**
 * YARA rule parser – extracts structured metadata from YARA rules for UI display.
 */

import { type MitreTechnique, type MitreTactic, techniqueUrl, getMitreTactic } from './sigmaParser';

export interface YaraRuleMeta {
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

/** Helper to clean comments from a YARA file to avoid false parsing matches. */
function cleanComments(content: string): string {
	// Matches double-quoted string literals OR single-line comments OR multi-line comments
	const pattern = /(?:"[^"\\]*(?:\\.[^"\\]*)*")|(?:\/\/.*?$)|(?:\/\*[\s\S]*?\*\/)/gm;
	return content.replace(pattern, (match) => {
		if (match.startsWith('//') || match.startsWith('/*')) {
			return '';
		}
		return match;
	});
}

/** Unescape quotes inside YARA meta strings. */
function unescapeString(str: string): string {
	return str.replace(/\\(.)/g, '$1');
}

const TECHNIQUE_PATTERN = /\bT(\d{4}(?:\.\d{3})?)\b/i;

/**
 * Parse a raw YARA file content string to find and extract metadata for a specific rule name.
 * Returns `null` if the rule is not found.
 */
export function parseYaraRule(content: string, ruleId: string): YaraRuleMeta | null {
	if (!content || !ruleId) return null;

	const clean = cleanComments(content);

	// Find the rule ruleId block. Format: rule RuleName : Tag1 Tag2 { ... }
	const rulePattern = new RegExp(`\\brule\\s+(${reEscape(ruleId)})\\b[^{]*{`, 'g');
	const match = rulePattern.exec(clean);
	if (!match) return null;

	const startIdx = match.index;
	const braceIdx = clean.indexOf('{', startIdx);
	if (braceIdx === -1) return null;

	const headerSection = clean.slice(startIdx, braceIdx);

	// Extract tags from header if present
	const tags: string[] = [];
	const colonIdx = headerSection.indexOf(':');
	if (colonIdx !== -1) {
		const tagsStr = headerSection.slice(colonIdx + 1).trim();
		tags.push(...tagsStr.split(/\s+/).filter(Boolean));
	}

	const ruleBody = clean.slice(braceIdx + 1);

	// Parse meta section if present. Meta section is before strings/condition/closing brace.
	const metaMatch = /\bmeta\s*:/i.exec(ruleBody);
	const metaPairs: { key: string; value: string }[] = [];

	if (metaMatch) {
		const metaIndex = metaMatch.index + metaMatch[0].length;
		const afterMeta = ruleBody.slice(metaIndex);

		// Find end of meta block: first occurrence of strings:, condition: or closing brace }
		const endMatch = /\b(?:strings|condition)\b|\}/i.exec(afterMeta);
		const metaBlockText = endMatch ? afterMeta.slice(0, endMatch.index) : afterMeta;

		// Regex to parse: key = "value" or key = value
		const lineRegex = /^\s*([\w-]+)\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|([^\s]+))\s*$/;
		const metaLines = metaBlockText.split('\n');

		for (const line of metaLines) {
			const m = lineRegex.exec(line.trim());
			if (m) {
				const key = m[1].toLowerCase().trim();
				const rawVal = m[2] !== undefined ? m[2] : m[3];
				const value = unescapeString(rawVal.trim());
				metaPairs.push({ key, value });
			}
		}
	}

	// Normalizing metadata
	let title = ruleId;
	let description: string | undefined;
	let author: string | undefined;
	let date: string | undefined;
	let modified: string | undefined;
	let status: string | undefined;
	let level: string | undefined;

	const references: string[] = [];
	const falsePositives: string[] = [];
	const techniques: MitreTechnique[] = [];
	const tactics: MitreTactic[] = [];

	for (const { key, value } of metaPairs) {
		if (key === 'author') {
			author = value;
		} else if (key === 'description' || key === 'desc') {
			description = value;
		} else if (key === 'title') {
			title = value;
		} else if (key === 'date') {
			date = value;
		} else if (key === 'modified') {
			modified = value;
		} else if (key === 'status') {
			status = value;
		} else if (key === 'level' || key === 'severity' || key === 'threat_level') {
			level = value.toLowerCase();
		} else if (key === 'score') {
			const scoreVal = parseInt(value, 10);
			if (!isNaN(scoreVal)) {
				if (scoreVal >= 80) level = 'critical';
				else if (scoreVal >= 60) level = 'high';
				else if (scoreVal >= 40) level = 'medium';
				else level = 'low';
			}
		} else if (
			key === 'reference' ||
			key === 'references' ||
			key === 'ref' ||
			key === 'url' ||
			key === 'link'
		) {
			references.push(value);
		} else if (key === 'falsepositive' || key === 'falsepositives' || key === 'fp') {
			falsePositives.push(value);
		}
	}

	// Parse techniques and tactics from tags
	for (const tag of tags) {
		const techMatch = TECHNIQUE_PATTERN.exec(tag);
		if (techMatch) {
			const rawId = techMatch[1];
			const techId = `T${rawId.toUpperCase()}`;
			if (!techniques.some((t) => t.id === techId)) {
				techniques.push({
					id: techId,
					url: techniqueUrl(rawId)
				});
			}
		}

		const tactic = getMitreTactic(tag);
		if (tactic) {
			if (!tactics.some((t) => t.name === tactic.name)) {
				tactics.push(tactic);
			}
		}
	}

	// Parse techniques, tactics, and references from meta pairs values
	for (const { key, value } of metaPairs) {
		if (
			key.includes('technique') ||
			key.includes('attack') ||
			key.includes('mitre') ||
			key === 'ref' ||
			key.includes('reference')
		) {
			const techMatch = TECHNIQUE_PATTERN.exec(value);
			if (techMatch) {
				const rawId = techMatch[1];
				const techId = `T${rawId.toUpperCase()}`;
				if (!techniques.some((t) => t.id === techId)) {
					techniques.push({
						id: techId,
						url: techniqueUrl(rawId)
					});
				}
			}
		}

		if (key.includes('tactic')) {
			const tactic = getMitreTactic(value);
			if (tactic) {
				if (!tactics.some((t) => t.name === tactic.name)) {
					tactics.push(tactic);
				}
			}
		}

		if (value.startsWith('http://') || value.startsWith('https://')) {
			if (!references.includes(value)) {
				references.push(value);
			}
		}
	}

	return {
		title,
		description,
		author,
		date,
		modified,
		status,
		level,
		references: Array.from(new Set(references)),
		falsePositives: Array.from(new Set(falsePositives)),
		techniques,
		tactics
	};
}

/** Simple regex escape helper. */
function reEscape(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
