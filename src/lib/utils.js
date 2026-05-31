export function isDeviceActive(lastSeen) {
	if (!lastSeen) return false;
	let cleanStr = lastSeen;
	if (typeof lastSeen === 'string' && !lastSeen.endsWith('Z') && !lastSeen.includes('+')) {
		cleanStr = lastSeen + 'Z';
	}
	const lastSeenDate = new Date(cleanStr);
	const diffMs = new Date() - lastSeenDate;
	return diffMs < 10 * 60 * 1000;
}

export function formatFullDateTime(dt) {
	if (!dt) return 'Never';
	let cleanStr = dt;
	if (typeof dt === 'string' && !dt.endsWith('Z') && !dt.includes('+')) {
		cleanStr = dt + 'Z';
	}
	return new Date(cleanStr).toLocaleString();
}
