import { describe, it, expect } from 'vitest';
import { parseYaraRule } from './yaraParser';

describe('parseYaraRule', () => {
	const SINGLE_RULE = `
// This is a test comment
rule susp_process_injection : Injection Execution attack.t1055
{
    meta:
        author = "Security Team"
        description = "Detects process injection techniques"
        date = "2023-05-15"
        modified = "2023-06-20"
        status = "stable"
        severity = "high"
        reference = "https://attack.mitre.org/techniques/T1055/"
        falsepositive = "Legitimate debugging tools"
    strings:
        $a = "VirtualAllocEx"
    condition:
        $a
}
`;

	it('parses a single yara rule', () => {
		const result = parseYaraRule(SINGLE_RULE, 'susp_process_injection');
		expect(result).not.toBeNull();
		expect(result!.title).toBe('susp_process_injection');
		expect(result!.author).toBe('Security Team');
		expect(result!.description).toBe('Detects process injection techniques');
		expect(result!.date).toBe('2023-05-15');
		expect(result!.modified).toBe('2023-06-20');
		expect(result!.status).toBe('stable');
		expect(result!.level).toBe('high');
		expect(result!.references).toContain('https://attack.mitre.org/techniques/T1055/');
		expect(result!.falsePositives).toContain('Legitimate debugging tools');
	});

	it('extracts MITRE techniques from rule tags', () => {
		const result = parseYaraRule(SINGLE_RULE, 'susp_process_injection')!;
		expect(result.techniques).toHaveLength(1);
		expect(result.techniques[0].id).toBe('T1055');
		expect(result.techniques[0].url).toBe('https://attack.mitre.org/techniques/T1055/');
	});

	it('extracts MITRE tactics from rule tags', () => {
		const result = parseYaraRule(SINGLE_RULE, 'susp_process_injection')!;
		expect(result.tactics).toHaveLength(1);
		expect(result.tactics[0].name).toBe('execution');
		expect(result.tactics[0].label).toBe('Execution');
	});

	it('handles rule score and translates it to severity level', () => {
		const rule = `
rule test_score {
    meta:
        score = 85
}
`;
		const result = parseYaraRule(rule, 'test_score')!;
		expect(result.level).toBe('critical');
	});

	it('extracts MITRE technique from meta keys', () => {
		const rule = `
rule test_meta_tech {
    meta:
        mitre_technique = "T1083"
}
`;
		const result = parseYaraRule(rule, 'test_meta_tech')!;
		expect(result.techniques).toHaveLength(1);
		expect(result.techniques[0].id).toBe('T1083');
	});

	it('extracts MITRE tactics from meta keys', () => {
		const rule = `
rule test_meta_tactic {
    meta:
        mitre_tactic = "Execution"
}
`;
		const result = parseYaraRule(rule, 'test_meta_tactic')!;
		expect(result.tactics).toHaveLength(1);
		expect(result.tactics[0].name).toBe('execution');
	});

	it('auto-detects HTTP/HTTPS URLs as references from generic meta keys', () => {
		const rule = `
rule test_links {
    meta:
        some_blog = "https://security-blog.com/post-injection"
}
`;
		const result = parseYaraRule(rule, 'test_links')!;
		expect(result.references).toContain('https://security-blog.com/post-injection');
	});

	it('ignores other rules in a multi-rule file', () => {
		const multiRules = `
rule first_rule {
    meta:
        author = "Alice"
}

rule second_rule {
    meta:
        author = "Bob"
}
`;
		const result = parseYaraRule(multiRules, 'second_rule')!;
		expect(result).not.toBeNull();
		expect(result.author).toBe('Bob');
	});

	it('handles YARA comments gracefully (single-line and multi-line)', () => {
		const commentedRule = `
/*
   Multi-line comment block
   rule ignored_in_comment { }
*/
rule real_rule {
    meta:
        author = "Charlie" // comment here
}
`;
		const result = parseYaraRule(commentedRule, 'real_rule')!;
		expect(result).not.toBeNull();
		expect(result.author).toBe('Charlie');
	});

	it('returns null if rule is not found', () => {
		expect(parseYaraRule(SINGLE_RULE, 'non_existent_rule')).toBeNull();
	});

	it('handles rule with no meta section gracefully', () => {
		const rule = `
rule no_meta : attack.t1059
{
    strings:
        $a = "test"
    condition:
        $a
}
`;
		const result = parseYaraRule(rule, 'no_meta')!;
		expect(result).not.toBeNull();
		expect(result.techniques).toHaveLength(1);
		expect(result.techniques[0].id).toBe('T1059');
		expect(result.references).toHaveLength(0);
	});
});
