import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '$lib/api';
import { LogManager } from './logManager.svelte';

vi.mock('$lib/api', () => ({
	api: {
		me: vi.fn(),
		listDevices: vi.fn(),
		listLogs: vi.fn(),
		markLogSeen: vi.fn()
	}
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn(),
	getStoredPrivateKey: vi.fn(),
	decrypt: vi.fn()
}));

describe('LogManager Logic', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.me).mockResolvedValue({ id: 1, email: 'admin@example.com' } as any);
		vi.mocked(api.listDevices).mockResolvedValue([]);
		vi.mocked(api.listLogs).mockResolvedValue([]);
	});

	it('uses unencrypted severity as default for meta.severity and severity_number', async () => {
		const logManager = new LogManager(null);
		
		const log = {
			id: 42,
			device_id: 1,
			time: '2026-06-03T16:20:00Z',
			severity: 'high',
			content: 'encrypted_content',
			seen: false,
			signature: 'sig'
		} as any;

		logManager.logs = [log];
		const alertObj = logManager.getAlertObject(log);

		expect(alertObj.meta.severity).toBe('high');
		expect(alertObj.meta.severity_number).toBe(4);
	});

	it('prefers decrypted severity over unencrypted severity', async () => {
		const logManager = new LogManager('fake_key');
		
		const log = {
			id: 43,
			device_id: 1,
			time: '2026-06-03T16:20:00Z',
			severity: 'high',
			content: 'encrypted_content',
			seen: false,
			signature: 'sig'
		} as any;

		logManager.logs = [log];
		logManager.decryptionState[log.id] = { success: true, parsed: { severity: 'low' } };
		
		const alertObj = logManager.getAlertObject(log);

		expect(alertObj.meta.severity).toBe('low');
		expect(alertObj.meta.severity_number).toBe(2);
	});

	it('performHuntSearch fetches next pages until there are no more results for the time range', async () => {
		const logManager = new LogManager(null);
		logManager.limit = 2; // small page limit for testing

		const page1Logs = [
			{ id: 1, device_id: 1, time: '2026-06-03T10:00:00Z', severity: 'low', content: 'c1', seen: false, signature: 's1' },
			{ id: 2, device_id: 1, time: '2026-06-03T11:00:00Z', severity: 'low', content: 'c2', seen: false, signature: 's2' }
		];
		const page2Logs = [
			{ id: 3, device_id: 1, time: '2026-06-03T12:00:00Z', severity: 'low', content: 'c3', seen: false, signature: 's3' }
		];

		vi.mocked(api.listLogs)
			.mockResolvedValueOnce(page1Logs as any)
			.mockResolvedValueOnce(page2Logs as any);

		await logManager.performHuntSearch('2026-06-03T00:00', '2026-06-04T00:00', 'informational');

		expect(api.listLogs).toHaveBeenCalledTimes(2);
		expect(api.listLogs).toHaveBeenNthCalledWith(1, 1, 2, null, expect.any(String), expect.any(String), 'informational', 0);
		expect(api.listLogs).toHaveBeenNthCalledWith(2, 2, 2, null, expect.any(String), expect.any(String), 'informational', 2);
		expect(logManager.logs.length).toBe(3);
		expect(logManager.logs.map(l => l.id)).toEqual([1, 2, 3]);
		expect(logManager.huntProgress.pagesFetched).toBe(2);
		expect(logManager.huntProgress.totalFetched).toBe(3);
		expect(logManager.huntProgress.earliestFetched).toBe('2026-06-03T10:00:00Z');
		expect(logManager.huntProgress.latestFetched).toBe('2026-06-03T12:00:00Z');
		expect(logManager.earliestFetched).toBe('2026-06-03T10:00:00Z');
		expect(logManager.latestFetched).toBe('2026-06-03T12:00:00Z');
	});

	it('only keeps events matching JSONata in memory and discards non-matching events', async () => {
		const { decrypt } = await import('$lib/crypto');
		const logManager = new LogManager('fake_key');
		logManager.limit = 10;

		const logs = [
			{ id: 1, device_id: 1, time: '2026-06-03T10:00:00Z', severity: 'low', content: 'enc1', seen: false, signature: 's1' },
			{ id: 2, device_id: 1, time: '2026-06-03T11:00:00Z', severity: 'high', content: 'enc2', seen: false, signature: 's2' },
			{ id: 3, device_id: 1, time: '2026-06-03T12:00:00Z', severity: 'low', content: 'enc3', seen: false, signature: 's3' }
		];

		vi.mocked(api.listLogs).mockResolvedValueOnce(logs as any);
		vi.mocked(decrypt).mockImplementation((content) => {
			if (content === 'enc1') return JSON.stringify({ event_type: 'dns' });
			if (content === 'enc2') return JSON.stringify({ event_type: 'process', name: 'evil.exe' });
			return JSON.stringify({ event_type: 'network' });
		});

		// Query matches only log id: 2
		await logManager.performHuntSearch('2026-06-03T00:00', '2026-06-04T00:00', 'informational', "alert.event_type = 'process'");

		// Only log 2 should be retained in memory
		expect(logManager.logs.length).toBe(1);
		expect(logManager.logs[0].id).toBe(2);
		expect(logManager.filteredLogs.length).toBe(1);
		expect(logManager.filteredLogs[0].id).toBe(2);

		// Non-matching decryption results (id 1 and 3) must be discarded from memory
		expect(logManager.decryptionState[2]).toBeDefined();
		expect(logManager.decryptionState[2].success).toBe(true);
		expect(logManager.decryptionState[1]).toBeUndefined();
		expect(logManager.decryptionState[3]).toBeUndefined();

		// Total examined count in huntProgress reflects all 3 scanned logs
		expect(logManager.huntProgress.totalFetched).toBe(3);
		expect(logManager.huntProgress.pagesFetched).toBe(1);
	});

	it('allows interrupting the hunt search and retains already fetched logs', async () => {
		const logManager = new LogManager(null);
		logManager.limit = 1;

		const page1Logs = [
			{ id: 1, device_id: 1, time: '2026-06-03T10:00:00Z', severity: 'low', content: 'c1', seen: false, signature: 's1' }
		];
		const page2Logs = [
			{ id: 2, device_id: 1, time: '2026-06-03T11:00:00Z', severity: 'low', content: 'c2', seen: false, signature: 's2' }
		];

		vi.mocked(api.listLogs).mockImplementation(async (page) => {
			if (page === 1) {
				return page1Logs as any;
			}
			// Interrupt before returning page 2
			logManager.interruptHunt();
			return page2Logs as any;
		});

		await logManager.performHuntSearch('2026-06-03T00:00', '2026-06-04T00:00', 'informational');

		// Page 1 was processed, then during/after page 2 interrupt was triggered
		expect(logManager.huntProgress.interrupted).toBe(true);
		expect(logManager.loading).toBe(false);
		expect(logManager.isSearching).toBe(false);
		expect(logManager.logs.length).toBeGreaterThanOrEqual(1);
	});

	it('updates logs progressively on each page fetch', async () => {
		const logManager = new LogManager(null);
		logManager.limit = 2;

		const page1Logs = [
			{ id: 1, device_id: 1, time: '2026-06-03T10:00:00Z', severity: 'low', content: 'c1', seen: false, signature: 's1' },
			{ id: 2, device_id: 1, time: '2026-06-03T11:00:00Z', severity: 'low', content: 'c2', seen: false, signature: 's2' }
		];
		const page2Logs = [
			{ id: 3, device_id: 1, time: '2026-06-03T12:00:00Z', severity: 'low', content: 'c3', seen: false, signature: 's3' }
		];

		const logCountsOnFetch: number[] = [];
		vi.mocked(api.listLogs).mockImplementation(async (page) => {
			if (page === 1) {
				return page1Logs as any;
			}
			logCountsOnFetch.push(logManager.logs.length);
			return page2Logs as any;
		});

		await logManager.performHuntSearch('2026-06-03T00:00', '2026-06-04T00:00', 'informational');

		// When page 2 was requested, page 1 logs (2 items) were already in logManager.logs!
		expect(logCountsOnFetch).toEqual([2]);
		expect(logManager.logs.length).toBe(3);
	});

	it('adapts page size across pages based on relative latency changes', async () => {
		const logManager = new LogManager(null);
		logManager.limit = 100;

		const requestedLimits: number[] = [];
		const requestedOffsets: number[] = [];

		vi.mocked(api.listLogs).mockImplementation(async (page, limit, deviceId, fromUtc, toUtc, minLevel, offset) => {
			requestedLimits.push(limit ?? 100);
			requestedOffsets.push(offset ?? 0);
			if (page === 1) {
				return Array.from({ length: 100 }, (_, i) => ({
					id: i + 1,
					device_id: 1,
					time: '2026-06-03T10:00:00Z',
					severity: 'low',
					content: 'c',
					seen: false,
					signature: 's'
				})) as any;
			}
			return [];
		});

		await logManager.performHuntSearch('2026-06-03T00:00', '2026-06-04T00:00', 'informational');

		// Initial batch was 100 at offset 0
		expect(requestedLimits[0]).toBe(100);
		expect(requestedOffsets[0]).toBe(0);

		// Page 2 probed upward to 150 at offset 100
		expect(requestedLimits[1]).toBe(150);
		expect(requestedOffsets[1]).toBe(100);
	});
});
