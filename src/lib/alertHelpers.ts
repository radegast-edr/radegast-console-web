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
		const d = new Date(isoString);
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
