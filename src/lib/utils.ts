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
