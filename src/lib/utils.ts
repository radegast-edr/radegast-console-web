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

export function toLocalISOString(dateOrStr: string | Date | null | undefined): string {
	if (!dateOrStr) return '';
	let dateStr = dateOrStr;
	if (typeof dateStr === 'string') {
		if (dateStr.includes('T')) {
			const parts = dateStr.split('T');
			const timePart = parts[1] || '';
			if (!timePart.includes('Z') && !timePart.includes('+') && !timePart.includes('-')) {
				dateStr = dateStr + 'Z';
			}
		}
	}
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return '';
	const pad = (num: number) => String(num).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toUTCISOString(localStr: string | null | undefined): string {
	if (!localStr) return '';
	const date = new Date(localStr);
	if (isNaN(date.getTime())) return '';
	return date.toISOString();
}

export type DeviceStatus = 'unhealthy' | 'healthy' | 'offline';

export function getDeviceStatus(device: {
	last_seen?: string | Date | null;
	healthy?: boolean | null;
}): DeviceStatus {
	if (!isDeviceActive(device.last_seen)) {
		return 'offline';
	}
	if (device.healthy === false) {
		return 'unhealthy';
	}
	return 'healthy';
}

export function sortDevices<
	T extends {
		name: string;
		last_seen?: string | Date | null;
		healthy?: boolean | null;
		id?: number | string;
	}
>(devices: T[]): T[] {
	const statusRank: Record<DeviceStatus, number> = {
		unhealthy: 0,
		healthy: 1,
		offline: 2
	};

	return [...devices].sort((a, b) => {
		const rankA = statusRank[getDeviceStatus(a)];
		const rankB = statusRank[getDeviceStatus(b)];
		if (rankA !== rankB) {
			return rankA - rankB;
		}
		const nameComp = (a.name || '').localeCompare(b.name || '');
		if (nameComp !== 0) {
			return nameComp;
		}
		return Number(a.id ?? 0) - Number(b.id ?? 0);
	});
}

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
		return '0 B';
	}
	const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const idx = Math.min(i, units.length - 1);
	if (idx === 0) {
		return `${bytes} B`;
	}
	const val = bytes / Math.pow(k, idx);
	const formatted = val < 10 ? val.toFixed(1) : val.toFixed(0);
	return `${formatted} ${units[idx]}`;
}

/**
 * Adaptively calculates the next page size between minLimit (default 100) and maxLimit (default 5000)
 * based on how much faster or slower the next page was compared to the previous page.
 *
 * @param currentSize - The page size used in the current request.
 * @param currentElapsedMs - The duration of the current request in milliseconds.
 * @param prevElapsedMs - Optional duration of the previous request in milliseconds.
 * @param prevSize - Optional page size used in the previous request.
 * @param minLimit - Minimum allowed page size (default: 100).
 * @param maxLimit - Maximum allowed page size (default: 5000).
 */
export function calculateNextPageSize(
	currentSize: number,
	currentElapsedMs: number,
	prevElapsedMs?: number | null,
	prevSize?: number | null,
	minLimit: number = 100,
	maxLimit: number = 5000
): number {
	const safeCurrElapsed = Math.max(currentElapsedMs, 10);
	const safeCurrSize = Math.max(currentSize, 1);

	// If no previous measurement exists (first request), probe upward with a moderate step
	if (prevElapsedMs === null || prevElapsedMs === undefined || prevElapsedMs <= 0) {
		const next = Math.round((currentSize * 1.5) / 50) * 50;
		return Math.max(minLimit, Math.min(maxLimit, next));
	}

	const safePrevElapsed = Math.max(prevElapsedMs, 10);
	const safePrevSize = Math.max(prevSize ?? currentSize, 1);

	// Processing speed in items per millisecond
	const currSpeed = safeCurrSize / safeCurrElapsed;
	const prevSpeed = safePrevSize / safePrevElapsed;

	// Ratio of how much faster (> 1) or slower (< 1) the next page was
	const rawRatio = currSpeed / prevSpeed;

	// If speed is virtually unchanged (within ±15%), gently probe higher
	if (rawRatio >= 0.85 && rawRatio <= 1.15) {
		const next = Math.round((currentSize * 1.1 + 25) / 50) * 50;
		return Math.max(minLimit, Math.min(maxLimit, next));
	}

	// Clamp adaptation factor to prevent violent oscillations (between 0.5x and 2.0x)
	const ratio = Math.max(0.5, Math.min(2.0, rawRatio));
	const next = Math.round((currentSize * ratio) / 50) * 50;

	return Math.max(minLimit, Math.min(maxLimit, next));
}


