/**
 * Helper functions for rendering structured alert details.
 * Used by the AlertDetail family of components.
 */

/** Map event.category to display icon + label */
export function getCategoryDisplay(category: string): { icon: string; label: string } {
	const map: Record<string, { icon: string; label: string }> = {
		process: { icon: 'lucide:settings', label: 'Process' },
		file: { icon: 'lucide:folder', label: 'File' },
		network: { icon: 'lucide:radio', label: 'Network' },
		registry: { icon: 'lucide:database', label: 'Registry' }
	};
	return map[category] ?? { icon: 'lucide:help-circle', label: category };
}

/** Map host.os.type to display icon */
export function getOsIcon(osType: string): string {
	return osType === 'windows' ? 'boxicons:bxl-windows' : 'boxicons:bxl-tux';
}

/** Map event.provider to friendly name */
export function getProviderName(provider: string): string {
	const map: Record<string, string> = {
		ebpf: 'eBPF',
		etw: 'ETW'
	};
	return map[provider] ?? provider;
}

/** Map event.type to human-friendly operation name */
export function getOperationName(eventType: string): string {
	const map: Record<string, string> = {
		start: 'Process Start',
		creation: 'Creation',
		connection: 'Connection',
		change: 'Modification'
	};
	return map[eventType] ?? eventType;
}

/** Map network.direction to friendly label */
export function getDirectionLabel(direction: string): string {
	const map: Record<string, string> = {
		egress: 'Egress (outbound)',
		ingress: 'Ingress (inbound)'
	};
	return map[direction] ?? direction;
}

/** Extract the primary category from event.category array */
export function getPrimaryCategory(alert: Record<string, unknown>): string {
	const cats = alert['event.category'];
	if (Array.isArray(cats) && cats.length > 0) return String(cats[0]);
	return 'unknown';
}

/** Format a timestamp for display */
export function formatAlertTimestamp(isoString: string): string {
	try {
		let cleanStr = isoString;
		if (typeof isoString === 'string' && !isoString.endsWith('Z') && !isoString.includes('+')) {
			cleanStr = isoString + 'Z';
		}
		const d = new Date(cleanStr);
		if (isNaN(d.getTime())) return isoString;
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
	} catch {
		return isoString;
	}
}

/** Map severity string to Bootstrap CSS class */
export function getSeverityClass(severity: string): string {
	const s = severity?.toLowerCase();
	if (s === 'high' || s === 'critical') return 'bg-danger text-white';
	return 'bg-warning text-dark';
}

/** Get a string value from a flat alert object, or undefined if not present */
export function getAlertField(alert: Record<string, unknown>, key: string): string | undefined {
	const val = alert[key];
	if (val === undefined || val === null) return undefined;
	return String(val);
}

/** Get a number value from a flat alert object, or undefined if not present */
export function getAlertNumber(alert: Record<string, unknown>, key: string): number | undefined {
	const val = alert[key];
	if (val === undefined || val === null) return undefined;
	if (typeof val === 'number') return val;
	const parsed = Number(val);
	return isNaN(parsed) ? undefined : parsed;
}

/** Get an array value from a flat alert object, or undefined if not present */
export function getAlertArray(alert: Record<string, unknown>, key: string): string[] | undefined {
	const val = alert[key];
	if (!Array.isArray(val)) return undefined;
	return val.map(String);
}

/** Get a boolean value from a flat alert object, or undefined if not present */
export function getAlertBoolean(alert: Record<string, unknown>, key: string): boolean | undefined {
	const val = alert[key];
	if (val === undefined || val === null) return undefined;
	if (typeof val === 'boolean') return val;
	if (val === 'true') return true;
	if (val === 'false') return false;
	return undefined;
}

/** Get an object value from a flat alert object, or undefined if not present */
export function getAlertObject(alert: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
	const val = alert[key];
	if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
		return val as Record<string, unknown>;
	}
	return undefined;
}

/** Format deduplication repeat count for badges */
export function formatDedupCount(count: number | undefined): string | null {
	if (count === undefined || count === null || count <= 0) return null;
	return `+${count} repeats`;
}

/** Format YARA scan source label */
export function getYaraSourceLabel(source: string | undefined): string | null {
	if (!source) return null;
	const s = source.toLowerCase();
	if (s === 'process_memory') return 'Process Memory';
	if (s === 'file') return 'File';
	return source;
}

/** Map Windows Integrity Level to badge CSS class */
export function getIntegrityBadgeClass(integrity: string | undefined): string {
	const level = integrity?.toLowerCase();
	if (level === 'system' || level === 'high') return 'bg-danger text-white';
	if (level === 'medium') return 'bg-warning text-dark';
	if (level === 'low') return 'bg-info text-white';
	return 'bg-secondary text-white';
}

