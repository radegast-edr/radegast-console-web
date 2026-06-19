import jsonata from 'jsonata';

export function isDeviceActive(lastSeen: string | Date | null | undefined): boolean {
	if (!lastSeen) return false;
	let cleanStr: string | Date = lastSeen;
	if (typeof lastSeen === 'string' && !lastSeen.endsWith('Z') && !lastSeen.includes('+')) {
		cleanStr = lastSeen + 'Z';
	}
	const lastSeenDate = new Date(cleanStr);
	const diffMs = new Date().getTime() - lastSeenDate.getTime();
	return diffMs < 10 * 60 * 1000;
}

export function formatFullDateTime(dt: string | Date | null | undefined): string {
	if (!dt) return 'Never';
	let cleanStr: string | Date = dt;
	if (typeof dt === 'string' && !dt.endsWith('Z') && !dt.includes('+')) {
		cleanStr = dt + 'Z';
	}
	return new Date(cleanStr).toLocaleString();
}

export function preprocessQuery(query: string): string {
	if (!query) return '';
	
	// 1. Replace "not(" or "not (" with "$not("
	let q = query.replace(/\bnot\s*\(/g, '$not(');
	
	// 2. Handle "not " as a prefix operator: "not meta.status = 'online'"
	let pos = 0;
	while (pos < q.length) {
		const match = /\bnot\s+/.exec(q.slice(pos));
		if (!match) break;
		
		const startIdx = pos + match.index;
		const exprStart = startIdx + match[0].length;
		
		let parenCount = 0;
		let endIdx = exprStart;
		while (endIdx < q.length) {
			const char = q[endIdx];
			if (char === '(') {
				parenCount++;
			} else if (char === ')') {
				if (parenCount === 0) {
					break;
				}
				parenCount--;
			} else if (parenCount === 0) {
				const remaining = q.slice(endIdx);
				if (/^\band\b/i.test(remaining) || /^\bor\b/i.test(remaining)) {
					break;
				}
			}
			endIdx++;
		}
		
		const subExpr = q.slice(exprStart, endIdx).trim();
		const replacement = `$not(${subExpr})`;
		
		q = q.slice(0, startIdx) + replacement + q.slice(endIdx);
		pos = startIdx + replacement.length;
	}
	
	return q;
}

export async function matchesJsonata(obj: any, query: string): Promise<boolean> {
	if (!query || !query.trim()) return true;
	try {
		const processed = preprocessQuery(query);
		const expr = jsonata(processed);
		const res = await expr.evaluate(obj);
		if (typeof res === 'boolean') return res;
		return !!res;
	} catch {
		return false;
	}
}

export function mapSeverityToNumber(severity: any): number {
	// https://github.com/SigmaHQ/sigma-specification/blob/main/specification/sigma-rules-specification.md#level
	if (severity === null || severity === undefined) {
		return 0;
	}

	let numVal: number | null = null;
	if (typeof severity === 'number') {
		numVal = Math.round(severity);
	} else if (typeof severity === 'string') {
		const trimmed = severity.trim();
		const parsed = parseInt(trimmed, 10);
		if (!isNaN(parsed) && String(parsed) === trimmed) {
			numVal = parsed;
		}
	}

	if (numVal !== null) {
		if (numVal >= 1 && numVal <= 5) {
			return numVal;
		}
		if (numVal >= 6 && numVal <= 12) {
			return 1;
		}
		if (numVal >= 13 && numVal <= 16) {
			return 3;
		}
		if (numVal >= 17 && numVal <= 20) {
			return 4;
		}
		if (numVal >= 21 && numVal <= 24) {
			return 5;
		}
		return 0;
	}

	if (typeof severity !== 'string') {
		return 0;
	}

	const sev = severity.toLowerCase().trim();
	switch (sev) {
		case 'informational':
		case 'info':
		case 'notice':
		case 'trace':
		case 'debug':
			return 1;
		case 'low':
			return 2;
		case 'medium':
		case 'med':
		case 'warn':
		case 'warning':
			return 3;
		case 'high':
		case 'error':
			return 4;
		case 'critical':
		case 'crit':
		case 'fatal':
		case 'alert':
		case 'emergency':
		case 'emerg':
			return 5;
		default:
			return 0;
	}
}
