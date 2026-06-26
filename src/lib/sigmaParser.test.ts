import { describe, it, expect } from 'vitest';
import { parseSigmaRule, techniqueUrl } from './sigmaParser';

describe('techniqueUrl', () => {
	it('generates URL for a top-level technique', () => {
		expect(techniqueUrl('1059')).toBe('https://attack.mitre.org/techniques/T1059/');
	});

	it('generates URL for a sub-technique', () => {
		expect(techniqueUrl('1059.001')).toBe('https://attack.mitre.org/techniques/T1059/001/');
	});

	it('handles lowercase input', () => {
		expect(techniqueUrl('1560.001')).toBe('https://attack.mitre.org/techniques/T1560/001/');
	});
});

describe('parseSigmaRule', () => {
	const FULL_RULE = `
title: Compress Data and Lock With Password for Exfiltration With 7-ZIP
id: 9fbf5927-5261-4284-a71d-f681029ea574
status: test
description: An adversary may compress or encrypt data that is collected prior to exfiltration using 3rd party utilities
references:
    - https://github.com/redcanaryco/atomic-red-team/blob/f339e7da7d05f6057fdfcdd3742bfcf365fee2a9/atomics/T1560.001/T1560.001.md
author: frack113
date: 2021-07-27
modified: 2023-03-13
tags:
    - attack.collection
    - attack.t1560.001
logsource:
    category: process_creation
    product: windows
detection:
    selection_img:
        - Description|contains: '7-Zip'
    condition: all of selection_*
falsepositives:
    - Legitimate activity is expected since compressing files with a password is common.
level: medium
`;

	it('parses a full sigma rule', () => {
		const result = parseSigmaRule(FULL_RULE);
		expect(result).not.toBeNull();
		expect(result!.title).toBe(
			'Compress Data and Lock With Password for Exfiltration With 7-ZIP'
		);
		expect(result!.description).toBe(
			'An adversary may compress or encrypt data that is collected prior to exfiltration using 3rd party utilities'
		);
		expect(result!.author).toBe('frack113');
		expect(result!.status).toBe('test');
		expect(result!.level).toBe('medium');
	});

	it('extracts MITRE techniques from tags', () => {
		const result = parseSigmaRule(FULL_RULE)!;
		expect(result.techniques).toHaveLength(1);
		expect(result.techniques[0].id).toBe('T1560.001');
		expect(result.techniques[0].url).toBe(
			'https://attack.mitre.org/techniques/T1560/001/'
		);
	});

	it('extracts MITRE tactics from tags', () => {
		const result = parseSigmaRule(FULL_RULE)!;
		expect(result.tactics).toHaveLength(1);
		expect(result.tactics[0].name).toBe('collection');
		expect(result.tactics[0].label).toBe('Collection');
		expect(result.tactics[0].url).toBe('https://attack.mitre.org/tactics/TA0009/');
	});

	it('extracts references', () => {
		const result = parseSigmaRule(FULL_RULE)!;
		expect(result.references).toHaveLength(1);
		expect(result.references[0]).toContain('atomic-red-team');
	});

	it('extracts false positives', () => {
		const result = parseSigmaRule(FULL_RULE)!;
		expect(result.falsePositives).toHaveLength(1);
		expect(result.falsePositives[0]).toContain('Legitimate activity');
	});

	it('extracts date fields as strings', () => {
		const result = parseSigmaRule(FULL_RULE)!;
		expect(result.date).toBeDefined();
		expect(result.modified).toBeDefined();
	});

	it('handles rule with multiple techniques and tactics', () => {
		const rule = `
title: Multi-tag rule
tags:
    - attack.discovery
    - attack.privilege-escalation
    - attack.t1083
    - attack.t1548
detection:
    condition: selection
`;
		const result = parseSigmaRule(rule)!;
		expect(result.techniques).toHaveLength(2);
		expect(result.techniques[0].id).toBe('T1083');
		expect(result.techniques[1].id).toBe('T1548');
		expect(result.tactics).toHaveLength(2);
		expect(result.tactics.map((t) => t.name)).toContain('discovery');
		expect(result.tactics.map((t) => t.name)).toContain('privilege-escalation');
	});

	it('handles rule with no tags', () => {
		const rule = `
title: Simple rule
detection:
    condition: selection
`;
		const result = parseSigmaRule(rule)!;
		expect(result.techniques).toHaveLength(0);
		expect(result.tactics).toHaveLength(0);
	});

	it('handles rule with no references or false positives', () => {
		const rule = `
title: Minimal rule
detection:
    condition: selection
`;
		const result = parseSigmaRule(rule)!;
		expect(result.references).toHaveLength(0);
		expect(result.falsePositives).toHaveLength(0);
	});

	it('returns null for invalid YAML', () => {
		expect(parseSigmaRule('{{{')).toBeNull();
	});

	it('returns null for non-object YAML', () => {
		expect(parseSigmaRule('- list item')).toBeNull();
		expect(parseSigmaRule('just a string')).toBeNull();
	});

	it('returns null for empty content', () => {
		expect(parseSigmaRule('')).toBeNull();
	});

	it('handles alternative tactic slugs (defense-impairment)', () => {
		const rule = `
title: Stealth rule
tags:
    - attack.defense-impairment
    - attack.t1222.002
detection:
    condition: selection
`;
		const result = parseSigmaRule(rule)!;
		expect(result.tactics).toHaveLength(1);
		expect(result.tactics[0].label).toBe('Defense Evasion');
		expect(result.techniques).toHaveLength(1);
		expect(result.techniques[0].id).toBe('T1222.002');
	});

	it('deduplicates identical tactic slugs', () => {
		const rule = `
title: Dedup test
tags:
    - attack.execution
    - attack.execution
detection:
    condition: selection
`;
		const result = parseSigmaRule(rule)!;
		expect(result.tactics).toHaveLength(1);
	});

	it('handles case-insensitive technique tags', () => {
		const rule = `
title: Case test
tags:
    - attack.T1059.001
detection:
    condition: selection
`;
		const result = parseSigmaRule(rule)!;
		expect(result.techniques).toHaveLength(1);
		expect(result.techniques[0].id).toBe('T1059.001');
	});
});
