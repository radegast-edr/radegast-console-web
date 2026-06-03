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
	} catch (e) {
		return false;
	}
}

export function mapSeverityToNumber(severity: any): number {
	// https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/logs/data-model.md#field-severitynumber
	if (severity === null || severity === undefined) {
		return 0;
	}
	if (typeof severity !== 'string') {
		if (typeof severity === 'number') {
			return Math.round(severity);
		}
		return 0;
	}
	const sev = severity.toLowerCase().trim();
	switch (sev) {
		// TRACE range: 1-4
		case 'trace':
		case 'trace1':
			return 1;
		case 'trace2':
			return 2;
		case 'trace3':
			return 3;
		case 'trace4':
			return 4;

		// DEBUG range: 5-8
		case 'debug':
		case 'debug1':
			return 5;
		case 'debug2':
			return 6;
		case 'debug3':
			return 7;
		case 'debug4':
			return 8;

		// INFO range: 9-12
		case 'info':
		case 'info1':
		case 'informational':
		case 'low':
			return 9;
		case 'info2':
			return 10;
		case 'info3':
			return 11;
		case 'info4':
		case 'notice':
			return 12;

		// WARN range: 13-16
		case 'warn':
		case 'warn1':
		case 'warning':
		case 'medium':
		case 'med':
			return 13;
		case 'warn2':
			return 14;
		case 'warn3':
			return 15;
		case 'warn4':
			return 16;

		// ERROR range: 17-20
		case 'error':
		case 'error1':
		case 'high':
			return 17;
		case 'error2':
			return 18;
		case 'error3':
			return 19;
		case 'error4':
			return 20;

		// FATAL range: 21-24
		case 'fatal':
		case 'fatal1':
		case 'critical':
		case 'crit':
			return 21;
		case 'fatal2':
		case 'alert':
			return 23;
		case 'fatal4':
		case 'emergency':
		case 'emerg':
			return 24;

		default:
			const num = parseInt(sev, 10);
			if (!isNaN(num)) {
				return num;
			}
			return 0;
	}
}
