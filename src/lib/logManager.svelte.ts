import {api, type Log, type Device, type LogSeverity} from '$lib/api';
import { decrypt } from '$lib/crypto';
import { isDeviceActive, formatFullDateTime, preprocessQuery, matchesJsonata, mapSeverityToNumber } from '$lib/utils';
import jsonata from 'jsonata';

export interface DecryptionResult {
	success: boolean;
	parsed?: any;
	error?: string;
}

export class LogManager {
	logs = $state<Log[]>([]);
	decryptionState = $state<Record<string | number, DecryptionResult>>({});
	filteredLogs = $state<Log[]>([]);
	searchError = $state('');
	loading = $state(true);
	isSearching = $state(false);
	knownLogIds = new Set<number>();
	isInitialLoad = true;

	currentPage = $state(1);
	totalPages = $state(1);
	totalLogs = $state(0);
	limit = 100;

	devices: Device[] = [];
	deviceMap = new Map<number, Device>();

	private privateKey: string | null = null;
	private onNewAlert?: (log: Log, devObj?: Device) => void;

	constructor(privateKey: string | null, onNewAlert?: (log: Log, devObj?: Device) => void) {
		this.privateKey = privateKey;
		this.onNewAlert = onNewAlert;
	}

	setDevices(devices: Device[]) {
		this.devices = devices;
		this.deviceMap = new Map<number, Device>(devices.map(d => [d.id, d]));
	}

	getAlertObject(log: Log): any {
		const devObj = this.deviceMap.get(log.device_id);
		const deviceName = devObj ? devObj.name : `Device #${log.device_id}`;
		let status = 'offline';
		let last_seen: string | undefined = undefined;
		if (devObj) {
			if (isDeviceActive(devObj.last_seen)) {
				status = 'online';
			} else {
				status = 'offline';
				last_seen = formatFullDateTime(devObj.last_seen);
			}
		}

		let cleanTime = log.time;
		if (typeof cleanTime === 'string' && !cleanTime.endsWith('Z') && !cleanTime.includes('+')) {
			cleanTime = cleanTime + 'Z';
		}
		const reported_timestamp = new Date(cleanTime).toISOString();
		const decState = this.decryptionState[log.id];
		let severityVal: any = log.severity;
		if (decState && decState.success && decState.parsed && typeof decState.parsed === 'object' && decState.parsed.severity !== undefined) {
			severityVal = decState.parsed.severity;
		}

		const severity_number = (severityVal !== null && severityVal !== undefined) ? mapSeverityToNumber(severityVal) : undefined;

		const meta: any = {
			alert_id: log.id,
			device_id: log.device_id,
			reported_timestamp: reported_timestamp,
			device: deviceName,
			status: status
		};
		if (last_seen !== undefined) meta.last_seen = last_seen;
		if (severityVal !== null && severityVal !== undefined) meta.severity = severityVal;
		if (severity_number !== undefined) meta.severity_number = severity_number;
		if (log.excluded_by) meta.excluded_by = log.excluded_by;

		if (!decState) {
			let alertVal = 'encrypted alert';
			if (this.privateKey) alertVal = 'decrypting...';
			return { meta, alert: alertVal };
		}

		if (decState.success) {
			return { meta, alert: decState.parsed };
		} else {
			const failedMeta: any = {
				alert_id: log.id,
				device_id: log.device_id,
				reported_timestamp: reported_timestamp
			};
			if (severityVal !== null && severityVal !== undefined) failedMeta.severity = severityVal;
			if (severity_number !== undefined) failedMeta.severity_number = severity_number;
			if (log.excluded_by) failedMeta.excluded_by = log.excluded_by;
			return { meta: failedMeta, alert: `decrpytion failed: ${decState.error}` };
		}
	}

	async runFilter(searchQuery: string) {
		if (!searchQuery.trim()) {
			this.filteredLogs = this.logs;
			this.searchError = '';
			return;
		}

		let matches: boolean[];
		try {
			const processed = preprocessQuery(searchQuery);
			jsonata(processed);
			this.searchError = '';
			matches = await Promise.all(
				this.logs.map(async (log) => {
					const obj = this.getAlertObject(log);
					return await matchesJsonata(obj, searchQuery);
				})
			);
		} catch {
			// Fallback to full-text search on failure
			this.searchError = '';
			const queryLower = searchQuery.toLowerCase();
			matches = this.logs.map((log) => {
				const obj = this.getAlertObject(log);
				const alertStr = typeof obj.alert === 'object' ? JSON.stringify(obj.alert) : String(obj.alert);
				const metaStr = JSON.stringify(obj.meta);
				return alertStr.toLowerCase().includes(queryLower) || metaStr.toLowerCase().includes(queryLower);
			});
		}

		this.filteredLogs = this.logs.filter((_, idx) => matches[idx]);
	}

	async performSearch(fromTime: string | null, toTime: string | null, min_level: LogSeverity | null = null, page = 1) {
		this.isSearching = true;
		this.loading = true;
		this.currentPage = page;

		const fromUtc = fromTime ? new Date(fromTime).toISOString() : null;
		const toUtc = toTime ? new Date(toTime).toISOString() : null;

		try {
			const countRes = await api.getLogsCount(null, fromUtc, toUtc, min_level).catch(() => ({ total_count: 0 }));
			this.totalLogs = countRes.total_count;
			this.totalPages = Math.max(1, Math.ceil(this.totalLogs / this.limit));

			if (this.currentPage > this.totalPages) {
				this.currentPage = this.totalPages;
			}

			const logsData = await api.listLogs(this.currentPage, this.limit, null, fromUtc, toUtc, min_level);

			if (!this.isInitialLoad) {
				for (const log of logsData) {
					if (!this.knownLogIds.has(log.id)) {
						this.knownLogIds.add(log.id);
						if (!log.seen && this.onNewAlert) {
							this.onNewAlert(log, this.deviceMap.get(log.device_id));
						}
					}
				}
			} else {
				for (const log of logsData) {
					this.knownLogIds.add(log.id);
				}
			}

			const newDecryptionState = { ...this.decryptionState };
			if (this.privateKey) {
				for (const log of logsData) {
					if (newDecryptionState[log.id]) continue;
					try {
						const dec = decrypt(log.content, this.privateKey);
						let parsed: any;
						try {
							parsed = JSON.parse(dec);
						} catch {
							parsed = dec;
						}
						newDecryptionState[log.id] = { success: true, parsed };
					} catch (e) {
						newDecryptionState[log.id] = { success: false, error: (e as Error).message };
					}
				}
			}

			this.logs = logsData;
			this.decryptionState = newDecryptionState;
		} catch (e) {
			console.error("performSearch error:", e);
		} finally {
			this.loading = false;
			this.isSearching = false;
			this.isInitialLoad = false;
		}
	}
}
