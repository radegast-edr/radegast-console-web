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
		expect(api.listLogs).toHaveBeenNthCalledWith(1, 1, 2, null, expect.any(String), expect.any(String), 'informational');
		expect(api.listLogs).toHaveBeenNthCalledWith(2, 2, 2, null, expect.any(String), expect.any(String), 'informational');
		expect(logManager.logs.length).toBe(3);
		expect(logManager.logs.map(l => l.id)).toEqual([1, 2, 3]);
	});
});
